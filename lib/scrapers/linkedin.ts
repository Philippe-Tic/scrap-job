import * as cheerio from 'cheerio'
import { randomDelay } from '../utils'
import { fetchWithRetry, filterByTitle } from './utils'
import type { JobSource, JobOffer, SearchParams } from './types'

const TAG = 'linkedin'
const BASE_URL = 'https://www.linkedin.com/jobs'
const GUEST_API = 'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search'
const RESULTS_PER_PAGE = 25
const DELAY_MIN_MS = 4000
const DELAY_MAX_MS = 8000
const GEO_ID_FRANCE = '105015875'
const KM_TO_MILES = 0.621371

const SELECTORS = {
  jobCard: 'li',
  title: 'h3.base-search-card__title',
  company: 'h4.base-search-card__subtitle',
  location: 'span.job-search-card__location',
  date: 'time',
  link: 'a.base-card__full-link',
} as const

function buildSearchUrl(
  keywords: string,
  location: string,
  radiusKm: number,
  offset: number,
): string {
  const distanceMiles = Math.round(radiusKm * KM_TO_MILES)
  const params = new URLSearchParams({
    keywords,
    location,
    start: String(offset),
    f_TPR: 'r2592000', // last month
    sortBy: 'DD',
    distance: String(distanceMiles),
  })
  // Only use geoId when location is generic — otherwise LinkedIn geocodes the city name
  if (!location || location.toLowerCase() === 'france') {
    params.set('geoId', GEO_ID_FRANCE)
  }
  return `${GUEST_API}?${params.toString()}`
}

function cleanLinkedInUrl(raw: string): string {
  try {
    const url = new URL(raw.trim())
    // Strip tracking params, keep only the job posting path
    return `${url.origin}${url.pathname}`
  } catch {
    return raw.trim()
  }
}

function parseEntityUrn(urn: string): string {
  // "urn:li:jobPosting:1234567890" → "1234567890"
  const match = urn.match(/(\d+)$/)
  return match ? match[1] : urn
}

function parsePage(
  html: string,
  seenIds: Set<string>,
): JobOffer[] {
  const $ = cheerio.load(html)
  const offers: JobOffer[] = []

  $(SELECTORS.jobCard).each((_, el) => {
    const $card = $(el)

    // Extract external ID from data-entity-urn
    const entityUrn = $card.find('[data-entity-urn]').attr('data-entity-urn')
      ?? $card.attr('data-entity-urn')
      ?? ''
    const externalId = parseEntityUrn(entityUrn)
    if (!externalId || seenIds.has(externalId)) return
    seenIds.add(externalId)

    const title = $card.find(SELECTORS.title).text().trim()
    const company = $card.find(SELECTORS.company).text().trim()
    const location = $card.find(SELECTORS.location).text().trim()

    // Date from <time datetime="2026-02-15">
    const $time = $card.find(SELECTORS.date)
    const datetimeAttr = $time.attr('datetime') ?? ''
    const publishedAt = datetimeAttr ? new Date(datetimeAttr) : null

    // URL — clean tracking params
    const rawUrl = $card.find(SELECTORS.link).attr('href') ?? ''
    const url = rawUrl ? cleanLinkedInUrl(rawUrl) : ''

    if (!title) return

    offers.push({
      sourceId: TAG,
      externalId,
      title,
      company: company || 'Non renseigné',
      location: location || 'Non renseigné',
      url,
      publishedAt: publishedAt && !isNaN(publishedAt.getTime()) ? publishedAt : null,
    })
  })

  return offers
}

async function scrapeKeywordPass(
  keyword: string,
  location: string,
  radiusKm: number,
  maxResults: number,
  seenIds: Set<string>,
): Promise<JobOffer[]> {
  const maxPages = Math.ceil(maxResults / RESULTS_PER_PAGE)
  const offers: JobOffer[] = []

  for (let page = 0; page < maxPages; page++) {
    const offset = page * RESULTS_PER_PAGE
    const url = buildSearchUrl(keyword, location, radiusKm, offset)
    console.log(`[${TAG}] Fetching page ${page + 1}: ${url}`)

    const { html, blocked } = await fetchWithRetry(url, { tag: TAG })

    if (blocked) {
      console.warn(`[${TAG}] Blocked on page ${page + 1}, stopping with partial results`)
      break
    }

    // LinkedIn returns empty or very short HTML when no more results
    if (html.trim().length < 100) {
      console.log(`[${TAG}] Empty response on page ${page + 1}, no more results`)
      break
    }

    const pageOffers = parsePage(html, seenIds)

    if (pageOffers.length === 0) {
      console.log(`[${TAG}] No results on page ${page + 1}. HTML length: ${html.length}, preview: ${html.substring(0, 300)}`)
      if (html.includes('authwall') || html.includes('sign-in')) {
        console.warn(`[${TAG}] Detected authwall/login redirect`)
      }
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
  const location = params.location || 'France'
  const radius = params.radius ?? 50

  const keywords =
    params.keywords.length > 0 ? params.keywords : [undefined as string | undefined]

  console.log(
    `[${TAG}] Starting scrape (keywords: [${params.keywords.join(', ')}], location: "${location}", radius: ${radius}km, maxResults: ${maxResults})`,
  )

  for (const keyword of keywords) {
    console.log(`[${TAG}] --- Keyword pass: "${keyword ?? '(all)'}" ---`)

    const offers = await scrapeKeywordPass(
      keyword ?? '',
      location,
      radius,
      maxResults,
      seenIds,
    )
    allOffers.push(...offers)

    // Polite delay between keyword passes
    if (keywords.length > 1 && keyword !== keywords[keywords.length - 1]) {
      await randomDelay(DELAY_MIN_MS, DELAY_MAX_MS)
    }
  }

  // Post-scrape title filter
  const filtered = filterByTitle(allOffers, params.keywords)
  const dropped = allOffers.length - filtered.length
  if (dropped > 0) {
    console.log(
      `[${TAG}] Title filter: kept ${filtered.length}/${allOffers.length} (${dropped} dropped)`,
    )
  }

  console.log(
    `[${TAG}] Done: ${filtered.length} offers collected (${seenIds.size} unique IDs seen)`,
  )

  return filtered
}

export const linkedin: JobSource = {
  id: TAG,
  name: 'LinkedIn Jobs',
  baseUrl: BASE_URL,
  scrape,
}
