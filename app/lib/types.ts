export interface Job {
  id: number
  sourceId: string
  externalId: string
  title: string
  company: string
  location: string
  url: string
  publishedAt: string | null
  contractType: string | null
  salary: string | null
  description: string | null
  tags: string | null // JSON stringifié
  firstSeenAt: string
  lastSeenAt: string
  isActive: boolean | null
  isFavorite: boolean | null
  isHidden: boolean | null
  notes: string | null
}

export interface JobsResponse {
  jobs: Job[]
  total: number
  page: number
  perPage: number
  totalPages: number
}
