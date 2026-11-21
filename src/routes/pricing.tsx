import { features } from '@/config/features'
import { notFound } from '@tanstack/react-router'
import { createFileRoute, Link, getRouteApi } from '@tanstack/react-router'
import { ArrowUpRight, Check } from 'lucide-react'
import { buttonProps } from '@/components/ui/button'
import { Logo, Main, Preferences } from '@/components/common'
import { useI18n } from '@/components/providers'

export const Route = createFileRoute('/pricing')({
  beforeLoad: () => {
    if (!features.billing) throw notFound()
  },
  component: Pricing,
})
function Pricing() {
  const { t } = useI18n()
  const { registrationReady } = getRouteApi('__root__').useLoaderData()
  return (
    <div className="mx-auto max-w-5xl px-6">
      <header className="flex items-center justify-between py-6">
        <Logo />
        <Preferences />
      </header>
      <Main className="py-16">
        <p className="text-center text-[10px] font-semibold tracking-[0.2em] text-primary">
          START SMALL. GROW YOUR WAY.
        </p>
        <h1 className="mt-5 text-center text-4xl font-semibold tracking-tight">
          {t('room_for_your_next_step')}
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-center text-sm leading-7 text-muted-foreground">
          {t('these_are_example_plans_for_starter_free_is_built_in_pro_demonstrates_strip')}
        </p>
        <div className="mx-auto mt-12 grid max-w-2xl gap-5 sm:grid-cols-2">
          {[
            { name: 'Free', quota: 3, text: t('begin_with_an_idea') },
            {
              name: 'Pro',
              quota: 50,
              text: t('explore_billing_entitlements'),
            },
          ].map((plan) => (
            <section key={plan.name} className="rounded-xl border bg-card p-7">
              <h2 className="text-xl font-semibold">{plan.name}</h2>
              <p className="mt-2 text-xs text-muted-foreground">{plan.text}</p>
              <p className="my-8 font-mono text-4xl">
                {plan.quota}
                <span className="ml-2 font-sans text-xs text-muted-foreground">
                  {t('projects')}
                </span>
              </p>
              <ul className="mb-8 space-y-4">
                {[
                  t('private_data_server_authorization'),
                  t('save_edit_and_filter_projects'),
                  plan.name === 'Pro'
                    ? t('stripe_test_subscription')
                    : t('no_payment_details_required'),
                ].map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-xs">
                    <Check size={14} className="text-primary" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                to={
                  plan.name === 'Free' ? (registrationReady ? '/signup' : '/login') : '/app/billing'
                }
                {...buttonProps({ variant: plan.name === 'Pro' ? 'default' : 'outline' })}
                className="w-full"
              >
                {plan.name === 'Free'
                  ? registrationReady
                    ? t('get_started')
                    : t('go_to_sign_in')
                  : t('view_test_configuration')}
                <ArrowUpRight size={14} />
              </Link>
            </section>
          ))}
        </div>
      </Main>
    </div>
  )
}
