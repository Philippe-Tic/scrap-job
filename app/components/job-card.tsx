import {
  Building2,
  MapPin,
  Calendar,
  Star,
  EyeOff,
  ExternalLink,
} from 'lucide-react'
import { Card, CardContent } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import type { Job } from '~/lib/types'

interface JobCardProps {
  job: Job
  onToggleFavorite: (id: number, current: boolean) => void
  onToggleHidden: (id: number) => void
}

function parseTags(tags: string | null): string[] {
  if (!tags) return []
  try {
    return JSON.parse(tags)
  } catch {
    return []
  }
}

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(dateStr))
  } catch {
    return dateStr
  }
}

export function JobCard({ job, onToggleFavorite, onToggleHidden }: JobCardProps) {
  const tags = parseTags(job.tags)
  const displayedTags = tags.slice(0, 5)
  const extraTagsCount = tags.length - displayedTags.length
  const isFavorite = job.isFavorite ?? false

  return (
    <Card className="group relative gap-0 py-4 transition-colors hover:border-foreground/20">
      {/* External link icon on hover */}
      <a
        href={job.url}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100"
        aria-label="Ouvrir l'offre originale"
      >
        <ExternalLink className="size-4 text-muted-foreground hover:text-foreground" />
      </a>

      <CardContent className="space-y-3">
        {/* Title */}
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          className="line-clamp-2 font-semibold leading-tight text-foreground hover:underline"
        >
          {job.title}
        </a>

        {/* Meta info */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Building2 className="size-3.5" />
            {job.company}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-3.5" />
            {job.location}
          </span>
          {job.publishedAt && (
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="size-3.5" />
              {formatDate(job.publishedAt)}
            </span>
          )}
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-2">
          {job.contractType && (
            <Badge variant="secondary">{job.contractType}</Badge>
          )}
          {job.salary && (
            <Badge variant="outline">{job.salary}</Badge>
          )}
          {displayedTags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
          {extraTagsCount > 0 && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              +{extraTagsCount}
            </Badge>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-1 pt-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onToggleFavorite(job.id, isFavorite)}
            aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          >
            <Star
              className={
                isFavorite
                  ? 'size-4 fill-yellow-400 text-yellow-400'
                  : 'size-4 text-muted-foreground'
              }
            />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onToggleHidden(job.id)}
            aria-label="Masquer cette offre"
          >
            <EyeOff className="size-4 text-muted-foreground" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
