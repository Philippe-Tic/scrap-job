import * as cheerio from 'cheerio'
import { randomDelay } from '../utils'
import type { JobSource, JobOffer, SearchParams } from './types'

const BASE_URL = 'https://www.emploi-territorial.fr'
const RESULTS_PER_PAGE = 20
const MAX_RETRIES = 2
const DELAY_MIN_MS = 2000
const DELAY_MAX_MS = 4000

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
]

function randomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

function buildSearchUrl(page: number): string {
  return `${BASE_URL}/rechercher?page=${page}&parmalink=1`
}

async function fetchPage(url: string, attempt = 0): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': randomUserAgent(),
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.5',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return await response.text()
  } catch (error) {
    if (attempt < MAX_RETRIES) {
      const backoffMs = Math.pow(2, attempt + 1) * 1000
      console.warn(
        `[emploi-territorial] Retry ${attempt + 1}/${MAX_RETRIES} for ${url} (waiting ${backoffMs}ms)`,
      )
      await new Promise((r) => setTimeout(r, backoffMs))
      return fetchPage(url, attempt + 1)
    }
    throw error
  }
}

/**
 * Parse a French date tooltip like "publié le 18/02/2026" into a Date.
 * Also handles relative text: "aujourd'hui", "hier", "il y a N jours".
 */
function parseFrenchDate(text: string): Date | null {
  if (!text) return null

  const cleaned = text.trim().toLowerCase()

  // Exact date from tooltip: "publié le dd/mm/yyyy"
  const dateMatch = cleaned.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (dateMatch) {
    const [, day, month, year] = dateMatch
    return new Date(Number(year), Number(month) - 1, Number(day))
  }

  const now = new Date()
  now.setHours(0, 0, 0, 0)

  if (cleaned.includes("aujourd'hui") || cleaned.includes('aujourd')) {
    return now
  }

  if (cleaned.includes('hier')) {
    now.setDate(now.getDate() - 1)
    return now
  }

  const daysAgoMatch = cleaned.match(/il y a (\d+) jour/)
  if (daysAgoMatch) {
    now.setDate(now.getDate() - Number(daysAgoMatch[1]))
    return now
  }

  return null
}

function parseResultsPage(
  html: string,
  seenIds: Set<string>,
): { offers: JobOffer[]; totalResults: number } {
  const $ = cheerio.load(html)
  const offers: JobOffer[] = []

  // Extract total from "27605 résultats"
  const totalText = $('#NbTotalOffre').text().trim()
  const totalMatch = totalText.match(/(\d[\d\s]*)/)
  const totalResults = totalMatch
    ? parseInt(totalMatch[1].replace(/\s/g, ''), 10)
    : 0

  $('#tableRecherche tbody tr').each((_, row) => {
    const $row = $(row)
    const externalId = $row.attr('id')
    if (!externalId || seenIds.has(externalId)) return

    seenIds.add(externalId)

    // Desktop view block
    const $desktop = $row.find('td .d-none.d-lg-block')

    // Job title + URL
    const $titleLink = $desktop.find('a.lien-details-offre')
    const title = $titleLink.text().trim()
    const relativeUrl = $titleLink.attr('href') ?? ''
    const url = relativeUrl ? `${BASE_URL}${relativeUrl}` : ''

    // Contract type
    const contractType = $desktop.find('.badge.badge-light').text().trim()

    // Employer + Location — from the desktop table cells
    const $cells = $row.find('td.d-none.d-lg-table-cell')

    // First desktop cell: employer
    const $employerCell = $cells.eq(0)
    const company = $employerCell.find('a').first().text().trim()
    const location =
      $employerCell.find('span.text-secondary').text().trim() || ''

    // Second desktop cell: category/grade
    const $gradeCell = $cells.eq(1)
    const category = $gradeCell.find('.badge-info').text().trim()

    // Date cell — last desktop cell
    const $dateCell = $cells.last()
    const dateTooltip =
      $dateCell.find('button').first().attr('data-tooltip') ?? ''
    const publishedAt = parseFrenchDate(dateTooltip)

    if (!title || !externalId) return

    const tags: string[] = []
    if (category) tags.push(`cat:${category}`)

    offers.push({
      sourceId: 'emploi-territorial',
      externalId,
      title,
      company: company || 'Non renseigné',
      location: location || 'Non renseigné',
      url,
      publishedAt,
      contractType: contractType || undefined,
      tags: tags.length > 0 ? tags : undefined,
    })
  })

  return { offers, totalResults }
}

function filterByKeywords(offers: JobOffer[], keywords: string[]): JobOffer[] {
  if (keywords.length === 0) return offers

  const lowerKeywords = keywords.map((k) => k.toLowerCase())
  return offers.filter((offer) => {
    const searchText =
      `${offer.title} ${offer.company} ${offer.location}`.toLowerCase()
    return lowerKeywords.some((kw) => searchText.includes(kw))
  })
}

async function scrape(params: SearchParams): Promise<JobOffer[]> {
  const maxResults = params.maxResults ?? 100
  const maxPages = Math.ceil(maxResults / RESULTS_PER_PAGE)
  const allOffers: JobOffer[] = []
  const seenIds = new Set<string>()
  const errors: string[] = []

  console.log(
    `[emploi-territorial] Starting scrape (maxResults: ${maxResults}, keywords: ${params.keywords.join(', ')})`,
  )

  for (let page = 1; page <= maxPages; page++) {
    try {
      const url = buildSearchUrl(page)
      console.log(`[emploi-territorial] Fetching page ${page}: ${url}`)

      const html = await fetchPage(url)
      const { offers, totalResults } = parseResultsPage(html, seenIds)

      if (offers.length === 0) {
        console.log(`[emploi-territorial] No new results on page ${page}, stopping`)
        break
      }

      allOffers.push(...offers)
      console.log(
        `[emploi-territorial] Page ${page}: ${offers.length} new offers (total: ${allOffers.length}, site total: ${totalResults})`,
      )

      // Check if we've reached the end
      if (seenIds.size >= totalResults || allOffers.length >= maxResults) {
        break
      }

      // Polite delay between pages
      if (page < maxPages) {
        await randomDelay(DELAY_MIN_MS, DELAY_MAX_MS)
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error'
      console.error(
        `[emploi-territorial] Error on page ${page}: ${message}`,
      )
      errors.push(`Page ${page}: ${message}`)
      // Continue to next page on error
    }
  }

  // Filter by keywords locally
  const filtered = filterByKeywords(allOffers, params.keywords)
  console.log(
    `[emploi-territorial] Done: ${allOffers.length} total, ${filtered.length} after keyword filter`,
  )

  return filtered
}

export const emploiTerritorial: JobSource = {
  id: 'emploi-territorial',
  name: 'Emploi Territorial',
  baseUrl: BASE_URL,
  scrape,
}
