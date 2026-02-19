import {
  Building2,
  MapPin,
  Calendar,
  Star,
  EyeOff,
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

const SOURCE_BADGE_CONFIG: Record<string, { label: string; className: string }> = {
  'emploi-territorial': { label: 'Emploi Territ.', className: 'border-blue-500/30 bg-blue-500/10 text-blue-400' },
  'hellowork':          { label: 'HelloWork',      className: 'border-orange-500/30 bg-orange-500/10 text-orange-400' },
  'indeed':             { label: 'Indeed',          className: 'border-purple-500/30 bg-purple-500/10 text-purple-400' },
  'isarta':             { label: 'Isarta',          className: 'border-teal-500/30 bg-teal-500/10 text-teal-400' },
  'linkedin':           { label: 'LinkedIn',        className: 'border-sky-500/30 bg-sky-500/10 text-sky-400' },
  'welcometothejungle': { label: 'WTTJ',            className: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400' },
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
    <Card className="group relative cursor-pointer gap-0 py-4 transition-all duration-200 hover:border-primary/30 hover:shadow-[0_0_15px_oklch(0.55_0.25_290/0.1)]">
      {/* Overlay link — couvre toute la card */}
      <a href={job.url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 z-0" aria-label={job.title} />

      <CardContent className="space-y-3">
        {/* Title */}
        <span className="line-clamp-2 font-semibold leading-tight text-foreground">
          {job.title}
        </span>

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
          {(() => {
            const cfg = SOURCE_BADGE_CONFIG[job.sourceId]
            return cfg ? (
              <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>
            ) : (
              <Badge variant="outline">{job.sourceId}</Badge>
            )
          })()}
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
        <div className="relative z-10 flex justify-end gap-1 pt-1">
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
