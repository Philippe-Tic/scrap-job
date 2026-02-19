import { randomDelay } from '../utils'
import { filterByTitle, filterByLocation } from './utils'
import type { JobSource, JobOffer, SearchParams } from './types'

const TAG = 'welcometothejungle'
const BASE_URL = 'https://www.welcometothejungle.com'
const ALGOLIA_URL = 'https://CSEKHVMS53-dsn.algolia.net/1/indexes/wttj_jobs_production_fr/query'
const ALGOLIA_APP_ID = 'CSEKHVMS53'
const ALGOLIA_API_KEY = '4bd8f6215d0cc52b26430765769e65a0'
const HITS_PER_PAGE = 20
const DELAY_MIN_MS = 1000
const DELAY_MAX_MS = 2000

const CONTRACT_TYPE_MAP: Record<string, string> = {
  full_time: 'CDI',
  part_time: 'Temps partiel',
  temporary: 'CDD',
  internship: 'Stage',
  freelance: 'Freelance',
  apprenticeship: 'Alternance',
  vie: 'VIE',
  other: 'Autre',
}

interface AlgoliaHit {
  objectID: string
  name: string
  slug: string
  organization: {
    name: string
    slug: string
  }
  offices: Array<{
    city: string
    state: string
    country: string
  }>
  contract_type: string
  remote: string | null
  salary_minimum: number | null
  salary_maximum: number | null
  salary_period: string | null
  salary_currency: string | null
  published_at: string
  reference: string
}

interface AlgoliaResponse {
  hits: AlgoliaHit[]
  nbHits: number
  page: number
  nbPages: number
  hitsPerPage: number
}

async function searchJobs(query: string, page: number): Promise<AlgoliaResponse> {
  const params = new URLSearchParams({
    query,
    hitsPerPage: String(HITS_PER_PAGE),
    page: String(page),
  })

  const response = await fetch(ALGOLIA_URL, {
    method: 'POST',
    headers: {
      'X-Algolia-Application-Id': ALGOLIA_APP_ID,
      'X-Algolia-API-Key': ALGOLIA_API_KEY,
      'Content-Type': 'application/json',
      Referer: `${BASE_URL}/`,
    },
    body: JSON.stringify({ params: params.toString() }),
  })

  if (!response.ok) {
    throw new Error(`Algolia API error: HTTP ${response.status} ${response.statusText}`)
  }

  return response.json() as Promise<AlgoliaResponse>
}

function formatSalary(hit: AlgoliaHit): string | undefined {
  if (!hit.salary_minimum && !hit.salary_maximum) return undefined
  const currency = hit.salary_currency ?? '€'
  const period = hit.salary_period === 'yearly' ? '/an' : hit.salary_period === 'monthly' ? '/mois' : ''
  if (hit.salary_minimum && hit.salary_maximum) {
    return `${hit.salary_minimum.toLocaleString('fr-FR')} - ${hit.salary_maximum.toLocaleString('fr-FR')} ${currency} ${period}`.trim()
  }
  const value = hit.salary_minimum ?? hit.salary_maximum
  return `${value!.toLocaleString('fr-FR')} ${currency} ${period}`.trim()
}

function mapHitToJobOffer(hit: AlgoliaHit): JobOffer {
  const office = hit.offices?.[0]
  const location = office
    ? [office.city, office.state].filter(Boolean).join(', ')
    : 'Non renseigné'

  const contractLabel = CONTRACT_TYPE_MAP[hit.contract_type] ?? hit.contract_type
  const remoteLabel = hit.remote === 'fulltime' ? 'Full remote'
    : hit.remote === 'partial' ? 'Télétravail partiel'
    : undefined

  const tags: string[] = []
  if (remoteLabel) tags.push(remoteLabel)

  return {
    sourceId: TAG,
    externalId: hit.objectID,
    title: hit.name,
    company: hit.organization?.name ?? 'Non renseigné',
    location,
    url: `${BASE_URL}/fr/companies/${hit.organization?.slug}/jobs/${hit.slug}`,
    publishedAt: hit.published_at ? new Date(hit.published_at) : null,
    contractType: contractLabel,
    salary: formatSalary(hit),
    tags: tags.length > 0 ? tags : undefined,
  }
}

async function scrapeKeywordPass(
  keyword: string,
  maxResults: number,
  seenIds: Set<string>,
): Promise<JobOffer[]> {
  const maxPages = Math.ceil(maxResults / HITS_PER_PAGE)
  const offers: JobOffer[] = []

  for (let page = 0; page < maxPages; page++) {
    console.log(`[${TAG}] Fetching page ${page + 1} for query "${keyword}"`)

    let data: AlgoliaResponse
    try {
      data = await searchJobs(keyword, page)
    } catch (error) {
      console.error(`[${TAG}] Algolia API error on page ${page + 1}:`, error)
      break
    }

    if (data.hits.length === 0) {
      console.log(`[${TAG}] No results on page ${page + 1}, stopping`)
      break
    }

    let newCount = 0
    for (const hit of data.hits) {
      if (seenIds.has(hit.objectID)) continue
      seenIds.add(hit.objectID)
      offers.push(mapHitToJobOffer(hit))
      newCount++
    }

    console.log(
      `[${TAG}] Page ${page + 1}: ${newCount} new offers (pass total: ${offers.length}, API total: ${data.nbHits})`,
    )

    if (newCount === 0 || offers.length >= maxResults || page + 1 >= data.nbPages) {
      break
    }

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

  // Build query combining keywords and location for Algolia full-text search
  const keywords =
    params.keywords.length > 0 ? params.keywords : [undefined as string | undefined]

  console.log(
    `[${TAG}] Starting scrape (keywords: [${params.keywords.join(', ')}], location: "${params.location || 'none'}", maxResults: ${maxResults})`,
  )

  for (const keyword of keywords) {
    const query = [keyword, params.location].filter(Boolean).join(' ')
    console.log(`[${TAG}] --- Keyword pass: "${query}" ---`)

    const offers = await scrapeKeywordPass(query, maxResults, seenIds)
    allOffers.push(...offers)

    if (keywords.length > 1 && keyword !== keywords[keywords.length - 1]) {
      await randomDelay(DELAY_MIN_MS, DELAY_MAX_MS)
    }
  }

  // Post-scrape title filter
  const filtered = filterByTitle(allOffers, params.keywords)
  const titleDropped = allOffers.length - filtered.length
  if (titleDropped > 0) {
    console.log(
      `[${TAG}] Title filter: kept ${filtered.length}/${allOffers.length} (${titleDropped} dropped)`,
    )
  }

  // Post-scrape location filter (Algolia full-text mixes keyword+location → results can be anywhere)
  const locationFiltered = params.location
    ? filterByLocation(filtered, params.location)
    : filtered
  const locationDropped = filtered.length - locationFiltered.length
  if (locationDropped > 0) {
    console.log(
      `[${TAG}] Location filter: kept ${locationFiltered.length}/${filtered.length} (${locationDropped} dropped)`,
    )
  }

  console.log(
    `[${TAG}] Done: ${locationFiltered.length} offers collected (${seenIds.size} unique IDs seen)`,
  )

  return locationFiltered
}

export const welcometothejungle: JobSource = {
  id: TAG,
  name: 'Welcome to the Jungle',
  baseUrl: BASE_URL,
  scrape,
}
