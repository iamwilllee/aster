import { createFileRoute, Link } from '@tanstack/react-router'
import { getContentList } from '@/modules/content/functions'
import { contentAssetUrl } from '@/modules/content/policy'
import { useI18n } from '@/components/providers'
import { PageHeading } from '@/components/common'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Pagination, EmptyState } from '@/components/patterns/page-patterns'
import { FileText } from 'lucide-react'
export const Route = createFileRoute('/content/')({
  validateSearch: (
    s: Record<string, unknown>,
  ): { q?: string; kind?: string; category?: string; page?: number } => ({
    q: typeof s.q === 'string' ? s.q.slice(0, 80) : '',
    kind: ['article', 'help', 'announcement'].includes(String(s.kind)) ? String(s.kind) : '',
    category: typeof s.category === 'string' ? s.category.slice(0, 60) : '',
    page: Number.isInteger(Number(s.page)) ? Math.max(1, Math.min(10000, Number(s.page))) : 1,
  }),
  loaderDeps: ({ search }) => ({ ...search, locale: search._locale ?? 'en' }),
  loader: ({ deps }) => getContentList({ data: deps }),
  component: ContentIndex,
})
function ContentIndex() {
  const { t } = useI18n(),
    data = Route.useLoaderData(),
    search = Route.useSearch(),
    navigate = Route.useNavigate()
  const kinds = {
    '': t('content_all'),
    article: t('content_article'),
    help: t('content_help'),
    announcement: t('content_announcement'),
  }
  return (
    <>
      <PageHeading
        eyebrow="JOURNAL / HELP / UPDATES"
        title={t('content_title')}
        description={t('content_intro')}
      />
      <div className="mb-10 flex flex-wrap items-end gap-3">
        <form
          className="flex min-w-0 flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const form = new FormData(e.currentTarget)
            void navigate({
              search: (old) => ({
                ...old,
                q: typeof form.get('q') === 'string' ? (form.get('q') as string) : '',
                page: 1,
              }),
            })
          }}
        >
          <Input
            name="q"
            key={search.q}
            defaultValue={search.q}
            aria-label={t('content_search')}
            placeholder={t('content_search')}
            maxLength={80}
          />
          <Button type="submit">{t('content_search_submit')}</Button>
        </form>
        <Select
          value={search.kind ?? ''}
          items={kinds}
          onValueChange={(value) => {
            void navigate({ search: (old) => ({ ...old, kind: String(value ?? ''), page: 1 }) })
          }}
        >
          <SelectTrigger aria-label={t('content_kind')} className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(kinds).map(([v, label]) => (
              <SelectItem key={v} value={v}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={search.category ?? ''}
          items={{
            '': t('content_all_categories'),
            ...Object.fromEntries(data.categories.map((c) => [c, c])),
          }}
          onValueChange={(value) => {
            void navigate({ search: (old) => ({ ...old, category: String(value ?? ''), page: 1 }) })
          }}
        >
          <SelectTrigger aria-label={t('content_category')} className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t('content_all_categories')}</SelectItem>
            {data.categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {data.items.length ? (
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {data.items.map((item) => (
            <Link
              key={item.slug}
              to="/content/$slug"
              params={{ slug: item.slug }}
              className="group min-w-0 overflow-hidden rounded-xl border bg-card focus-visible:outline-2 focus-visible:outline-ring"
            >
              {item.coverAssetId && (
                <img
                  src={contentAssetUrl(item.coverAssetId)}
                  alt=""
                  className="aspect-video w-full object-cover"
                />
              )}
              <div className="space-y-3 p-6">
                <p className="text-xs text-muted-foreground">
                  {kinds[item.kind]}
                  {item.category ? ' / ' + item.category : ''}
                </p>
                <h2 className="break-words text-xl font-semibold group-hover:underline">
                  {item.title}
                </h2>
                <p className="break-words text-sm leading-7 text-muted-foreground">
                  {item.summary}
                </p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<FileText />}
          title={t('content_empty')}
          description={t('content_empty_body')}
        />
      )}
      <div className="mt-8">
        <Pagination
          page={data.page}
          pageCount={Math.max(1, Math.ceil(data.total / 12))}
          total={data.total}
          onPageChange={(page) => {
            void navigate({ search: (old) => ({ ...old, page }) })
          }}
        />
      </div>
    </>
  )
}
