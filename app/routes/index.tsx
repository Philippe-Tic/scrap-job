import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Offres d'emploi</h1>
        <button
          type="button"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          onClick={() => {
            fetch('/api/scrape', { method: 'POST' })
              .then((res) => res.json())
              .then((data) => console.log('Scrape result:', data))
          }}
        >
          Lancer un scrape
        </button>
      </div>

      <div>
        <input
          type="text"
          placeholder="Rechercher une offre..."
          className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="rounded-md border border-gray-200 bg-white p-8 text-center text-gray-500">
        <p className="text-lg">Aucune offre pour le moment</p>
        <p className="mt-1 text-sm">
          Lancez un scrape pour commencer à collecter des offres.
        </p>
      </div>
    </div>
  )
}
