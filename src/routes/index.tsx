import { createFileRoute, Link, getRouteApi } from '@tanstack/react-router'
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  Cloud,
  Database,
  ShieldCheck,
  Code2,
  Layers,
  Terminal,
  Box,
} from 'lucide-react'
import { Logo, Preferences } from '@/components/common'
import { useI18n } from '@/components/providers'
import { site } from '@/config/site'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'

export const Route = createFileRoute('/')({ component: Home })
function Home() {
  const { t, locale } = useI18n()
  const { registrationReady, features } = getRouteApi('__root__').useLoaderData()
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-6 sm:px-8">
        <Logo />
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 sm:gap-4">
          {features.billing && (
            <Link
              to="/pricing"
              className="hidden text-sm text-muted-foreground hover:text-foreground sm:block"
            >
              {t('pricing')}
            </Link>
          )}
          {features.content && (
            <Link
              to="/content"
              className="text-sm whitespace-nowrap text-muted-foreground hover:underline"
            >
              {t('content_title')}
            </Link>
          )}
          <Preferences />
          {features.auth && (
            <Link to="/login" className={buttonVariants({ variant: 'outline' })}>
              {t('open_workspace')} <span aria-hidden>↗</span>
            </Link>
          )}
        </div>
      </header>
      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-14 sm:px-8 sm:pt-20 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <Badge
              variant="outline"
              className="mb-7 gap-2 bg-card px-3 py-1.5 text-[10px] tracking-widest"
            >
              <span className="size-1.5 rounded-full bg-primary" /> OPEN SOURCE · CLOUDFLARE NATIVE
            </Badge>
            <h1
              className={`text-[clamp(2.8rem,5.5vw,4.4rem)] leading-[1.18] font-bold ${locale === 'zh' ? 'tracking-normal' : 'tracking-[-0.03em]'}`}
            >
              {t('less_setup')}
              <br />
              <span className="text-primary">{t('more_possibility')}</span>
            </h1>
            <p className="mt-6 max-w-md text-base leading-8 text-muted-foreground sm:text-lg">
              {t('selected_product_foundation')}
            </p>
            {features.auth && (
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to={registrationReady ? '/signup' : '/login'}
                  className={buttonVariants({ size: 'lg' })}
                >
                  {registrationReady ? t('create_your_workspace') : t('go_to_sign_in')}
                  <ArrowUpRight size={17} />
                </Link>
                <Link to="/app" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
                  {t('explore_workspace')}
                  <ArrowRight size={16} />
                </Link>
              </div>
            )}
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
              {[
                t('mit_licensed'),
                t('your_own_cloudflare_account'),
                t('local_first_development'),
              ].map((text) => (
                <span key={text} className="flex items-center gap-1.5">
                  <Check className="size-3.5 text-primary" />
                  {text}
                </span>
              ))}
            </div>
          </div>
          <div className="relative pb-5">
            <div className="absolute inset-0 -z-10 rounded-full bg-accent blur-3xl" />
            <div className="overflow-hidden rounded-xl border bg-card shadow-xl shadow-primary/10">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="size-2 rounded-full bg-border" />
                  ))}
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">
                  your-next-product / aster
                </span>
                <Box className="size-3 text-muted-foreground" />
              </div>
              <div className="p-6 sm:p-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-medium">
                    <span className="grid size-7 place-items-center rounded-md bg-accent text-primary">
                      <Layers size={14} />
                    </span>
                    YOUR FOUNDATION
                  </div>
                  <Badge variant="secondary" className="text-[10px]">
                    {t('architecture')}
                  </Badge>
                </div>
                <div className="my-8">
                  <p className="text-lg font-semibold">{t('one_considered_foundation')}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t('familiar_tools_clear_boundaries_your_code')}
                  </p>
                </div>
                <div className="space-y-2">
                  {[
                    {
                      icon: Code2,
                      title: 'TanStack Start',
                      desc: 'React · TypeScript · Vite',
                      tag: 'APP',
                    },
                    {
                      icon: Cloud,
                      title: 'Cloudflare Workers',
                      desc: 'SSR · Server functions · API',
                      tag: 'RUNTIME',
                    },
                    {
                      icon: Database,
                      title: 'Cloudflare D1',
                      desc: 'SQL data · Per-user access',
                      tag: 'DATA',
                    },
                    {
                      icon: ShieldCheck,
                      title: 'Better Auth',
                      desc: 'Sessions · Email verification',
                      tag: 'IDENTITY',
                    },
                  ]
                    .filter(
                      (item) =>
                        (item.tag !== 'DATA' && item.tag !== 'IDENTITY') ||
                        (item.tag === 'DATA' && features.database) ||
                        (item.tag === 'IDENTITY' && features.auth),
                    )
                    .map(({ icon: Icon, title, desc, tag }) => (
                      <div
                        key={title}
                        className="flex items-center gap-3 rounded-lg border bg-background/60 p-3"
                      >
                        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-card text-primary">
                          <Icon size={18} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium">{title}</p>
                          <p className="mt-1 text-[10px] text-muted-foreground">{desc}</p>
                        </div>
                        <span className="text-[9px] tracking-wider text-muted-foreground">
                          {tag}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
              <div className="flex items-center gap-2 border-t bg-muted/40 px-5 py-3 font-mono text-[10px] text-muted-foreground">
                <Terminal size={13} />
                <span>pnpm setup</span>
                <ArrowRight size={11} />
                <span>pnpm dev</span>
              </div>
            </div>
          </div>
        </section>
        <section className="border-y bg-card/60">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 sm:grid-cols-3 sm:px-8">
            {[
              {
                n: '01',
                title: t('get_the_foundations_right'),
                body: t('selected_modules_description'),
              },
              {
                n: '02',
                title: t('start_small_grow_deliberately'),
                body: t(
                  'consistent_components_and_conventions_enable_optional_services_as_you_need_',
                ),
              },
              {
                n: '03',
                title: t('make_it_your_own'),
                body: t('run_in_your_account_shape_the_brand_and_build_what_matters_to_you'),
              },
            ].map((f) => (
              <div key={f.n}>
                <span className="font-mono text-[10px] text-primary">/{f.n}</span>
                <h2 className="mt-3 text-sm font-semibold">{f.title}</h2>
                <p className="mt-2 text-xs leading-6 text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer className="mx-auto flex max-w-6xl flex-wrap justify-between gap-4 px-5 py-7 text-xs text-muted-foreground sm:px-8">
        <span>
          {site.name} · v{site.version}
        </span>
        <span>TanStack Start × Cloudflare · MIT</span>
        <span>{t('start_small_build_thoughtfully')}</span>
      </footer>
    </div>
  )
}
