import * as cheerio from 'cheerio'
import { randomDelay } from '../utils'
import { fetchWithRetry, filterByTitle } from './utils'
import type { JobSource, JobOffer, SearchParams } from './types'

const BASE_URL = 'https://www.emploi-territorial.fr'
const RESULTS_PER_PAGE = 20
const DELAY_MIN_MS = 2000
const DELAY_MAX_MS = 4000

const CITY_CODES: Record<string, string> = {
  rouen: '76540',
  paris: '75056',
  lyon: '69123',
  marseille: '13055',
  toulouse: '31555',
  bordeaux: '33063',
  lille: '59350',
  nantes: '44109',
  strasbourg: '67482',
  montpellier: '34172',
  rennes: '35238',
}

const ALLOWED_DISTANCES = [5, 10, 15, 20, 25, 30, 40, 50, 100]

function snapRadius(km: number): number {
  let closest = ALLOWED_DISTANCES[0]
  let minDiff = Math.abs(km - closest)
  for (const d of ALLOWED_DISTANCES) {
    const diff = Math.abs(km - d)
    if (diff < minDiff) {
      closest = d
      minDiff = diff
    }
  }
  return closest
}

function buildSearchUrl(
  page: number,
  keyword?: string,
  location?: { villeCode: string; distance: number },
): string {
  const params = new URLSearchParams()
  params.set('page', String(page))
  if (keyword) {
    params.set('search_offre_form[advsearch]', keyword)
  }
  if (location) {
    params.set('search_offre_form[ville]', location.villeCode)
    params.set('search_offre_form[distance]', String(location.distance))
  }
  return `${BASE_URL}/rechercher?${params.toString()}`
}

async function fetchPage(url: string): Promise<{ html: string; blocked: boolean }> {
  return fetchWithRetry(url, { tag: 'emploi-territorial' })
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

function resolveLocationConfig(
  params: SearchParams,
): { villeCode: string; distance: number } | undefined {
  if (!params.location) return undefined
  const code = CITY_CODES[params.location.toLowerCase()]
  if (!code) {
    console.warn(
      `[emploi-territorial] Unknown city "${params.location}", skipping location filter`,
    )
    return undefined
  }
  return { villeCode: code, distance: snapRadius(params.radius ?? 50) }
}

async function scrapeKeywordPass(
  keyword: string | undefined,
  locationConfig: { villeCode: string; distance: number } | undefined,
  maxResults: number,
  seenIds: Set<string>,
): Promise<JobOffer[]> {
  const maxPages = Math.ceil(maxResults / RESULTS_PER_PAGE)
  const offers: JobOffer[] = []

  for (let page = 1; page <= maxPages; page++) {
    const url = buildSearchUrl(page, keyword, locationConfig)
    console.log(`[emploi-territorial] Fetching page ${page}: ${url}`)

    const { html, blocked } = await fetchPage(url)
    if (blocked) {
      console.warn(`[emploi-territorial] Blocked on page ${page}, stopping with partial results`)
      break
    }
    const { offers: pageOffers, totalResults } = parseResultsPage(
      html,
      seenIds,
    )

    if (pageOffers.length === 0) {
      console.log(
        `[emploi-territorial] No new results on page ${page}, stopping`,
      )
      break
    }

    offers.push(...pageOffers)
    console.log(
      `[emploi-territorial] Page ${page}: ${pageOffers.length} new offers (pass total: ${offers.length}, site total: ${totalResults})`,
    )

    if (seenIds.size >= totalResults || offers.length >= maxResults) {
      break
    }

    // Polite delay between pages
    if (page < maxPages) {
      await randomDelay(DELAY_MIN_MS, DELAY_MAX_MS)
    }
  }

  if (keyword) {
    const beforeCount = offers.length
    const filtered = filterByTitle(offers, [keyword])
    const dropped = beforeCount - filtered.length
    if (dropped > 0) {
      console.log(
        `[emploi-territorial] Title filter "${keyword}": kept ${filtered.length}/${beforeCount} (${dropped} dropped)`,
      )
    }
    return filtered
  }

  return offers
}

async function scrape(params: SearchParams): Promise<JobOffer[]> {
  const maxResults = params.maxResults ?? 100
  const seenIds = new Set<string>()
  const allOffers: JobOffer[] = []

  const locationConfig = resolveLocationConfig(params)

  const keywords =
    params.keywords.length > 0 ? params.keywords : [undefined as string | undefined]

  console.log(
    `[emploi-territorial] Starting scrape (maxResults: ${maxResults}, keywords: [${params.keywords.join(', ')}], location: ${params.location || 'none'}, radius: ${params.radius ?? 'default'})`,
  )

  for (const keyword of keywords) {
    if (keyword) {
      console.log(`[emploi-territorial] --- Keyword pass: "${keyword}" ---`)
    }

    const offers = await scrapeKeywordPass(
      keyword,
      locationConfig,
      maxResults,
      seenIds,
    )
    allOffers.push(...offers)

    // Polite delay between keyword passes
    if (keywords.length > 1 && keyword !== keywords[keywords.length - 1]) {
      await randomDelay(DELAY_MIN_MS, DELAY_MAX_MS)
    }
  }

  console.log(
    `[emploi-territorial] Done: ${allOffers.length} offers collected (${seenIds.size} unique IDs seen)`,
  )

  return allOffers
}

export const emploiTerritorial: JobSource = {
  id: 'emploi-territorial',
  name: 'Emploi Territorial',
  baseUrl: BASE_URL,
  scrape,
}
