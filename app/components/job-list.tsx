import { SearchX } from 'lucide-react'
import { JobCard } from '~/components/job-card'
import type { Job } from '~/lib/types'

interface JobListProps {
  jobs: Job[]
  onToggleFavorite: (id: number, current: boolean) => void
  onToggleHidden: (id: number) => void
}

export function JobList({ jobs, onToggleFavorite, onToggleHidden }: JobListProps) {
  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl bg-secondary/30 p-12 text-center">
        <SearchX className="size-12 text-muted-foreground" />
        <p className="text-lg font-medium text-foreground">Aucune offre trouvée</p>
        <p className="text-sm text-muted-foreground">
          Essayez de modifier votre recherche ou lancez un scrape pour collecter de nouvelles offres.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      {jobs.map((job) => (
        <JobCard
          key={job.id}
          job={job}
          onToggleFavorite={onToggleFavorite}
          onToggleHidden={onToggleHidden}
        />
      ))}
    </div>
  )
}
