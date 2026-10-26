import { features } from '@/config/features'
import { createFileRoute, getRouteApi, Link } from '@tanstack/react-router'
import {
  Database,
  Cloud,
  Mail,
  CreditCard,
  Box,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react'
import { PageHeading } from '@/components/common'
import { useI18n } from '@/components/providers'
import { Badge } from '@/components/ui/badge'

export const Route = createFileRoute('/app/services')({ component: Services })
function Services() {
  const viewer = getRouteApi('/app').useLoaderData()
  const { t } = useI18n()
  const services = [
    {
      icon: Cloud,
      name: 'Cloudflare Workers',
      text: viewer.local
        ? t('running_in_the_local_cloudflare_runtime')
        : t('running_in_a_cloudflare_worker'),
      status: viewer.local ? t('local') : t('connected'),
      ready: true,
    },
    {
      icon: Database,
      name: 'Cloudflare D1',
      text: t('accounts_projects_and_plan_data_database_query_verified'),
      status: t('connected'),
      ready: true,
    },
    {
      icon: Mail,
      name: 'Transactional email',
      text:
        viewer.mailMode === 'local'
          ? t('messages_are_stored_in_the_local_test_inbox_no_delivery_to_external_recipie')
          : viewer.mailReady
            ? t('mail_provider_configured_pending', {
                provider:
                  viewer.mailMode === 'cloudflare'
                    ? 'Cloudflare'
                    : viewer.mailMode === 'brevo'
                      ? 'Brevo'
                      : 'Resend',
              })
            : t('production_email_is_not_configured'),
      status:
        viewer.mailMode === 'local'
          ? t('local_test')
          : viewer.mailReady
            ? t('not_verified')
            : t('unconfigured'),
      ready: viewer.mailMode === 'local',
    },
    {
      icon: ShieldCheck,
      name: 'Google OAuth',
      text: viewer.google.ready ? t('google_configured_pending') : t('google_unconfigured'),
      status: viewer.google.ready ? t('not_verified') : t('unconfigured'),
      ready: false,
    },
    {
      icon: CreditCard,
      name: viewer.billing.provider.name === 'creem' ? 'Creem' : 'Stripe',
      text: t('test_keys_only_entitlements_change_after_verified_webhook_synchronization'),
      status: viewer.billing.provider.ready ? t('test_mode') : t('unconfigured'),
      ready: viewer.billing.provider.ready,
    },
    {
      icon: Box,
      name: 'Cloudflare R2',
      text: t('files_private_notice'),
      status: viewer.local ? t('local_test') : t('not_verified'),
      ready: false,
    },
    {
      icon: Sparkles,
      name: 'Workers AI',
      text: t('an_optional_future_module_no_model_requests_are_made_in_v0_1'),
      status: t('disabled'),
      ready: false,
    },
  ].filter(
    (service) =>
      ({
        'Transactional email': features.mail,
        'Google OAuth': features.google,
        Stripe: features.billing,
        Creem: features.billing,
        'Cloudflare R2': features.files,
        'Workers AI': features.ai,
      })[service.name] ?? true,
  )
  return (
    <>
      <PageHeading
        eyebrow="CONNECTED SERVICES"
        title={t('services')}
        description={t('a_clear_view_of_what_is_connected_and_what_is_not')}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {services.map(({ icon: Icon, name, text, status, ready }) => (
          <section key={name} className="rounded-xl border bg-card p-6">
            <div className="flex items-center justify-between">
              <span className="grid size-10 place-items-center rounded-lg border bg-background text-primary">
                <Icon size={20} strokeWidth={1.5} />
              </span>
              <Badge variant={ready ? 'secondary' : 'outline'} className="text-[10px]">
                {status}
              </Badge>
            </div>
            <h2 className="mt-5 text-sm font-semibold">{name}</h2>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">{text}</p>
          </section>
        ))}
      </div>
      {viewer.local && features.mail && features.database && (
        <Link to="/dev/inbox" className="mt-6 inline-flex items-center gap-2 text-xs text-primary">
          {t('open_local_test_inbox')}
          <ArrowUpRight size={14} />
        </Link>
      )}
    </>
  )
}
