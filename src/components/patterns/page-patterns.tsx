import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Empty } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { useI18n } from '@/components/providers'

export function ListToolbar({
  search,
  filters,
  actions,
}: {
  search: ReactNode
  filters?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="w-full sm:max-w-xs">{search}</div>
      <div className="flex max-w-full flex-wrap items-center gap-3">
        {filters}
        {actions}
      </div>
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}) {
  return <Empty titleAs="h2" icon={icon} title={title} description={description} action={action} />
}

export function SettingsSection({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section
      aria-labelledby={id}
      className="grid gap-5 border-b py-7 first:pt-0 last:border-b-0 lg:grid-cols-[14rem_minmax(0,1fr)]"
    >
      <div>
        <h2 id={id} className="text-sm font-semibold">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      <div className="min-w-0 rounded-xl border bg-card p-5 sm:p-6">{children}</div>
    </section>
  )
}

export function DetailList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-y">
      {items.map(({ label, value }) => (
        <div key={label} className="grid gap-2 py-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className="min-w-0 whitespace-pre-wrap break-words text-sm leading-6">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

// For a complete in-memory result set; remote datasets must supply server totals.
export function Pagination({
  page,
  pageCount,
  total,
  onPageChange,
}: {
  page: number
  pageCount: number
  total: number
  onPageChange: (page: number) => void
}) {
  const { t } = useI18n()
  return (
    <nav
      aria-label={t('pagination')}
      className="mt-5 flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-xs text-muted-foreground">
        {t('pagination_summary', { page, pages: pageCount, total })}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft />
          {t('previous_page')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          {t('next_page')}
          <ChevronRight />
        </Button>
      </div>
    </nav>
  )
}

export function ListSkeleton() {
  const { t } = useI18n()
  return (
    <div
      role="status"
      aria-label={t('loading')}
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
    >
      <span className="sr-only">{t('loading')}</span>
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-4 rounded-xl border bg-card p-5">
          <Skeleton className="size-10" />
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="mt-6 h-8 w-24" />
        </div>
      ))}
    </div>
  )
}
