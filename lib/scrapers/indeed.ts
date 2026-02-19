import * as cheerio from 'cheerio'
import { randomDelay } from '../utils'
import { fetchWithBrowser } from './browser'
import { filterByTitle, parseRelativeDate } from './utils'
import type { JobSource, JobOffer, SearchParams } from './types'

const TAG = 'indeed'
const BASE_URL = 'https://fr.indeed.com'
const RESULTS_PER_PAGE = 10
const DELAY_MIN_MS = 3000
const DELAY_MAX_MS = 6000

// Indeed changes its HTML frequently — isolate selectors for easy updates
const SELECTORS = {
  jobCard: '.job_seen_beacon',
  titleLink: 'a[data-jk]',
  company: '[data-testid="company-name"]',
  location: '[data-testid="text-location"]',
  salary: '.salary-snippet-container, .metadata.salary-snippet-container',
  date: 'span.date',
} as const

function buildSearchUrl(
  keywords: string,
  location: string,
  radius: number,
  offset: number,
): string {
  const params = new URLSearchParams({
    q: keywords,
    l: location,
    radius: String(radius),
    start: String(offset),
    sort: 'date',
  })
  return `${BASE_URL}/jobs?${params.toString()}`
}

function parsePage(
  html: string,
  seenIds: Set<string>,
): JobOffer[] {
  const $ = cheerio.load(html)
  const offers: JobOffer[] = []

  $(SELECTORS.jobCard).each((_, el) => {
    const $card = $(el)
    const $titleLink = $card.find(SELECTORS.titleLink)
    const externalId = $titleLink.attr('data-jk')
    if (!externalId || seenIds.has(externalId)) return
    seenIds.add(externalId)

    // Title is in span[title] attribute or text content
    const $titleSpan = $titleLink.find('span[title]')
    const title = $titleSpan.attr('title') || $titleLink.text().trim()
    const relativeUrl = $titleLink.attr('href') ?? ''
    const url = relativeUrl.startsWith('http')
      ? relativeUrl
      : relativeUrl
        ? `${BASE_URL}${relativeUrl}`
        : ''

    const company = $card.find(SELECTORS.company).text().trim()
    const location = $card.find(SELECTORS.location).text().trim()
    const salary = $card.find(SELECTORS.salary).text().trim() || undefined

    const dateText = $card.find(SELECTORS.date).text().trim()
    const publishedAt = parseRelativeDate(dateText)

    if (!title) return

    offers.push({
      sourceId: TAG,
      externalId,
      title,
      company: company || 'Non renseigné',
      location: location || 'Non renseigné',
      url,
      publishedAt,
      salary,
    })
  })

  return offers
}

async function scrapeKeywordPass(
  keyword: string,
  location: string,
  radius: number,
  maxResults: number,
  seenIds: Set<string>,
): Promise<JobOffer[]> {
  const maxPages = Math.ceil(maxResults / RESULTS_PER_PAGE)
  const offers: JobOffer[] = []

  for (let page = 0; page < maxPages; page++) {
    const offset = page * RESULTS_PER_PAGE
    const url = buildSearchUrl(keyword, location, radius, offset)
    console.log(`[${TAG}] Fetching page ${page + 1}: ${url}`)

    const { html, blocked } = await fetchWithBrowser(url, { tag: TAG })

    if (blocked) {
      console.warn(`[${TAG}] Blocked on page ${page + 1}, stopping with partial results`)
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

export const indeed: JobSource = {
  id: TAG,
  name: 'Indeed France',
  baseUrl: BASE_URL,
  scrape,
}
