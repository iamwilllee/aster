import { useState } from 'react'
import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeading, ErrorNotice, Loading } from '@/components/common'
import { useI18n } from '@/components/providers'
import { type ManagedUser, type UserDetail, type AuditRow, reasons } from '@/modules/admin/policy'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Pagination, DetailList, EmptyState } from '@/components/patterns/page-patterns'
import { Users } from 'lucide-react'
export const Route = createFileRoute('/app/admin')({
  validateSearch: (s: Record<string, unknown>): { q?: string; status?: string; page?: number } => ({
    q: typeof s.q === 'string' ? s.q.slice(0, 80) : '',
    status: s.status === 'active' || s.status === 'disabled' ? s.status : '',
    page: Number.isInteger(Number(s.page)) ? Math.max(1, Math.min(10000, Number(s.page))) : 1,
  }),
  component: Admin,
})
function Admin() {
  const viewer = getRouteApi('/app').useLoaderData(),
    { t, locale } = useI18n(),
    cache = useQueryClient(),
    search = Route.useSearch(),
    navigate = Route.useNavigate()
  const [tab, setTab] = useState('users'),
    [selected, setSelected] = useState<string | null>(null),
    [changing, setChanging] = useState<ManagedUser | null>(null),
    [reason, setReason] = useState<(typeof reasons)[number]>('support'),
    [auditPage, setAuditPage] = useState(1),
    [auditTarget, setAuditTarget] = useState('')
  const q = search.q ?? '',
    status = search.status ?? '',
    page = search.page ?? 1,
    params = new URLSearchParams({ q, status, page: String(page) })
  const query = useQuery({
    queryKey: ['admin-users', viewer.user.id, q, status, page],
    queryFn: () =>
      api<{ users: ManagedUser[]; total: number; page: number; activeAdministrators: number }>(
        '/api/admin/users?' + params.toString(),
      ),
    enabled: viewer.admin,
  })
  const detail = useQuery({
    queryKey: ['admin-detail', viewer.user.id, selected],
    queryFn: () => api<UserDetail>('/api/admin/users/' + selected),
    enabled: viewer.admin && !!selected,
  })
  const audit = useQuery({
    queryKey: ['admin-audit', viewer.user.id, auditPage, auditTarget],
    queryFn: () =>
      api<{ events: AuditRow[]; total: number; page: number }>(
        '/api/admin/audit?' +
          new URLSearchParams({ page: String(auditPage), target: auditTarget }).toString(),
      ),
    enabled: viewer.admin && tab === 'audit',
  })
  const mutate = useMutation({
    mutationFn: async () => {
      if (!changing) throw new Error(t('admin_changed'))
      return api('/api/admin/users/' + changing.id + '/access', {
        method: 'POST',
        data: { revision: changing.revision, disabled: changing.disabledAt === null, reason },
      })
    },
    onSuccess: async () => {
      setChanging(null)
      await Promise.all([
        cache.invalidateQueries({ queryKey: ['admin-users'] }),
        cache.invalidateQueries({ queryKey: ['admin-detail'] }),
        cache.invalidateQueries({ queryKey: ['admin-audit'] }),
      ])
    },
  })
  const date = (n: number) => new Date(n).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US')
  const openChange = (user: ManagedUser) => {
    mutate.reset()
    setReason('support')
    setChanging(user)
  }
  const canChange = (user: ManagedUser) =>
    user.id !== viewer.user.id && (!user.protectedAdministrator || user.disabledAt !== null)
  const statusOptions = {
    '': t('admin_all_status'),
    active: t('admin_active'),
    disabled: t('admin_disabled'),
  }
  const reasonLabels = {
    security: t('admin_reason_security'),
    abuse: t('admin_reason_abuse'),
    support: t('admin_reason_support'),
    maintenance: t('admin_reason_maintenance'),
  }
  const actionLabel = (action: AuditRow['action']) =>
    t(
      action === 'user.disable'
        ? 'admin_action_disable'
        : action === 'user.enable'
          ? 'admin_action_enable'
          : action === 'admin.grant'
            ? 'admin_action_grant'
            : 'admin_action_revoke',
    )
  if (!viewer.admin) return <ErrorNotice>{t('you_do_not_have_admin_access')}</ErrorNotice>
  return (
    <>
      <PageHeading
        eyebrow="OPERATIONS"
        title={t('user_administration')}
        description={t('admin_intro')}
      />
      <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
        <TabsList aria-label={t('user_administration')}>
          <TabsTrigger value="users">{t('admin_users_tab')}</TabsTrigger>
          <TabsTrigger value="audit">{t('admin_audit_tab')}</TabsTrigger>
        </TabsList>
        <TabsContent value="users">
          <div className="space-y-6">
            <div className="flex flex-wrap items-end gap-3">
              <form
                className="flex min-w-0 flex-1 gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  const value = new FormData(e.currentTarget).get('q')
                  void navigate({
                    search: { q: typeof value === 'string' ? value : '', status, page: 1 },
                  })
                }}
              >
                <Input
                  name="q"
                  key={q}
                  defaultValue={q}
                  maxLength={80}
                  aria-label={t('admin_search')}
                  placeholder={t('admin_search')}
                />
                <Button type="submit">{t('content_search_submit')}</Button>
              </form>
              <Select
                value={status}
                items={statusOptions}
                onValueChange={(v) => {
                  void navigate({ search: { q, status: String(v ?? ''), page: 1 } })
                }}
              >
                <SelectTrigger aria-label={t('admin_filter')} className="w-full sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusOptions).map(([v, label]) => (
                    <SelectItem key={v} value={v}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => {
                  void query.refetch()
                }}
              >
                {t('refresh')}
              </Button>
            </div>
            {query.isPending ? (
              <Loading />
            ) : query.error ? (
              <ErrorNotice>{query.error.message}</ErrorNotice>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  {t('admin_active_count', { count: query.data.activeAdministrators })}
                </p>
                {!query.data.users.length ? (
                  <EmptyState
                    icon={<Users />}
                    title={t('admin_empty')}
                    description={t('admin_empty_body')}
                  />
                ) : (
                  <div className="overflow-hidden rounded-xl border bg-card">
                    <Table className="min-w-[640px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('admin_user')}</TableHead>
                          <TableHead>{t('status')}</TableHead>
                          <TableHead>{t('admin_role')}</TableHead>
                          <TableHead>{t('admin_operations')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {query.data.users.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell>
                              <p className="max-w-xs break-words font-medium">{user.name}</p>
                              <p className="mt-1 max-w-xs break-all text-xs text-muted-foreground">
                                {user.email}
                              </p>
                            </TableCell>
                            <TableCell>
                              <Badge variant={user.disabledAt === null ? 'secondary' : 'outline'}>
                                {t(user.disabledAt === null ? 'admin_active' : 'admin_disabled')}
                              </Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {t(user.admin ? 'admin_administrator' : 'admin_member')}
                              {user.id === viewer.user.id && (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  {t('admin_you')}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  variant="outline"
                                  onClick={() => setSelected(user.id)}
                                  aria-label={t('admin_details_named', { name: user.email })}
                                >
                                  {t('view_details')}
                                </Button>
                                <Button
                                  variant={user.disabledAt === null ? 'destructive' : 'outline'}
                                  disabled={!canChange(user)}
                                  onClick={() => openChange(user)}
                                  aria-label={t(
                                    user.disabledAt === null
                                      ? 'admin_disable_named'
                                      : 'admin_enable_named',
                                    { name: user.email },
                                  )}
                                >
                                  {t(user.disabledAt === null ? 'admin_disable' : 'admin_enable')}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                <Pagination
                  page={query.data.page}
                  pageCount={Math.max(1, Math.ceil(query.data.total / 20))}
                  total={query.data.total}
                  onPageChange={(next) => {
                    void navigate({ search: { q, status, page: next } })
                  }}
                />
              </>
            )}
          </div>
        </TabsContent>
        <TabsContent value="audit">
          <div className="space-y-5">
            <p className="text-sm leading-7 text-muted-foreground">{t('admin_audit_notice')}</p>
            {auditTarget && (
              <div className="flex items-center gap-3">
                <Badge variant="outline">{t('admin_target_filter')}</Badge>
                <Button
                  variant="outline"
                  onClick={() => {
                    setAuditTarget('')
                    setAuditPage(1)
                  }}
                >
                  {t('admin_clear_filter')}
                </Button>
              </div>
            )}
            {audit.isPending ? (
              <Loading />
            ) : audit.error ? (
              <ErrorNotice>{audit.error.message}</ErrorNotice>
            ) : (
              <>
                {!audit.data?.events.length ? (
                  <p className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">
                    {t('admin_audit_empty')}
                  </p>
                ) : (
                  <div className="divide-y rounded-xl border bg-card">
                    {audit.data.events.map((event) => (
                      <article key={event.id} className="space-y-3 p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="font-medium">{actionLabel(event.action)}</p>
                          <time className="text-xs text-muted-foreground">
                            {date(event.createdAt)}
                          </time>
                        </div>
                        <p className="break-words text-sm">
                          {t('admin_audit_actor')}:{' '}
                          {event.actor?.email ??
                            t(
                              event.source === 'database'
                                ? 'admin_database_operator'
                                : 'admin_deleted_user',
                            )}
                        </p>
                        <p className="break-words text-sm">
                          {t('admin_audit_target')}:{' '}
                          {event.target?.email ?? t('admin_deleted_user')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {reasonLabels[event.reason]}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
                {audit.data && (
                  <Pagination
                    page={audit.data.page}
                    pageCount={Math.max(1, Math.ceil(audit.data.total / 20))}
                    total={audit.data.total}
                    onPageChange={setAuditPage}
                  />
                )}
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t('admin_detail_title')}</DialogTitle>
            <DialogDescription>{t('admin_detail_notice')}</DialogDescription>
          </DialogHeader>
          {detail.isPending ? (
            <Loading />
          ) : detail.error ? (
            <ErrorNotice>{detail.error.message}</ErrorNotice>
          ) : (
            detail.data && (
              <>
                <DetailList
                  items={[
                    { label: t('admin_user'), value: detail.data.user.email },
                    { label: t('admin_display_name'), value: detail.data.user.name },
                    {
                      label: t('admin_role'),
                      value: t(detail.data.user.admin ? 'admin_administrator' : 'admin_member'),
                    },
                    {
                      label: t('status'),
                      value: t(
                        detail.data.user.disabledAt === null ? 'admin_active' : 'admin_disabled',
                      ),
                    },
                    {
                      label: t('admin_verified'),
                      value: t(detail.data.user.emailVerified ? 'verified' : 'unverified'),
                    },
                    { label: t('admin_joined'), value: date(detail.data.user.createdAt) },
                    {
                      label: t('admin_login_methods'),
                      value:
                        detail.data.loginMethods
                          .map((m) =>
                            m === 'password'
                              ? t('password')
                              : m === 'google'
                                ? 'Google'
                                : t('admin_other_method'),
                          )
                          .join(', ') || '—',
                    },
                    {
                      label: t('admin_data_counts'),
                      value: t('admin_count_summary', detail.data.counts),
                    },
                    {
                      label: t('admin_billing_history'),
                      value: t(
                        detail.data.hasBillingHistory
                          ? 'admin_billing_preserved'
                          : 'admin_billing_none',
                      ),
                    },
                  ]}
                />
                {detail.data.user.protectedAdministrator && (
                  <p role="note" className="text-sm leading-6 text-muted-foreground">
                    {t('admin_last_notice')}
                  </p>
                )}
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setAuditTarget(detail.data.user.id)
                      setAuditPage(1)
                      setTab('audit')
                      setSelected(null)
                    }}
                  >
                    {t('admin_view_audit')}
                  </Button>
                  <Button
                    disabled={!canChange(detail.data.user)}
                    onClick={() => {
                      openChange(detail.data.user)
                      setSelected(null)
                    }}
                  >
                    {t(detail.data.user.disabledAt === null ? 'admin_disable' : 'admin_enable')}
                  </Button>
                </DialogFooter>
              </>
            )
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!changing}
        onOpenChange={(open) => {
          if (!open && !mutate.isPending) setChanging(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t(changing?.disabledAt === null ? 'admin_disable_confirm' : 'admin_enable_confirm')}
            </DialogTitle>
            <DialogDescription>
              {t(changing?.disabledAt === null ? 'admin_disable_notice' : 'admin_enable_notice')}
            </DialogDescription>
          </DialogHeader>
          <p className="break-all text-sm font-medium">{changing?.email}</p>
          <div className="grid gap-2">
            <Label htmlFor="admin-reason">{t('admin_reason')}</Label>
            <Select
              value={reason}
              items={reasonLabels}
              onValueChange={(v) => {
                if (reasons.includes(v as typeof reason)) setReason(v as typeof reason)
              }}
            >
              <SelectTrigger id="admin-reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {reasons.map((r) => (
                  <SelectItem key={r} value={r}>
                    {reasonLabels[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {mutate.error && <ErrorNotice>{mutate.error.message}</ErrorNotice>}
          <DialogFooter>
            <Button variant="outline" disabled={mutate.isPending} onClick={() => setChanging(null)}>
              {t('cancel')}
            </Button>
            <Button
              variant={changing?.disabledAt === null ? 'destructive' : 'default'}
              disabled={mutate.isPending}
              onClick={() => mutate.mutate()}
            >
              {t('content_confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
