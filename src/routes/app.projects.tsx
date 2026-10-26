import { AssetPreview, FilePicker } from '@/components/file-library'
import { features } from '@/config/features'
import { notFound } from '@tanstack/react-router'
import { formText } from '@/lib/forms'
import { createFileRoute, getRouteApi, useRouter } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import {
  Plus,
  Search,
  FolderKanban,
  ArrowUpRight,
  Pencil,
  Trash2,
  Filter,
  LayoutGrid,
  List,
  MoreHorizontal,
  Eye,
} from 'lucide-react'
import { PageHeading, ErrorNotice } from '@/components/common'
import {
  ListToolbar,
  EmptyState,
  DetailList,
  Pagination,
  ListSkeleton,
} from '@/components/patterns/page-patterns'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { useToast } from '@/components/ui/use-toast'
import { useI18n } from '@/components/providers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { api } from '@/lib/api'
import type { Project, ProjectInput } from '@/modules/projects/validation'

type Status = 'all' | ProjectInput['status']
export const Route = createFileRoute('/app/projects')({
  beforeLoad: () => {
    if (!features.projects) throw notFound()
  },
  validateSearch: (
    search: Record<string, unknown>,
  ): { q?: string; status?: Status; view?: 'cards' | 'table'; page?: number } => ({
    q: typeof search.q === 'string' ? search.q.slice(0, 80) : '',
    status: ['idea', 'building', 'live'].includes(String(search.status))
      ? (search.status as Status)
      : 'all',
    view: search.view === 'table' ? 'table' : 'cards',
    page:
      Number.isSafeInteger(Number(search.page)) && Number(search.page) > 0
        ? Math.min(Number(search.page), 100)
        : 1,
  }),
  component: Projects,
})
function Projects() {
  const { t, locale } = useI18n()
  const { q = '', status = 'all', view = 'cards', page = 1 } = Route.useSearch()
  const toast = useToast()
  const navigate = Route.useNavigate()
  const viewer = getRouteApi('/app').useLoaderData()
  const router = useRouter()
  const cache = useQueryClient()
  const [cover, setCover] = useState<string | null>(null)
  const [editor, setEditor] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [deleting, setDeleting] = useState<Project | null>(null)
  const [detail, setDetail] = useState<Project | null>(null)
  const params = new URLSearchParams({ q, status })
  const query = useQuery({
    queryKey: ['projects', q, status],
    queryFn: () => api<Project[]>(`/api/projects?${params}`),
  })
  const labels = {
    idea: t('idea'),
    building: t('building'),
    live: t('live'),
  }
  const pageCount = Math.max(1, Math.ceil((query.data?.length ?? 0) / 6))
  const currentPage = Math.min(page, pageCount)
  const records = query.data?.slice((currentPage - 1) * 6, currentPage * 6) ?? []
  const date = (value: number) =>
    new Date(value).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US')
  async function refresh() {
    await cache.invalidateQueries({ queryKey: ['projects'] })
    if (features.files) await cache.invalidateQueries({ queryKey: ['files', viewer.user.id] })
    await router.invalidate()
  }
  const save = useMutation({
    mutationFn: (data: ProjectInput) =>
      api(editing ? `/api/projects/${editing.id}` : '/api/projects', {
        method: editing ? 'PATCH' : 'POST',
        data,
      }),
    onSuccess: async () => {
      setEditor(false)
      setEditing(null)
      await refresh()
      toast.add({ title: t('project_saved'), type: 'success' })
    },
  })
  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/projects/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      setDeleting(null)
      await refresh()
      toast.add({ title: t('project_deleted'), type: 'success' })
    },
  })
  function openEditor(project: Project | null) {
    setCover(project?.cover_asset_id ?? null)
    setEditing(project)
    save.reset()
    setEditor(true)
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    save.mutate({
      name: formText(data, 'name'),
      description: formText(data, 'description'),
      status: formText(data, 'status') as ProjectInput['status'],
      ...(features.files ? { coverAssetId: cover } : {}),
    })
  }
  return (
    <>
      <PageHeading
        eyebrow="YOUR PROJECTS"
        title={t('your_projects')}
        description={t('a_place_for_every_idea_start_building_here')}
        action={
          <Button onClick={() => openEditor(null)}>
            <Plus size={15} />
            {t('new_project')}
          </Button>
        }
      />
      <Tabs
        value={view}
        onValueChange={(value) => {
          if (value === 'cards' || value === 'table')
            void navigate({
              search: (previous) => ({
                ...previous,
                view: value === 'cards' ? 'cards' : 'table',
              }),
            })
        }}
      >
        <ListToolbar
          search={
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(event) => {
                  void navigate({
                    search: (previous) => ({ ...previous, q: event.target.value, page: 1 }),
                    replace: true,
                  })
                }}
                className="bg-card pl-9"
                placeholder={t('search_projects')}
                aria-label={t('search_projects_label')}
              />
            </div>
          }
          filters={
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-muted-foreground" />
              <Select<Status>
                items={{ all: t('all_statuses'), ...labels }}
                value={status}
                onValueChange={(value) => {
                  if (value)
                    void navigate({
                      search: (previous) => ({ ...previous, status: value, page: 1 }),
                    })
                }}
              >
                <SelectTrigger aria-label={t('filter_project_status')} className="w-40 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all_statuses')}</SelectItem>
                  {Object.entries(labels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="ml-2 text-xs text-muted-foreground">
                {viewer.projectCount} / {viewer.billing.projectLimit}
              </span>
            </div>
          }
          actions={
            <TabsList aria-label={t('project_view')}>
              <TabsTrigger value="cards">
                <LayoutGrid />
                {t('card_view')}
              </TabsTrigger>
              <TabsTrigger value="table">
                <List />
                {t('table_view')}
              </TabsTrigger>
            </TabsList>
          }
        />
        <TabsContent value={view} className="pt-0">
          {query.isPending ? (
            <ListSkeleton />
          ) : query.isError ? (
            <div className="space-y-3">
              <ErrorNotice>{query.error.message}</ErrorNotice>
              <Button
                variant="outline"
                onClick={() => {
                  void query.refetch()
                }}
              >
                {t('retry')}
              </Button>
            </div>
          ) : !query.data.length ? (
            <EmptyState
              icon={<FolderKanban size={25} strokeWidth={1.4} />}
              title={
                q || status !== 'all'
                  ? t('no_matching_projects')
                  : t('your_first_project_starts_here')
              }
              description={
                q || status !== 'all'
                  ? t('try_a_different_search_or_filter')
                  : t('a_name_and_an_idea_are_a_good_place_to_begin')
              }
              action={
                !q && status === 'all' ? (
                  <Button className="mx-auto" variant="outline" onClick={() => openEditor(null)}>
                    <Plus size={14} />
                    {t('create_your_first_project')}
                  </Button>
                ) : undefined
              }
            />
          ) : view === 'table' ? (
            <div className="overflow-hidden rounded-xl border bg-card">
              <Table>
                <caption className="sr-only">{t('your_projects')}</caption>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('project_name')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead>{t('updated')}</TableHead>
                    <TableHead>
                      <span className="sr-only">{t('project_actions')}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell className="min-w-44">
                        <Button
                          variant="link"
                          className="max-w-64 justify-start px-0"
                          onClick={() => setDetail(project)}
                        >
                          <span className="truncate">{project.name}</span>
                        </Button>
                        <p className="mt-1 max-w-64 truncate text-xs text-muted-foreground">
                          {project.description || t('add_a_few_words_about_your_idea')}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={project.status === 'live' ? 'default' : 'secondary'}>
                          {labels[project.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {date(project.updated_at)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={t('actions_for', { name: project.name })}
                              />
                            }
                          >
                            <MoreHorizontal />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => setDetail(project)}>
                              <Eye />
                              {t('view_details')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditor(project)}>
                              <Pencil />
                              {t('edit')}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              destructive
                              onClick={() => {
                                remove.reset()
                                setDeleting(project)
                              }}
                            >
                              <Trash2 />
                              {t('delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {records.map((project) => (
                <article
                  key={project.id}
                  className="group flex min-h-56 flex-col rounded-xl border bg-card p-5 transition-shadow hover:shadow-sm"
                >
                  {features.files && project.cover_asset_id && (
                    <div className="mb-5 aspect-video overflow-hidden rounded-lg border">
                      <AssetPreview
                        key={project.cover_asset_id}
                        id={project.cover_asset_id}
                        alt={project.name}
                      />
                    </div>
                  )}
                  <div className="mb-6 flex items-center justify-between">
                    <span className="grid size-10 place-items-center rounded-lg border bg-background font-mono text-base text-primary">
                      {project.name.slice(0, 1).toUpperCase()}
                    </span>
                    <Badge
                      variant={project.status === 'live' ? 'default' : 'secondary'}
                      className="text-[10px]"
                    >
                      {labels[project.status]}
                    </Badge>
                  </div>
                  <h2 className="break-words text-sm font-semibold">{project.name}</h2>
                  <p className="mb-5 mt-2 line-clamp-3 whitespace-pre-wrap break-words text-xs leading-6 text-muted-foreground">
                    {project.description || t('add_a_few_words_about_your_idea')}
                  </p>
                  <div className="mt-auto flex items-center justify-between border-t pt-3">
                    <span className="text-[10px] text-muted-foreground">
                      {t('updated')}
                      {date(project.updated_at)}
                    </span>
                    <div className="flex">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t('details_for', { name: project.name })}
                        onClick={() => setDetail(project)}
                      >
                        <Eye size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`${t('edit')} ${project.name}`}
                        onClick={() => openEditor(project)}
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`${t('delete')} ${project.name}`}
                        onClick={() => {
                          remove.reset()
                          setDeleting(project)
                        }}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
          {query.isSuccess && query.data.length > 0 && (
            <Pagination
              page={currentPage}
              pageCount={pageCount}
              total={query.data.length}
              onPageChange={(next) => {
                void navigate({ search: (previous) => ({ ...previous, page: next }) })
              }}
            />
          )}
        </TabsContent>
      </Tabs>
      <p className="mt-6 flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="size-1.5 rounded-full bg-primary" />
        {t('saved_in_d1_and_private_to_your_account_filters_are_stored_in_the_url')}
      </p>
      <Dialog
        open={!!detail}
        onOpenChange={(open) => {
          if (!open) setDetail(null)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{detail?.name}</DialogTitle>
            <DialogDescription>{t('project_details_description')}</DialogDescription>
          </DialogHeader>
          {detail && (
            <>
              {features.files && detail?.cover_asset_id && (
                <div className="aspect-video overflow-hidden rounded-lg border">
                  <AssetPreview
                    key={detail.cover_asset_id}
                    id={detail.cover_asset_id}
                    alt={detail.name}
                  />
                </div>
              )}
              <DetailList
                items={[
                  {
                    label: t('status'),
                    value: <Badge variant="secondary">{labels[detail.status]}</Badge>,
                  },
                  {
                    label: t('a_short_description'),
                    value: detail.description || t('no_description'),
                  },
                  { label: t('created'), value: date(detail.created_at) },
                  { label: t('updated'), value: date(detail.updated_at) },
                ]}
              />
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetail(null)}>
              {t('close_dialog')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={editor}
        onOpenChange={(open) => {
          if (!save.isPending) setEditor(open)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t('edit_project') : t('give_your_idea_a_name')}</DialogTitle>
            <DialogDescription>
              {t('start_with_something_simple_you_can_change_it_anytime')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-5">
            <div className="grid gap-2">
              <Label htmlFor="project-name">{t('project_name')}</Label>
              <Input
                id="project-name"
                name="name"
                defaultValue={editing?.name ?? ''}
                placeholder={t('e_g_my_reading_list')}
                required
                maxLength={80}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="project-description">{t('a_short_description')}</Label>
              <Textarea
                id="project-description"
                name="description"
                rows={3}
                defaultValue={editing?.description ?? ''}
                maxLength={500}
                placeholder={t('what_would_you_like_to_build')}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="project-status">{t('status')}</Label>
              <Select name="status" items={labels} defaultValue={editing?.status ?? 'idea'}>
                <SelectTrigger id="project-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(labels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {save.error && <ErrorNotice>{save.error.message}</ErrorNotice>}
            {features.files && (
              <div className="grid gap-2">
                <Label>{t('files_cover')}</Label>
                <FilePicker
                  userId={viewer.user.id}
                  value={cover}
                  onChange={setCover}
                  disabled={save.isPending}
                />
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditor(false)}
                disabled={save.isPending}
              >
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? t('saving') : t('save_project')}
                <ArrowUpRight size={14} />
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) setDeleting(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('delete_this_project')}</DialogTitle>
            <DialogDescription>
              {t('this_cannot_be_undone')}
              {deleting?.name}
            </DialogDescription>
          </DialogHeader>
          {remove.error && <ErrorNotice>{remove.error.message}</ErrorNotice>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={remove.isPending}>
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => {
                if (deleting) remove.mutate(deleting.id)
              }}
            >
              {remove.isPending ? t('deleting') : t('delete_project')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
