import { useRef, useState } from 'react'
import { createFileRoute, getRouteApi, notFound, Link } from '@tanstack/react-router'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { features } from '@/config/features'
import { api } from '@/lib/api'
import { uploadImage } from '@/lib/file-upload'
import {
  type ContentRecord,
  type ContentInput,
  type ContentAsset,
  contentAssetUrl,
} from '@/modules/content/policy'
import { useI18n } from '@/components/providers'
import { ContentReading } from '@/components/content-reading'
import { Pagination } from '@/components/patterns/page-patterns'
import { PageHeading, ErrorNotice, Loading } from '@/components/common'
import { Button, buttonVariants } from '@/components/ui/button'
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
export const Route = createFileRoute('/app/content')({
  beforeLoad: () => {
    if (!features.content) throw notFound()
  },
  component: ContentAdmin,
})
const blank = (): ContentInput => ({
  title: '',
  slug: '',
  locale: 'en',
  kind: 'article',
  category: '',
  summary: '',
  body: '',
  seoTitle: '',
  seoDescription: '',
  coverAssetId: null,
})
function ContentAdmin() {
  const viewer = getRouteApi('/app').useLoaderData(),
    { t } = useI18n(),
    cache = useQueryClient(),
    toast = useToast()
  const [editing, setEditing] = useState<{
      id?: string
      revision?: number
      draft: ContentInput
    } | null>(null),
    [preview, setPreview] = useState<ContentInput | null>(null),
    [action, setAction] = useState<{
      record: ContentRecord
      kind: 'publish' | 'withdraw' | 'delete'
    } | null>(null)
  const [adminPage, setAdminPage] = useState(1)
  const records = useQuery({
    queryKey: ['content-admin', viewer.user.id, adminPage],
    queryFn: () =>
      api<{ records: ContentRecord[]; total: number; page: number }>(
        '/api/admin/content?page=' + adminPage,
      ),
    enabled: viewer.admin,
  })
  const assets = useQuery({
    queryKey: ['content-assets', viewer.user.id],
    queryFn: () =>
      api<{ configured: boolean; assets: ContentAsset[] }>('/api/admin/content/assets'),
    enabled: viewer.admin && features.files,
  })
  const refresh = async () => {
    await cache.invalidateQueries({ queryKey: ['content-admin', viewer.user.id] })
    await cache.invalidateQueries({ queryKey: ['content-assets', viewer.user.id] })
  }
  const save = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error(t('content_conflict'))
      return api('/api/admin/content' + (editing.id ? '/' + editing.id : ''), {
        method: editing.id ? 'PATCH' : 'POST',
        data: editing.id ? { revision: editing.revision, draft: editing.draft } : editing.draft,
      })
    },
    onSuccess: async () => {
      setEditing(null)
      await refresh()
      toast.add({ title: t('content_saved'), type: 'success' })
    },
  })
  const run = useMutation({
    mutationFn: async () => {
      if (!action) throw new Error(t('content_conflict'))
      return api(
        '/api/admin/content/' +
          action.record.id +
          (action.kind === 'delete' ? '' : '/' + action.kind),
        {
          method: action.kind === 'delete' ? 'DELETE' : 'POST',
          data: { revision: action.record.revision },
        },
      )
    },
    onSuccess: async () => {
      setAction(null)
      await refresh()
      toast.add({ title: t('content_action_done'), type: 'success' })
    },
  })
  const change = (key: keyof ContentInput, value: string | null) =>
    setEditing((old) => (old ? { ...old, draft: { ...old.draft, [key]: value } } : old))
  const kinds = {
    article: t('content_article'),
    help: t('content_help'),
    announcement: t('content_announcement'),
  }
  if (!viewer.admin) return <ErrorNotice>{t('you_do_not_have_admin_access')}</ErrorNotice>
  return (
    <>
      <PageHeading
        eyebrow="EDITORIAL"
        title={t('content_manage')}
        description={t('content_manage_intro')}
        action={
          <Link to="/content" className={buttonVariants({ variant: 'outline' })}>
            {t('content_view_public')}
          </Link>
        }
      />
      <Tabs defaultValue="entries">
        <TabsList aria-label={t('content_manage')}>
          <TabsTrigger value="entries">{t('content_title')}</TabsTrigger>
          {features.files && <TabsTrigger value="assets">{t('content_assets')}</TabsTrigger>}
        </TabsList>
        <TabsContent value="entries">
          {editing ? (
            <form
              className="space-y-7 rounded-xl border bg-card p-5 sm:p-8"
              onSubmit={(e) => {
                e.preventDefault()
                save.mutate()
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">
                  {t(editing.id ? 'content_edit' : 'content_new')}
                </h2>
                <Badge variant="outline">{t('content_draft')}</Badge>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                {(['title', 'slug', 'category'] as const).map((key) => (
                  <div key={key} className="grid gap-2">
                    <Label htmlFor={'entry-' + key}>
                      {t(
                        key === 'title'
                          ? 'content_field_title'
                          : key === 'slug'
                            ? 'content_slug'
                            : 'content_category',
                      )}
                    </Label>
                    <Input
                      id={'entry-' + key}
                      value={editing.draft[key]}
                      required={key !== 'category'}
                      maxLength={key === 'title' ? 160 : key === 'slug' ? 80 : 60}
                      pattern={key === 'slug' ? '[a-z0-9]+(-[a-z0-9]+)*' : undefined}
                      onChange={(e) => change(key, e.target.value)}
                    />
                  </div>
                ))}
                <div className="grid gap-2">
                  <Label htmlFor="entry-kind">{t('content_kind')}</Label>
                  <Select
                    value={editing.draft.kind}
                    items={kinds}
                    onValueChange={(v) => {
                      if (v) change('kind', v)
                    }}
                  >
                    <SelectTrigger id="entry-kind">
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
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="entry-locale">{t('content_locale')}</Label>
                  <Select
                    value={editing.draft.locale}
                    items={{ en: 'English', zh: '中文' }}
                    onValueChange={(v) => {
                      if (v) change('locale', v)
                    }}
                  >
                    <SelectTrigger id="entry-locale">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="zh">中文</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="entry-summary">{t('content_summary')}</Label>
                <Textarea
                  id="entry-summary"
                  value={editing.draft.summary}
                  maxLength={500}
                  rows={3}
                  onChange={(e) => change('summary', e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="entry-body">{t('content_body')}</Label>
                <Textarea
                  id="entry-body"
                  value={editing.draft.body}
                  required
                  maxLength={12000}
                  rows={12}
                  onChange={(e) => change('body', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">{t('content_plain_text')}</p>
              </div>
              {features.files && (
                <div className="grid gap-3">
                  <Label htmlFor="entry-cover">{t('content_cover')}</Label>
                  <Select
                    value={editing.draft.coverAssetId ?? ''}
                    items={{
                      '': t('content_no_cover'),
                      ...Object.fromEntries(
                        (assets.data?.assets ?? [])
                          .filter((a) => a.state === 'ready')
                          .map((a) => [a.id, a.name]),
                      ),
                    }}
                    onValueChange={(v) => change('coverAssetId', v || null)}
                  >
                    <SelectTrigger id="entry-cover">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">{t('content_no_cover')}</SelectItem>
                      {assets.data?.assets
                        .filter((a) => a.state === 'ready')
                        .map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {editing.draft.coverAssetId && (
                    <img
                      src={contentAssetUrl(editing.draft.coverAssetId, true)}
                      alt={t('content_cover')}
                      className="aspect-video w-full max-w-sm rounded-lg border object-cover"
                    />
                  )}
                  <p className="text-xs text-muted-foreground">{t('content_cover_help')}</p>
                </div>
              )}
              <fieldset className="grid gap-5 rounded-lg border p-4 md:grid-cols-2">
                <legend className="px-2 text-sm font-medium">SEO</legend>
                <div className="grid gap-2">
                  <Label htmlFor="entry-seo-title">{t('content_seo_title')}</Label>
                  <Input
                    id="entry-seo-title"
                    value={editing.draft.seoTitle}
                    maxLength={160}
                    onChange={(e) => change('seoTitle', e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="entry-seo-description">{t('content_seo_description')}</Label>
                  <Textarea
                    id="entry-seo-description"
                    value={editing.draft.seoDescription}
                    maxLength={300}
                    rows={2}
                    onChange={(e) => change('seoDescription', e.target.value)}
                  />
                </div>
              </fieldset>
              {save.error && <ErrorNotice>{save.error.message}</ErrorNotice>}
              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={save.isPending}>
                  {t('content_save_draft')}
                </Button>
                <Button
                  variant="outline"
                  disabled={save.isPending}
                  onClick={() => setPreview(editing.draft)}
                >
                  {t('content_preview')}
                </Button>
                <Button variant="ghost" disabled={save.isPending} onClick={() => setEditing(null)}>
                  {t('cancel')}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => {
                    save.reset()
                    setEditing({ draft: blank() })
                  }}
                >
                  {t('content_new')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    void refresh()
                  }}
                >
                  {t('refresh')}
                </Button>
              </div>
              {records.isPending ? (
                <Loading />
              ) : records.error ? (
                <ErrorNotice>{records.error.message}</ErrorNotice>
              ) : !records.data.records.length ? (
                <p className="rounded-xl border border-dashed p-10 text-sm text-muted-foreground">
                  {t('content_admin_empty')}
                </p>
              ) : (
                <div className="divide-y rounded-xl border bg-card">
                  {records.data.records.map((record) => (
                    <article key={record.id} className="space-y-4 p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="break-words font-semibold">{record.draft.title}</h2>
                          <p className="mt-1 break-all text-xs text-muted-foreground">
                            {record.draft.locale.toUpperCase()} / {record.draft.slug} · v
                            {record.revision}
                          </p>
                        </div>
                        <Badge variant={record.live ? 'default' : 'outline'}>
                          {t(record.live ? 'content_live' : 'content_draft')}
                        </Badge>
                      </div>
                      <p className="text-xs leading-6 text-muted-foreground">
                        {t(record.live ? 'content_snapshot_notice' : 'content_draft_notice')}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            save.reset()
                            setEditing({
                              id: record.id,
                              revision: record.revision,
                              draft: structuredClone(record.draft),
                            })
                          }}
                        >
                          {t('edit')}
                        </Button>
                        <Button variant="outline" onClick={() => setPreview(record.draft)}>
                          {t('content_preview')}
                        </Button>
                        <Button
                          onClick={() => {
                            run.reset()
                            setAction({ record, kind: 'publish' })
                          }}
                        >
                          {t('content_publish')}
                        </Button>
                        {record.live ? (
                          <>
                            <Link
                              to="/content/$slug"
                              params={{ slug: record.live.slug }}
                              search={{ _locale: record.live.locale }}
                              className={buttonVariants({ variant: 'outline' })}
                            >
                              {t('content_view_public')}
                            </Link>
                            <Button
                              variant="outline"
                              onClick={() => {
                                run.reset()
                                setAction({ record, kind: 'withdraw' })
                              }}
                            >
                              {t('content_withdraw')}
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="destructive"
                            onClick={() => {
                              run.reset()
                              setAction({ record, kind: 'delete' })
                            }}
                          >
                            {t('delete')}
                          </Button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
          {!editing && records.data && (
            <Pagination
              page={adminPage}
              pageCount={Math.max(1, Math.ceil(records.data.total / 12))}
              total={records.data.total}
              onPageChange={setAdminPage}
            />
          )}
        </TabsContent>
        {features.files && (
          <TabsContent value="assets">
            <ContentAssets userId={viewer.user.id} />
          </TabsContent>
        )}
      </Tabs>
      <Dialog
        open={!!preview}
        onOpenChange={(open) => {
          if (!open) setPreview(null)
        }}
      >
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{t('content_preview')}</DialogTitle>
            <DialogDescription>{t('content_preview_notice')}</DialogDescription>
          </DialogHeader>
          {preview && <ContentReading entry={preview} preview />}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!action}
        onOpenChange={(open) => {
          if (!open && !run.isPending) setAction(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t(
                action?.kind === 'publish'
                  ? 'content_publish_confirm'
                  : action?.kind === 'withdraw'
                    ? 'content_withdraw_confirm'
                    : 'content_delete_confirm',
              )}
            </DialogTitle>
            <DialogDescription>
              {t(
                action?.kind === 'publish'
                  ? 'content_publish_notice'
                  : action?.kind === 'withdraw'
                    ? 'content_withdraw_notice'
                    : 'content_delete_notice',
              )}
            </DialogDescription>
          </DialogHeader>
          <p className="break-words text-sm font-medium">{action?.record.draft.title}</p>
          {run.error && <ErrorNotice>{run.error.message}</ErrorNotice>}
          <DialogFooter>
            <Button variant="outline" disabled={run.isPending} onClick={() => setAction(null)}>
              {t('cancel')}
            </Button>
            <Button disabled={run.isPending} onClick={() => run.mutate()}>
              {t('content_confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
function ContentAssets({ userId }: { userId: string }) {
  const { t } = useI18n(),
    cache = useQueryClient(),
    input = useRef<HTMLInputElement>(null),
    [deleting, setDeleting] = useState<ContentAsset | null>(null)
  const query = useQuery({
    queryKey: ['content-assets', userId],
    queryFn: () =>
      api<{ configured: boolean; assets: ContentAsset[] }>('/api/admin/content/assets'),
  })
  const refresh = () => cache.invalidateQueries({ queryKey: ['content-assets', userId] })
  const upload = useMutation({
    mutationFn: (file: File) => uploadImage(file, '/api/admin/content/assets'),
    onSettled: () => {
      if (input.current) input.current.value = ''
      void refresh()
    },
  })
  const action = useMutation({
    mutationFn: ({ id, remove }: { id: string; remove: boolean }) =>
      api('/api/admin/content/assets/' + id + (remove ? '' : '/reconcile'), {
        method: remove ? 'DELETE' : 'POST',
      }),
    onSuccess: () => {
      setDeleting(null)
      void refresh()
    },
    onError: () => {
      void refresh()
    },
  })
  return (
    <div className="space-y-6">
      <p className="text-sm leading-7 text-muted-foreground">{t('content_assets_notice')}</p>
      <div className="grid gap-2">
        <Label htmlFor="content-upload">{t('content_upload')}</Label>
        <Input
          ref={input}
          id="content-upload"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={!query.data?.configured || upload.isPending}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) {
              upload.reset()
              upload.mutate(f)
            }
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {t('content_assets_limits', { count: query.data?.assets.length ?? 0 })}
      </p>
      {upload.error && <ErrorNotice>{upload.error.message}</ErrorNotice>}
      {upload.isPending && <Loading />}
      {action.error && <ErrorNotice>{action.error.message}</ErrorNotice>}
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorNotice>{query.error.message}</ErrorNotice>
      ) : (
        <>
          {!query.data.configured && <ErrorNotice>{t('files_unavailable')}</ErrorNotice>}
          {!query.data.assets.length ? (
            <p className="text-sm text-muted-foreground">{t('content_assets_empty')}</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {query.data.assets.map((asset) => (
                <article key={asset.id} className="min-w-0 space-y-4 rounded-xl border bg-card p-4">
                  {asset.state === 'ready' && (
                    <img
                      src={contentAssetUrl(asset.id, true)}
                      alt={asset.name}
                      className="aspect-video w-full rounded-lg border object-cover"
                    />
                  )}
                  <p className="break-words text-sm font-medium">{asset.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {asset.references ? t('files_in_use') : t('content_unused')} ·{' '}
                    {Math.ceil(asset.size / 1024)} KB
                  </p>
                  {asset.state !== 'ready' && (
                    <p className="text-xs leading-6 text-muted-foreground">
                      {t(asset.state === 'pending' ? 'files_pending' : 'files_deleting')}
                    </p>
                  )}
                  <Button
                    variant="outline"
                    disabled={asset.references > 0 || action.isPending || !query.data.configured}
                    onClick={() => {
                      action.reset()
                      if (asset.state === 'pending') action.mutate({ id: asset.id, remove: false })
                      else setDeleting(asset)
                    }}
                  >
                    {t(asset.state === 'pending' ? 'files_reconcile' : 'files_delete')}
                  </Button>
                </article>
              ))}
            </div>
          )}
        </>
      )}
      <Dialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open && !action.isPending) setDeleting(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('files_delete_confirm')}</DialogTitle>
            <DialogDescription>{t('content_asset_delete_notice')}</DialogDescription>
          </DialogHeader>
          <p className="break-words text-sm">{deleting?.name}</p>
          {action.error && <ErrorNotice>{action.error.message}</ErrorNotice>}
          <DialogFooter>
            <Button variant="outline" disabled={action.isPending} onClick={() => setDeleting(null)}>
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={action.isPending}
              onClick={() => {
                if (deleting) action.mutate({ id: deleting.id, remove: true })
              }}
            >
              {t('files_confirm_delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
