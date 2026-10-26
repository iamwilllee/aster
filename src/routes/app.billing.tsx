import { features } from '@/config/features'
import { notFound } from '@tanstack/react-router'
import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Check, CreditCard, ExternalLink, ShieldCheck } from 'lucide-react'
import { PageHeading, ErrorNotice } from '@/components/common'
import { useI18n } from '@/components/providers'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'

export const Route = createFileRoute('/app/billing')({
  beforeLoad: () => {
    if (!features.billing) throw notFound()
  },
  validateSearch: (search: Record<string, unknown>): { checkout?: string; canceled?: boolean } => ({
    checkout:
      typeof search.checkout === 'string'
        ? search.checkout
        : typeof search.checkout_id === 'string' && search.checkout_id.length <= 128
          ? 'creem:' + search.checkout_id
          : '',
    canceled: search.canceled === '1' || search.canceled === 1 || search.canceled === true,
  }),
  component: Billing,
})
function Billing() {
  const viewer = getRouteApi('/app').useLoaderData()
  const { checkout = '', canceled = false } = Route.useSearch()
  const { t } = useI18n()
  const billing = useQuery({
    queryKey: ['billing'],
    queryFn: () => api<typeof viewer.billing>('/api/billing'),
    initialData: viewer.billing,
    refetchInterval: checkout ? 5000 : false,
  })
  const order = useQuery({
    queryKey: ['checkout', checkout],
    queryFn: () =>
      api<{ status: string }>(`/api/billing/checkout-status?id=${encodeURIComponent(checkout)}`),
    enabled: !!checkout,
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.status === 'complete' || query.state.error ? false : 3000,
  })
  const action = useMutation({
    mutationFn: (path: string) => api<{ url: string }>(path, { method: 'POST' }),
    onSuccess: ({ url }) => {
      window.location.assign(url)
    },
  })
  const current = billing.data
  return (
    <>
      <PageHeading
        eyebrow="PLAN & BILLING"
        title={t('plan_billing')}
        description={t('enable_billing_when_you_need_it_entitlements_are_verified_on_the_server')}
      />
      <div className="mb-6 rounded-xl border border-primary/20 bg-accent px-5 py-4">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <ShieldCheck size={17} />
          {current.provider.ready
            ? t('provider_test_mode', {
                provider: current.provider.name === 'creem' ? 'Creem' : 'Stripe',
              })
            : t('payments_not_configured_checkout_disabled')}
        </div>
        <p className="mt-2 text-xs leading-6 text-muted-foreground">
          {t('v0_1_supports_test_subscriptions_live_payments_refunds_and_tax_rules_requir')}
        </p>
      </div>
      {checkout && (
        <div role="status" className="mb-5 rounded-lg border bg-card p-4 text-sm">
          {order.isError
            ? t('no_matching_order_found_for_this_account')
            : order.data?.status === 'complete'
              ? t('webhook_confirmed_your_plan_reflects_the_current_subscription_state')
              : t('waiting_for_the_verified_payment_event_returning_here_does_not_grant_access')}
        </div>
      )}
      {canceled && (
        <p role="status" className="mb-5 text-sm text-muted-foreground">
          {t('returned_to_the_workspace_your_plan_has_not_changed')}
        </p>
      )}
      {action.error && (
        <div className="mb-5">
          <ErrorNotice>{action.error.message}</ErrorNotice>
        </div>
      )}
      {billing.error && (
        <div className="mb-5">
          <ErrorNotice>{billing.error.message}</ErrorNotice>
        </div>
      )}
      <div className="grid max-w-3xl gap-5 sm:grid-cols-2">
        {[
          {
            id: 'free',
            title: 'Free',
            count: 3,
            description: t('a_place_to_begin'),
            features: [
              t('3_private_projects'),
              t('account_email_verification'),
              t('editing_filtering_and_persistence'),
            ],
          },
          {
            id: 'pro',
            title: 'Pro',
            count: 50,
            description: t('test_a_complete_subscription_workflow'),
            features: [
              t('50_private_projects'),
              t('server_enforced_limits'),
              t('test_subscriptions_billing_portal'),
            ],
          },
        ].map((plan) => (
          <section
            key={plan.id}
            className={`rounded-xl border bg-card p-6 ${plan.id === 'pro' ? 'border-primary/30' : ''}`}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{plan.title}</h2>
              {current.plan === plan.id && (
                <Badge variant="secondary" className="text-[10px]">
                  {t('current_plan')}
                </Badge>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{plan.description}</p>
            <div className="my-6 border-b pb-6">
              <span className="font-mono text-3xl">{plan.count}</span>
              <span className="ml-2 text-xs text-muted-foreground">{t('projects')}</span>
              <p className="mt-2 text-[10px] text-muted-foreground">
                {plan.id === 'free'
                  ? t('built_in_free_allowance')
                  : t('price_is_defined_by_provider_test_product')}
              </p>
            </div>
            <ul className="mb-7 space-y-3">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-xs">
                  <Check size={14} className="text-primary" />
                  {f}
                </li>
              ))}
            </ul>
            {plan.id === 'pro' ? (
              <Button
                className="w-full"
                disabled={!current.provider.ready || action.isPending || current.plan === 'pro'}
                onClick={() => action.mutate('/api/billing/checkout')}
              >
                <CreditCard size={14} />
                {current.plan === 'pro'
                  ? t('active')
                  : current.provider.ready
                    ? t('test_subscription')
                    : t('not_configured')}
              </Button>
            ) : (
              <div className="rounded-lg border py-2 text-center text-xs text-muted-foreground">
                {t('included_by_default')}
              </div>
            )}
          </section>
        ))}
      </div>
      {current.subscriptions.map((subscription) => (
        <section
          key={subscription.provider}
          className="mt-6 flex max-w-3xl flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-5"
        >
          <div>
            <p className="text-sm font-medium">
              {t('subscription_status')} · {subscription.provider === 'creem' ? 'Creem' : 'Stripe'}{' '}
              · {subscription.status}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {subscription.cancelAtPeriodEnd
                ? t('cancels_at_period_end')
                : t('synchronized_from_payment_provider')}
            </p>
          </div>
          <Button
            variant="outline"
            disabled={!subscription.configured || action.isPending}
            onClick={() =>
              action.mutate(
                '/api/billing/portal?provider=' + encodeURIComponent(subscription.provider),
              )
            }
          >
            {t('billing_portal')}
            <ExternalLink size={13} />
          </Button>
        </section>
      ))}
    </>
  )
}
