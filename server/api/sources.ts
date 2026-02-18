import { SOURCE_DEFINITIONS } from '../../lib/scrapers/index'

export async function getSourceStatuses() {
  return SOURCE_DEFINITIONS.map((source) => ({
    id: source.id,
    name: source.name,
    baseUrl: source.baseUrl,
    status: 'idle' as const,
    lastScrapeAt: null,
    jobCount: 0,
  }))
}
