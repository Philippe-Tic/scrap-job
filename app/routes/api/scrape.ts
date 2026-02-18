import { createFileRoute } from '@tanstack/react-router'
import { triggerScrape } from '../../../server/api/scrape'

export const Route = createFileRoute('/api/scrape')({
  server: {
    handlers: {
      POST: async () => {
        const result = await triggerScrape()
        return Response.json(result)
      },
    },
  },
})
