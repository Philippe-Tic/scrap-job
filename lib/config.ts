import type { SearchParams } from './scrapers/types'

export function getSearchDefaults(): SearchParams {
  return {
    keywords:
      process.env.DEFAULT_SEARCH_KEYWORDS?.split(',')
        .map((s) => s.trim())
        .filter(Boolean) ?? [],
    location: process.env.DEFAULT_SEARCH_LOCATION ?? '',
    radius: Number(process.env.DEFAULT_SEARCH_RADIUS_KM) || 50,
    maxResults: 100,
  }
}
