import { features } from '@/config/features'
import { notFound } from '@tanstack/react-router'
import { createFileRoute, Link, Outlet, redirect, useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import {
  Image,
  FileText,
  LayoutDashboard,
  FolderKanban,
  CreditCard,
  Settings,
  Server,
  LogOut,
  Shield,
  Mail,
  ArrowUpRight,
  Menu,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { getWorkspace } from '@/server/functions'
import { authClient } from '@/modules/auth/auth-client'
import { Logo, Preferences, ErrorNotice } from '@/components/common'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/components/providers'

export const Route = createFileRoute('/app')({
  beforeLoad: () => {
    if (!features.auth) throw notFound()
  },
  loader: async () => {
    const viewer = await getWorkspace()
    if (!viewer) throw redirect({ to: '/login' })
    return viewer
  },
  component: AppShell,
})
function AppShell() {
  const viewer = Route.useLoaderData()
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const cache = useQueryClient()
  const navigation = [
    ...(features.content && viewer.admin
      ? [{ to: '/app/content' as const, icon: FileText, label: t('content_manage') }]
      : []),
    { to: '/app' as const, icon: LayoutDashboard, label: t('overview'), exact: true },
    ...(features.projects
      ? [{ to: '/app/projects' as const, icon: FolderKanban, label: t('projects_2') }]
      : []),
    ...(features.files
      ? [{ to: '/app/files' as const, icon: Image, label: t('files_title') }]
      : []),
    ...(features.billing
      ? [{ to: '/app/billing' as const, icon: CreditCard, label: t('billing') }]
      : []),
    { to: '/app/services' as const, icon: Server, label: t('services') },
    { to: '/app/settings' as const, icon: Settings, label: t('settings') },
  ]
  async function signOut() {
    setError('')
    const result = await authClient.signOut()
    if (result.error) {
      setError(t('sign_out_failed'))
      return
    }
    cache.clear()
    await router.navigate({ to: '/login' })
    await router.invalidate()
  }
  return (
    <div className="min-h-screen">
      {/* eslint-disable-next-line aster-ui/no-native-controls -- Full-screen dismissal overlay, not a standard form control. */}
      <button
        className={`fixed inset-0 z-30 bg-black/30 md:hidden ${open ? '' : 'hidden'}`}
        aria-label={t('close_navigation_overlay')}
        onClick={() => setOpen(false)}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r bg-card transition-transform md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex h-20 items-center justify-between px-6">
          <Logo />
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            onClick={() => setOpen(false)}
            aria-label={t('close_navigation')}
          >
            <X size={18} />
          </Button>
        </div>
        <div className="mx-4 mt-3 rounded-lg border bg-background p-3">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-accent font-medium text-primary">
              {viewer.user.image ? (
                <img src={viewer.user.image} alt="" className="size-8 rounded-lg object-cover" />
              ) : (
                viewer.user.name.slice(0, 1).toUpperCase()
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">
                {viewer.user.name}
                {t('s_workspace')}
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">PERSONAL WORKSPACE</p>
            </div>
          </div>
        </div>
        <p className="px-6 pb-3 pt-8 text-[9px] font-semibold tracking-[0.18em] text-muted-foreground">
          WORKSPACE
        </p>
        <nav className="space-y-1 px-3">
          {navigation.map(({ to, icon: Icon, label, exact }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact }}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted"
              activeProps={{ className: 'bg-accent font-medium text-primary' }}
            >
              <Icon size={17} />
              {label}
            </Link>
          ))}
          {viewer.admin && (
            <Link
              to="/app/admin"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] text-muted-foreground"
              activeProps={{ className: 'bg-accent text-primary' }}
            >
              <Shield size={17} />
              {t('admin')}
            </Link>
          )}
        </nav>
        <div className="mt-auto px-4 pb-5">
          {viewer.local && features.mail && (
            <Link
              to="/dev/inbox"
              className="mb-4 flex items-center justify-between rounded-lg border border-dashed p-3 text-xs text-muted-foreground"
            >
              <span className="flex items-center gap-2">
                <Mail size={15} />
                {t('local_test_inbox')}
              </span>
              <ArrowUpRight size={13} />
            </Link>
          )}
          {features.projects && (
            <div className="rounded-lg bg-background px-3 py-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold">
                  {features.billing ? (
                    <>
                      {viewer.billing.plan === 'pro' ? 'Pro' : 'Free'} {t('plan')}
                    </>
                  ) : (
                    t('projects_2')
                  )}
                </span>
                <span className="text-muted-foreground">
                  {viewer.projectCount} / {viewer.billing.projectLimit}
                </span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full bg-primary"
                  style={{
                    width: `${Math.min(100, (viewer.projectCount / viewer.billing.projectLimit) * 100)}%`,
                  }}
                />
              </div>
              {features.billing && (
                <Link
                  to="/app/billing"
                  className="mt-3 flex items-center justify-between text-[11px] text-primary"
                >
                  {t('manage_plan')}
                  <ArrowRightIcon />
                </Link>
              )}
            </div>
          )}
        </div>
      </aside>
      <div className="md:pl-60">
        <header className="flex h-20 items-center justify-between border-b bg-card/60 px-5 sm:px-9">
          <div className="flex items-center gap-3">
            <Button
              className="md:hidden"
              size="icon"
              variant="ghost"
              onClick={() => setOpen(true)}
              aria-label={t('open_navigation')}
            >
              <Menu size={19} />
            </Button>
            <span className="text-xs text-muted-foreground">
              {t('workspace')} <span className="mx-2 opacity-40">/</span>{' '}
              <span className="text-foreground">Personal</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full border px-2.5 py-1 text-[10px] text-muted-foreground sm:block">
              {viewer.local ? t('local_environment') : t('cloud_environment')}
            </span>
            <Preferences />
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('sign_out')}
              onClick={() => {
                void signOut().catch(() => setError(t('sign_out_failed')))
              }}
            >
              <LogOut size={16} />
            </Button>
          </div>
        </header>
        <main className="mx-auto max-w-6xl p-5 pb-12 sm:p-9">
          {error && (
            <div className="mb-5">
              <ErrorNotice>{error}</ErrorNotice>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  )
}
function ArrowRightIcon() {
  return <ArrowUpRight size={12} />
}
