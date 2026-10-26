import type { ContentInput } from '@/modules/content/policy'
import { contentAssetUrl } from '@/modules/content/policy'
import { useI18n } from './providers'
import { Badge } from './ui/badge'
export function ContentReading({
  entry,
  preview = false,
}: {
  entry: ContentInput
  preview?: boolean
}) {
  const { t } = useI18n()
  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">
          {t(
            entry.kind === 'help'
              ? 'content_help'
              : entry.kind === 'announcement'
                ? 'content_announcement'
                : 'content_article',
          )}
        </Badge>
        {entry.category && <Badge variant="secondary">{entry.category}</Badge>}
      </div>
      <h1 className="break-words text-3xl font-semibold tracking-tight sm:text-5xl">
        {entry.title}
      </h1>
      {entry.summary && <p className="text-lg leading-8 text-muted-foreground">{entry.summary}</p>}
      {entry.coverAssetId && (
        <img
          className="aspect-video w-full rounded-xl border object-cover"
          src={contentAssetUrl(entry.coverAssetId, preview)}
          alt={entry.title}
        />
      )}
      <div className="space-y-6 border-t pt-8">
        {entry.body
          .split(/\n\s*\n/)
          .filter(Boolean)
          .map((p, i) => (
            <p key={i} className="whitespace-pre-wrap break-words text-base leading-8">
              {p}
            </p>
          ))}
      </div>
    </article>
  )
}
