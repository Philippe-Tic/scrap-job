import { createFileRoute } from '@tanstack/react-router'
import { getSourceStatuses } from '../../../server/api/sources'

export const Route = createFileRoute('/api/sources')({
  server: {
    handlers: {
      GET: async () => {
        const sources = await getSourceStatuses()
        return Response.json(sources)
      },
    },
  },
})
