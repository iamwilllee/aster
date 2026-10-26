import { createFileRoute, notFound, Link } from '@tanstack/react-router'
import { getContentDetail } from '@/modules/content/functions'
import { ContentReading } from '@/components/content-reading'
import { useI18n } from '@/components/providers'
export const Route = createFileRoute('/content/$slug')({
  loaderDeps: ({ search }) => ({ locale: search._locale ?? 'en' }),
  loader: async ({ params, deps }) => {
    const entry = await getContentDetail({ data: { locale: deps.locale, slug: params.slug } })
    if (!entry) throw notFound()
    return entry
  },
  head: ({ loaderData: entry }) => ({
    meta: entry
      ? [
          { title: entry.seoTitle || entry.title },
          { name: 'description', content: entry.seoDescription || entry.summary },
        ]
      : [],
  }),
  component: Detail,
})
function Detail() {
  const entry = Route.useLoaderData(),
    { t } = useI18n()
  return (
    <main className="py-8">
      <div className="mx-auto mb-10 max-w-3xl">
        <Link to="/content" className="text-sm text-muted-foreground hover:underline">
          ← {t('content_back')}
        </Link>
        <p className="mt-6 text-xs text-muted-foreground">
          <time dateTime={new Date(entry.publishedAt).toISOString()}>
            {new Date(entry.publishedAt).toISOString().slice(0, 10)}
          </time>
        </p>
      </div>
      <ContentReading entry={entry} />
    </main>
  )
}
