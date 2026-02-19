import * as cheerio from 'cheerio'
import { randomDelay } from '../utils'
import { fetchWithRetry, filterByTitle, parseRelativeDate } from './utils'
import type { JobSource, JobOffer, SearchParams } from './types'

const TAG = 'hellowork'
const BASE_URL = 'https://www.hellowork.com'
const RESULTS_PER_PAGE = 30
const DELAY_MIN_MS = 2000
const DELAY_MAX_MS = 4000

const SELECTORS = {
  jobItem: 'li[data-id-storage-item-id]',
  card: '[data-cy="serpCard"]',
  titleLink: 'a[data-cy="offerTitle"]',
  location: '[data-cy="localisationCard"]',
  contract: '[data-cy="contractCard"]',
  salary: '[data-cy="salaryCard"]',
} as const

function buildSearchUrl(keyword: string, location: string, page: number): string {
  const params = new URLSearchParams()
  if (keyword) params.set('k', keyword)
  if (location) params.set('l', location)
  params.set('p', String(page))
  return `${BASE_URL}/fr-fr/emploi/recherche.html?${params.toString()}`
}

function parsePage(html: string, seenIds: Set<string>): JobOffer[] {
  const $ = cheerio.load(html)
  const offers: JobOffer[] = []

  $(SELECTORS.jobItem).each((_, el) => {
    const $item = $(el)
    const externalId = $item.attr('data-id-storage-item-id')
    if (!externalId || seenIds.has(externalId)) return
    seenIds.add(externalId)

    const $card = $item.find(SELECTORS.card)
    const $titleLink = $card.find(SELECTORS.titleLink)

    // Title is the first <p> inside <h3>
    const $h3 = $titleLink.find('h3')
    const title = $h3.find('p').first().text().trim()

    // Company is the second <p> (tw-typo-s) inside <h3>
    const company = $h3.find('p.tw-typo-s').text().trim()

    // URL from the title link
    const relativeUrl = $titleLink.attr('href') ?? ''
    const url = relativeUrl ? `${BASE_URL}${relativeUrl}` : ''

    // Location and contract type from tag elements
    const location = $card.find(SELECTORS.location).text().trim()
    const contractType = $card.find(SELECTORS.contract).text().trim() || undefined

    // Salary (optional)
    const salary = $card.find(SELECTORS.salary).text().trim() || undefined

    // Date — relative text in the bottom area
    const dateText = $card.find('.tw-text-grey-500').text().trim()
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
      contractType,
      salary,
    })
  })

  return offers
}

async function scrapeKeywordPass(
  keyword: string,
  location: string,
  maxResults: number,
  seenIds: Set<string>,
): Promise<JobOffer[]> {
  const maxPages = Math.ceil(maxResults / RESULTS_PER_PAGE)
  const offers: JobOffer[] = []

  for (let page = 1; page <= maxPages; page++) {
    const url = buildSearchUrl(keyword, location, page)
    console.log(`[${TAG}] Fetching page ${page}: ${url}`)

    const { html, blocked } = await fetchWithRetry(url, { tag: TAG })

    if (blocked) {
      console.warn(`[${TAG}] Blocked on page ${page}, stopping with partial results`)
      break
    }

    const pageOffers = parsePage(html, seenIds)

    if (pageOffers.length === 0) {
      console.log(`[${TAG}] No new results on page ${page}, stopping`)
      break
    }

    offers.push(...pageOffers)
    console.log(
      `[${TAG}] Page ${page}: ${pageOffers.length} new offers (pass total: ${offers.length})`,
    )

    if (offers.length >= maxResults) break

    if (page < maxPages) {
      await randomDelay(DELAY_MIN_MS, DELAY_MAX_MS)
    }
  }

  return offers
}

async function scrape(params: SearchParams): Promise<JobOffer[]> {
  const maxResults = params.maxResults ?? 100
  const seenIds = new Set<string>()
  const allOffers: JobOffer[] = []
  const location = params.location || ''

  const keywords =
    params.keywords.length > 0 ? params.keywords : [undefined as string | undefined]

  console.log(
    `[${TAG}] Starting scrape (keywords: [${params.keywords.join(', ')}], location: "${location}", maxResults: ${maxResults})`,
  )

  for (const keyword of keywords) {
    console.log(`[${TAG}] --- Keyword pass: "${keyword ?? '(all)'}" ---`)

    const offers = await scrapeKeywordPass(
      keyword ?? '',
      location,
      maxResults,
      seenIds,
    )
    allOffers.push(...offers)

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

export const hellowork: JobSource = {
  id: TAG,
  name: 'HelloWork',
  baseUrl: BASE_URL,
  scrape,
}
