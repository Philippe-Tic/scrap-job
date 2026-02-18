import { createFileRoute } from '@tanstack/react-router'
import { triggerScrape } from '../../../server/api/scrape'

export const Route = createFileRoute('/api/scrape')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let options: {
          sourceIds?: string[]
          params?: { keywords?: string[]; location?: string; maxResults?: number }
        } = {}

        try {
          const contentType = request.headers.get('content-type')
          if (contentType?.includes('application/json')) {
            const body = await request.json()
            if (body && typeof body === 'object') {
              options = {
                sourceIds: Array.isArray(body.sourceIds)
                  ? body.sourceIds
                  : undefined,
                params: {
                  keywords: Array.isArray(body.keywords)
                    ? body.keywords
                    : undefined,
                  location:
                    typeof body.location === 'string'
                      ? body.location
                      : undefined,
                  maxResults:
                    typeof body.maxResults === 'number'
                      ? body.maxResults
                      : undefined,
                },
              }
            }
          }
        } catch {
          // Invalid JSON — proceed with defaults
        }

        const result = await triggerScrape(options)
        return Response.json(result)
      },
    },
  },
})
