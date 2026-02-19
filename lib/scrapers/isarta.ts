import * as cheerio from 'cheerio'
import { randomDelay } from '../utils'
import { buildFetchHeaders, filterByTitle, filterByLocation, normalizeText } from './utils'
import type { JobSource, JobOffer, SearchParams } from './types'

const TAG = 'isarta'
const BASE_URL = 'https://france.isarta.com'
const RESULTS_PER_PAGE = 50
const DELAY_MIN_MS = 2000
const DELAY_MAX_MS = 4000

const REGION_CATEGORIES: Record<string, string> = {
  'rouen': 'normandie',
  'normandie': 'normandie',
  'caen': 'normandie',
  'le havre': 'normandie',
}

function buildSearchUrl(keyword: string, page: number, regionCat?: string): string {
  const params = new URLSearchParams()
  params.set('choix', 'FR')
  if (regionCat) params.set('cat', regionCat)
  if (keyword) params.set('q', keyword)
  if (page > 0) params.set('page', String(page))
  return `${BASE_URL}/cgi-bin/emplois/jobs?${params.toString()}`
}

/**
 * Parse "Publiée : DD/MM/YYYY" into a Date.
 */
function parseFrenchDate(text: string): Date | null {
  const match = text.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (!match) return null
  const [, day, month, year] = match
  return new Date(Number(year), Number(month) - 1, Number(day))
}

function parsePage(html: string, seenIds: Set<string>): JobOffer[] {
  const $ = cheerio.load(html)
  const offers: JobOffer[] = []

  $('div.well-listing-monopage').each((_, el) => {
    const $item = $(el)

    // Extract job ID from data-login attribute
    const externalId = $item.attr('data-login')
    if (!externalId) return
    if (seenIds.has(externalId)) return
    seenIds.add(externalId)

    const url = `https://isarta.fr/?job=${externalId}`

    // Use data attributes (most reliable) with DOM fallbacks
    const title = $item.attr('data-poste') || $item.find('h2.poste-listing-monopage').text().trim()
    const company = $item.attr('data-company1') || $item.find('h3.compagnie-listing-monopage').text().trim() || 'Non renseigné'
    const location = $item.attr('data-lieu') || $item.find('h4.lieu-listing-monopage').text().trim() || 'Non renseigné'

    // Contract type and schedule from data attributes
    const type = $item.attr('data-type')
    const horaire = $item.attr('data-horaire')
    const contractType = [type, horaire].filter(Boolean).join(' - ') || undefined

    // Date from data-register-date (DD/MM/YYYY)
    const dateStr = $item.attr('data-register-date')
    const publishedAt = dateStr ? parseFrenchDate(dateStr) : null

    if (!title) return

    offers.push({
      sourceId: TAG,
      externalId,
      title,
      company,
      location,
      url,
      publishedAt,
      contractType,
    })
  })

  return offers
}

async function scrapeKeywordPass(
  keyword: string,
  maxResults: number,
  seenIds: Set<string>,
  regionCat?: string,
): Promise<JobOffer[]> {
  const maxPages = Math.ceil(maxResults / RESULTS_PER_PAGE)
  const offers: JobOffer[] = []

  for (let page = 0; page < maxPages; page++) {
    const url = buildSearchUrl(keyword, page, regionCat)
    console.log(`[${TAG}] Fetching page ${page + 1}: ${url}`)

    let html: string
    try {
      const response = await fetch(url, { headers: buildFetchHeaders() })
      if (!response.ok) {
        console.warn(`[${TAG}] HTTP ${response.status} on page ${page + 1}, stopping`)
        break
      }
      html = await response.text()
    } catch (error) {
      console.error(`[${TAG}] Fetch error on page ${page + 1}:`, error)
      break
    }

    // Detect empty or non-listing pages (Isarta includes reCAPTCHA scripts for login, not for blocking)
    if (!html.includes('well-listing-monopage') && !html.includes('searchResultsTable')) {
      console.warn(`[${TAG}] Page has no listing elements, may be blocked or template not rendered`)
      break
    }

    const pageOffers = parsePage(html, seenIds)

    if (pageOffers.length === 0) {
      console.log(`[${TAG}] No new results on page ${page + 1}, stopping`)
      break
    }

    offers.push(...pageOffers)
    console.log(
      `[${TAG}] Page ${page + 1}: ${pageOffers.length} new offers (pass total: ${offers.length})`,
    )

    if (offers.length >= maxResults) break

    if (page < maxPages - 1) {
      await randomDelay(DELAY_MIN_MS, DELAY_MAX_MS)
    }
  }

  return offers
}

async function scrape(params: SearchParams): Promise<JobOffer[]> {
  const maxResults = params.maxResults ?? 100
  const seenIds = new Set<string>()
  const allOffers: JobOffer[] = []

  // Resolve location → Isarta region category
  const regionCat = params.location
    ? REGION_CATEGORIES[normalizeText(params.location)]
    : undefined
  if (params.location) {
    console.log(
      `[${TAG}] Location "${params.location}" → region category: ${regionCat ?? '(none)'}`,
    )
  }

  const keywords =
    params.keywords.length > 0 ? params.keywords : [undefined as string | undefined]

  console.log(
    `[${TAG}] Starting scrape (keywords: [${params.keywords.join(', ')}], maxResults: ${maxResults})`,
  )

  for (const keyword of keywords) {
    console.log(`[${TAG}] --- Keyword pass: "${keyword ?? '(all)'}" ---`)

    const offers = await scrapeKeywordPass(keyword ?? '', maxResults, seenIds, regionCat)
    allOffers.push(...offers)

    if (keywords.length > 1 && keyword !== keywords[keywords.length - 1]) {
      await randomDelay(DELAY_MIN_MS, DELAY_MAX_MS)
    }
  }

  // Post-scrape title filter
  let filtered = filterByTitle(allOffers, params.keywords)
  const droppedTitle = allOffers.length - filtered.length
  if (droppedTitle > 0) {
    console.log(
      `[${TAG}] Title filter: kept ${filtered.length}/${allOffers.length} (${droppedTitle} dropped)`,
    )
  }

  // Post-scrape location filter (only when no region category — cat already filters server-side)
  if (params.location && !regionCat) {
    const beforeLoc = filtered.length
    filtered = filterByLocation(filtered, params.location)
    const droppedLoc = beforeLoc - filtered.length
    if (droppedLoc > 0) {
      console.log(
        `[${TAG}] Location filter: kept ${filtered.length}/${beforeLoc} (${droppedLoc} dropped)`,
      )
    }
  }

  console.log(
    `[${TAG}] Done: ${filtered.length} offers collected (${seenIds.size} unique IDs seen)`,
  )

  return filtered
}

export const isarta: JobSource = {
  id: TAG,
  name: 'Isarta',
  baseUrl: BASE_URL,
  scrape,
}
