import { z } from 'zod'
import type { JobOffer } from './types'

const jobOfferSchema = z.object({
  sourceId: z.string().min(1).max(100),
  externalId: z.string().min(1).max(200),
  title: z.string().min(1).max(500),
  company: z.string().min(1).max(300),
  location: z.string().min(1).max(300),
  url: z.string().url().max(2000),
  publishedAt: z.date().nullable(),
  contractType: z.string().max(200).optional(),
  salary: z.string().max(200).optional(),
  description: z.string().max(50000).optional(),
  tags: z.array(z.string().max(100)).optional(),
  raw: z.record(z.unknown()).optional(),
})

export function validateJobOffers(offers: JobOffer[]): {
  valid: JobOffer[]
  invalid: { offer: JobOffer; errors: string[] }[]
} {
  const valid: JobOffer[] = []
  const invalid: { offer: JobOffer; errors: string[] }[] = []

  for (const offer of offers) {
    const result = jobOfferSchema.safeParse(offer)
    if (result.success) {
      valid.push(offer)
    } else {
      const errors = result.error.issues.map(
        (i) => `${i.path.join('.')}: ${i.message}`,
      )
      console.warn(
        `[validation] Skipping invalid offer "${offer.title}" (${offer.externalId}):`,
        errors,
      )
      invalid.push({ offer, errors })
    }
  }

  return { valid, invalid }
}
