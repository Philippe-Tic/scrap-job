// Stub — will implement cross-source fuzzy deduplication

import type { JobOffer } from './scrapers/types'

export function deduplicateJobs(jobs: JobOffer[]): JobOffer[] {
  // Pass 1: exact dedup handled by DB unique index (source_id, external_id)
  // Pass 2: fuzzy cross-source dedup (to implement)
  return jobs
}
