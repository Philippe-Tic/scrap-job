export interface JobOffer {
  sourceId: string
  externalId: string
  title: string
  company: string
  location: string
  url: string
  publishedAt: Date | null
  contractType?: string
  salary?: string
  description?: string
  tags?: string[]
  raw?: Record<string, unknown>
}

export interface ScrapeResult {
  source: string
  success: boolean
  jobsFound: number
  jobsNew: number
  errors?: string[]
  duration: number
}

export interface JobSource {
  name: string
  id: string
  baseUrl: string
  scrape(params: SearchParams): Promise<JobOffer[]>
}

export interface SearchParams {
  keywords: string[]
  location: string
  radius?: number
  contractTypes?: string[]
  maxResults?: number
}
