import { getSources, getSourceById } from '../../lib/scrapers/index'
import { validateJobOffers } from '../../lib/scrapers/validation'
import { insertJobs, insertScrapeRun, updateScrapeRun } from './jobs'
import type { ScrapeResult, SearchParams } from '../../lib/scrapers/types'

const DEFAULT_PARAMS: SearchParams = {
  keywords: [],
  location: '',
  maxResults: 100,
}

async function scrapeSource(
  sourceId: string,
  params: SearchParams,
): Promise<ScrapeResult> {
  const start = Date.now()
  const source = getSourceById(sourceId)

  if (!source) {
    return {
      source: sourceId,
      success: false,
      jobsFound: 0,
      jobsNew: 0,
      errors: [`Source "${sourceId}" not found`],
      duration: Date.now() - start,
    }
  }

  const runId = await insertScrapeRun(sourceId)

  try {
    console.log(`[scrape] Running source: ${source.name}`)

    const rawOffers = await source.scrape(params)
    const { valid, invalid } = validateJobOffers(rawOffers)

    const errors: string[] = []
    if (invalid.length > 0) {
      errors.push(`${invalid.length} offers failed validation`)
    }

    const { inserted, updated } = await insertJobs(valid)

    await updateScrapeRun(runId, {
      success: true,
      jobsFound: valid.length,
      jobsNew: inserted,
      errors: errors.length > 0 ? errors : undefined,
    })

    console.log(
      `[scrape] ${source.name}: ${valid.length} valid, ${inserted} new, ${updated} updated`,
    )

    return {
      source: sourceId,
      success: true,
      jobsFound: valid.length,
      jobsNew: inserted,
      errors: errors.length > 0 ? errors : undefined,
      duration: Date.now() - start,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[scrape] ${source.name} failed: ${message}`)

    await updateScrapeRun(runId, {
      success: false,
      jobsFound: 0,
      jobsNew: 0,
      errors: [message],
    })

    return {
      source: sourceId,
      success: false,
      jobsFound: 0,
      jobsNew: 0,
      errors: [message],
      duration: Date.now() - start,
    }
  }
}

export async function triggerScrape(options?: {
  sourceIds?: string[]
  params?: Partial<SearchParams>
}) {
  // Filter out undefined values so they don't overwrite defaults
  const overrides: Record<string, unknown> = {}
  if (options?.params) {
    for (const [key, value] of Object.entries(options.params)) {
      if (value !== undefined) overrides[key] = value
    }
  }
  const params: SearchParams = { ...DEFAULT_PARAMS, ...overrides } as SearchParams

  // Determine which sources to run
  const allSources = getSources()
  const sourceIds =
    options?.sourceIds && options.sourceIds.length > 0
      ? options.sourceIds
      : allSources.map((s) => s.id)

  if (sourceIds.length === 0) {
    return {
      success: false,
      message: 'No sources configured',
      results: [] as ScrapeResult[],
    }
  }

  console.log(
    `[scrape] Starting scrape for ${sourceIds.length} source(s): ${sourceIds.join(', ')}`,
  )

  // Run sources sequentially to respect rate limits
  const results: ScrapeResult[] = []
  for (const sourceId of sourceIds) {
    const result = await scrapeSource(sourceId, params)
    results.push(result)
  }

  const successCount = results.filter((r) => r.success).length
  const totalJobs = results.reduce((sum, r) => sum + r.jobsFound, 0)
  const totalNew = results.reduce((sum, r) => sum + r.jobsNew, 0)

  return {
    success: successCount > 0,
    message: `Scraped ${successCount}/${results.length} sources: ${totalJobs} jobs found, ${totalNew} new`,
    results,
  }
}
