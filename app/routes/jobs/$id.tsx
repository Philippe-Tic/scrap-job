import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/jobs/$id')({
  component: JobDetail,
})

function JobDetail() {
  const { id } = Route.useParams()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Offre #{id}</h1>
      <div className="rounded-md border border-gray-200 bg-white p-6 text-gray-500">
        <p>Détail de l'offre à implémenter.</p>
      </div>
    </div>
  )
}
