import { features } from '@/config/features'
import { createFileRoute, Link, getRouteApi } from '@tanstack/react-router'
import {
  ArrowUpRight,
  FolderKanban,
  Database,
  CreditCard,
  ArrowRight,
  CheckCircle2,
  Circle,
  Sparkles,
  FileCode2,
} from 'lucide-react'
import { PageHeading } from '@/components/common'
import { useI18n } from '@/components/providers'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { site } from '@/config/site'

export const Route = createFileRoute('/app/')({ component: Overview })
function Overview() {
  const viewer = getRouteApi('/app').useLoaderData()
  const { t } = useI18n()
  const cards = [
    {
      icon: FolderKanban,
      title: t('your_projects'),
      value: String(viewer.projectCount).padStart(2, '0'),
      caption: t('plan_project_limit', { count: viewer.billing.projectLimit }),
    },
    {
      icon: Database,
      title: t('database'),
      value: 'D1',
      caption: viewer.local ? t('local_persistence_connected') : t('cloudflare_binding_connected'),
    },
    {
      icon: CreditCard,
      title: t('current_plan'),
      value: viewer.billing.plan === 'pro' ? 'Pro' : 'Free',
      caption: viewer.billing.provider.ready
        ? t('provider_test_mode', {
            provider: viewer.billing.provider.name === 'creem' ? 'Creem' : 'Stripe',
          })
        : t('payments_unconfigured_no_charges'),
    },
  ].filter(
    (card) =>
      (card.icon !== FolderKanban && card.icon !== CreditCard) ||
      (card.icon === FolderKanban && features.projects) ||
      (card.icon === CreditCard && features.billing),
  )
  return (
    <>
      <PageHeading
        eyebrow="OVERVIEW"
        title={t('hello_name', { name: viewer.user.name })}
        description={t('a_fresh_start_turn_your_next_idea_into_something_real')}
        action={
          features.projects ? (
            <Link to="/app/projects" className={buttonVariants({})}>
              {t('create_a_project')}
              <ArrowUpRight size={15} />
            </Link>
          ) : undefined
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map(({ icon: Icon, title, value, caption }) => (
          <section key={title} className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{title}</span>
              <Icon size={16} />
            </div>
            <p className="mt-6 font-mono text-3xl font-medium tracking-tight">{value}</p>
            <p className="mt-2 text-[11px] leading-5 text-muted-foreground">{caption}</p>
          </section>
        ))}
      </div>
      {features.projects && (
        <section className="my-6 grid overflow-hidden rounded-xl border bg-accent sm:grid-cols-[1.4fr_1fr]">
          <div className="p-6 sm:p-8">
            <p className="mb-4 flex items-center gap-2 text-[10px] font-semibold tracking-widest text-primary">
              <Sparkles size={14} />
              MAKE SOMETHING YOURS
            </p>
            <h2 className="text-xl leading-snug font-semibold tracking-tight">
              {t('start_with_one_small_project')}
              <br />
              {t('make_room_for_what_comes_next')}
            </h2>
            <p className="mb-6 mt-3 max-w-sm text-xs leading-6 text-muted-foreground">
              {t('create_and_save_your_first_project_your_records_are_private_to_your_account')}
            </p>
            <Link
              to="/app/projects"
              className="inline-flex items-center gap-2 text-xs font-semibold text-primary"
            >
              {t('explore_your_projects')}
              <ArrowRight size={14} />
            </Link>
          </div>
          <div className="relative hidden items-center justify-center border-l border-black/5 sm:flex">
            <div className="absolute size-40 rounded-full border border-primary/10" />
            <div className="absolute size-56 rounded-full border border-primary/10" />
            <div className="relative rotate-[-8deg] rounded-xl border border-primary/15 bg-card px-7 py-8 shadow-lg shadow-primary/5">
              <FileCode2 className="mb-4 size-9 text-primary" strokeWidth={1.3} />
              <p className="font-mono text-[10px] text-muted-foreground">your-next-idea.tsx</p>
            </div>
          </div>
        </section>
      )}
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h2 className="text-sm font-semibold">{t('getting_started')}</h2>
            <Badge variant="secondary" className="text-[10px]">
              {t('foundation_ready')}
            </Badge>
          </div>
          <div className="divide-y px-5">
            {[
              {
                complete: true,
                title: t('account_email_verification'),
                text: viewer.user.email,
                to: '/app/settings' as const,
              },
              {
                complete: true,
                title: t('connect_your_data'),
                text: t('d1_connected_server_authorization_enabled'),
                to: '/app/services' as const,
              },
              {
                complete: viewer.projectCount > 0,
                title: t('save_your_first_idea'),
                text: t('try_editing_and_filtering_your_projects'),
                to: '/app/projects' as const,
              },
            ]
              .filter((item) => item.to !== '/app/projects' || features.projects)
              .map(({ complete, title, text, to }) => (
                <Link key={title} to={to} className="flex items-center gap-3 py-4">
                  {complete ? (
                    <CheckCircle2 size={17} className="shrink-0 text-primary" />
                  ) : (
                    <Circle size={17} className="shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium">{title}</p>
                    <p className="mt-1 truncate text-[11px] text-muted-foreground">{text}</p>
                  </div>
                  <ArrowUpRight size={14} className="text-muted-foreground" />
                </Link>
              ))}
          </div>
        </section>
        <section className="rounded-xl border bg-card p-6">
          <p className="text-[10px] font-semibold tracking-widest text-muted-foreground">
            BUILT ON GOOD FOUNDATIONS
          </p>
          <h2 className="mb-3 mt-5 text-base font-semibold">
            {t('a_clear_foundation_to_build_on')}
          </h2>
          <p className="text-xs leading-7 text-muted-foreground">
            {t('tanstack_start_for_the_application_cloudflare_for_runtime_and_data_shared_c')}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {['React', 'TypeScript', 'Workers', 'D1', 'Better Auth'].map((tag) => (
              <Badge key={tag} variant="outline" className="font-mono text-[9px] font-normal">
                {tag}
              </Badge>
            ))}
          </div>
        </section>
      </div>
      <p className="mt-8 text-[10px] text-muted-foreground">
        {site.name} / v{site.version} <span className="mx-2">·</span>{' '}
        {t('projects_and_plan_data_reflect_your_current_account')}
      </p>
    </>
  )
}
