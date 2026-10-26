import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Plus, Search } from 'lucide-react'
import { useI18n } from '@/components/providers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/patterns/page-patterns'
import { ContentHeading } from '@/components/patterns/content-patterns'
import { ErrorNotice } from '@/components/common'

type Category = 'writing' | 'research' | 'workflow'
type Entry = { id: string; name: string; category: Category; summary: string }
export function DirectoryBlueprint() {
  const { t } = useI18n()
  const categories = {
    all: t('bp_all'),
    writing: t('bp_writing'),
    research: t('bp_research'),
    workflow: t('bp_workflow'),
  }
  const [added, setAdded] = useState<Entry[]>([])
  const entries: Entry[] = [
    { id: 'pebble', name: 'Pebble Notes', category: 'writing', summary: t('bp_resource_one') },
    { id: 'margin', name: 'Margin Index', category: 'research', summary: t('bp_resource_two') },
    { id: 'quiet', name: 'Quiet Queue', category: 'workflow', summary: t('bp_resource_three') },
    { id: 'draft', name: 'Draft Room', category: 'writing', summary: t('bp_resource_four') },
    ...added,
  ]
  const [query, setQuery] = useState(''),
    [category, setCategory] = useState('all'),
    [selected, setSelected] = useState<string | null>(null)
  const [open, setOpen] = useState(false),
    [name, setName] = useState(''),
    [summary, setSummary] = useState(''),
    [newCategory, setNewCategory] = useState<Category>('writing'),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('')
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (selected) heading.current?.focus()
  }, [selected])
  const entry = entries.find((item) => item.id === selected)
  const filtered = entries.filter(
    (item) =>
      (category === 'all' || item.category === category) &&
      `${item.name} ${item.summary}`.toLowerCase().includes(query.trim().toLowerCase()),
  )
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim() || !summary.trim()) {
      setError(t('bp_required'))
      return
    }
    setAdded((items) => [
      ...items,
      {
        id: crypto.randomUUID(),
        name: name.trim(),
        summary: summary.trim(),
        category: newCategory,
      },
    ])
    setOpen(false)
    setName('')
    setSummary('')
    setError('')
    setNotice(t('bp_added'))
    setQuery('')
    setCategory('all')
  }
  return (
    <div className="min-w-0 rounded-2xl border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b px-6 py-5 sm:px-9">
        <span className="flex items-center gap-2 font-semibold">
          <BookOpen className="size-5 text-primary" /> Margin{' '}
          <Badge variant="outline">{t('bp_fictional')}</Badge>
        </span>
        <Button
          variant="outline"
          onClick={() => {
            setOpen(true)
            setError('')
          }}
        >
          <Plus />
          {t('bp_submit_resource')}
        </Button>
      </header>
      {entry ? (
        <div className="p-6 sm:p-9">
          <Button variant="ghost" onClick={() => setSelected(null)}>
            <ArrowLeft />
            {t('bp_back_directory')}
          </Button>
          <div className="mt-7 grid gap-10 lg:grid-cols-[minmax(0,1fr)_14rem]">
            <article className="min-w-0 break-words">
              <Badge variant="secondary">{categories[entry.category]}</Badge>
              <h2
                ref={heading}
                tabIndex={-1}
                className="mt-4 text-3xl font-semibold tracking-tight outline-none"
              >
                {entry.name}
              </h2>
              <p className="mt-4 text-lg leading-8 text-muted-foreground">{entry.summary}</p>
              <p className="mt-5 border-l-2 border-primary pl-4 text-sm leading-7 text-muted-foreground">
                {t('bp_article_notice')}
              </p>
              <div className="mt-6 lg:hidden">
                <ArticleContents />
              </div>
              <section id="directory-overview" className="scroll-mt-6 pt-9">
                <h3 className="text-xl font-semibold">{t('bp_article_overview')}</h3>
                <p className="mt-4 text-sm leading-8 text-muted-foreground">
                  {t('bp_article_overview_body')}
                </p>
              </section>
              <section id="directory-use" className="scroll-mt-6 pt-9">
                <h3 className="text-xl font-semibold">{t('bp_article_use')}</h3>
                <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-7 text-muted-foreground">
                  {(
                    ['bp_article_step_one', 'bp_article_step_two', 'bp_article_step_three'] as const
                  ).map((key) => (
                    <li key={key}>{t(key)}</li>
                  ))}
                </ol>
              </section>
              <section id="directory-limits" className="scroll-mt-6 pt-9">
                <h3 className="text-xl font-semibold">{t('bp_article_limits')}</h3>
                <p className="mt-4 text-sm leading-8 text-muted-foreground">
                  {t('bp_article_limits_body')}
                </p>
              </section>
            </article>
            <aside className="space-y-8 lg:border-l lg:pl-6">
              <div className="hidden lg:block">
                <ArticleContents />
              </div>
              <div>
                <h3 className="mb-4 text-sm font-medium">{t('bp_related')}</h3>
                {entries
                  .filter((item) => item.id !== entry.id)
                  .slice(0, 2)
                  .map((item) => (
                    <div key={item.id} className="mb-3">
                      <Button
                        variant="outline"
                        className="w-full justify-between"
                        onClick={() => setSelected(item.id)}
                      >
                        {item.name}
                        <ArrowRight />
                      </Button>
                    </div>
                  ))}
              </div>
            </aside>
          </div>
        </div>
      ) : (
        <div className="p-6 sm:p-9">
          <div className="grid items-end gap-6 border-b pb-8 lg:grid-cols-[1.4fr_1fr]">
            <ContentHeading
              eyebrow={t('bp_directory_kicker')}
              title={t('bp_directory_headline')}
              description={t('bp_directory_body')}
            />
            <p className="text-sm leading-7 text-muted-foreground">{t('bp_directory_note')}</p>
          </div>
          <div className="my-6 flex flex-wrap gap-3">
            <div className="relative min-w-0 flex-1 basis-56">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                aria-label={t('bp_search_resources')}
                placeholder={t('bp_search_resources')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Select
              value={category}
              onValueChange={(value) => setCategory(value ?? 'all')}
              items={categories}
            >
              <SelectTrigger className="w-full sm:w-44" aria-label={t('bp_category')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(categories).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p role="status" className="mb-4 text-xs text-muted-foreground">
            {notice && <span>{notice} · </span>}
            {t('bp_results', { count: filtered.length })}
          </p>
          {filtered.length ? (
            <div className="divide-y border-t">
              {filtered.map((item, index) => (
                <article
                  key={item.id}
                  className="grid gap-5 py-6 sm:grid-cols-[3rem_minmax(0,1fr)_auto]"
                >
                  <span
                    aria-hidden
                    className="grid size-12 place-items-center rounded-lg border bg-muted/50 font-mono text-primary"
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0 break-words">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="min-w-0 max-w-full break-words font-semibold">{item.name}</h3>
                      <Badge variant="secondary">{categories[item.category]}</Badge>
                    </div>
                    <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
                      {item.summary}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="justify-self-start sm:self-center"
                    onClick={() => setSelected(item.id)}
                    aria-label={t('bp_open_resource', { name: item.name })}
                  >
                    {t('bp_read_guide')}
                    <ArrowRight />
                  </Button>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Search />}
              title={t('bp_no_resources')}
              description={t('bp_no_resources_body')}
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setQuery('')
                    setCategory('all')
                  }}
                >
                  {t('bp_clear_filters')}
                </Button>
              }
            />
          )}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('bp_submit_resource')}</DialogTitle>
            <DialogDescription>{t('bp_contribute_notice')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="resource-name">{t('bp_resource_name')}</Label>
              <Input
                id="resource-name"
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="resource-category">{t('bp_category')}</Label>
              <Select
                value={newCategory}
                onValueChange={(value) => {
                  if (value === 'writing' || value === 'research' || value === 'workflow')
                    setNewCategory(value)
                }}
                items={categories}
              >
                <SelectTrigger id="resource-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['writing', 'research', 'workflow'] as const).map((value) => (
                    <SelectItem key={value} value={value}>
                      {categories[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="resource-summary">{t('bp_resource_summary')}</Label>
              <Textarea
                id="resource-summary"
                required
                maxLength={300}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
              />
            </div>
            {error && <ErrorNotice>{error}</ErrorNotice>}
            <DialogFooter>
              <Button type="submit">{t('bp_add_preview')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ArticleContents() {
  const { t } = useI18n()
  return (
    <nav aria-label={t('bp_contents')} className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {t('bp_contents')}
      </p>
      {[
        ['directory-overview', t('bp_article_overview')],
        ['directory-use', t('bp_article_use')],
        ['directory-limits', t('bp_article_limits')],
      ].map(([id, label]) => (
        <a
          key={id}
          href={'#' + id}
          className="block text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
        >
          {label}
        </a>
      ))}
    </nav>
  )
}
