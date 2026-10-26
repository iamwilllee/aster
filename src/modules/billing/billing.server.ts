import { env } from 'cloudflare:workers'
import { features } from '@/config/features'
import { plans } from '@/config/site'
import { database } from '@/server/database.server'
import { HttpError } from '@/server/http.server'
import type { Locale } from '@/i18n/core'
import { hasProAccess } from './policy'
import { paymentProvider } from './config.mjs'
import * as stripe from './stripe.server'
import { creemStatus, creemAccess, creemCheckout, creemPortal, creemWebhook } from './creem.server'
export { stripeClient } from './stripe.server'

export function billingStatus() {
  const provider = paymentProvider(env)
  return provider === 'creem'
    ? creemStatus()
    : provider === 'stripe'
      ? { name: 'stripe' as const, ...stripe.stripeStatus() }
      : {
          name: 'unsupported' as const,
          enabled: false,
          configured: false,
          ready: false,
          mode: 'test' as const,
        }
}
export async function getBilling(userId: string) {
  const rows = features.billing
    ? await database()
        .prepare(
          'SELECT provider,status,price_id,current_period_end,cancel_at_period_end FROM subscription WHERE user_id=? ORDER BY updated_at DESC',
        )
        .bind(userId)
        .all<{
          provider: string
          status: string
          price_id: string
          current_period_end: number
          cancel_at_period_end: number
        }>()
    : { results: [] }
  const pro = rows.results.find((row) =>
    row.provider === 'stripe'
      ? hasProAccess(row, env.STRIPE_PRICE_ID)
      : row.provider === 'creem' && creemAccess(row),
  )
  const latest = pro ?? rows.results[0]
  const subscription = (row: NonNullable<typeof latest>) => ({
    provider: row.provider,
    status: row.status,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: !!row.cancel_at_period_end,
  })
  const known = [...new Map(rows.results.map((row) => [row.provider, row])).keys()]
  return {
    provider: billingStatus(),
    plan: pro ? ('pro' as const) : ('free' as const),
    projectLimit: pro ? plans.pro.projectLimit : plans.free.projectLimit,
    subscription: latest ? subscription(latest) : null,
    subscriptions: known.map((provider) => ({
      ...subscription(rows.results.find((row) => row.provider === provider)!),
      configured:
        provider === 'stripe'
          ? stripe.stripeStatus().configured
          : provider === 'creem' && creemStatus().configured,
    })),
  }
}
export async function checkout(userId: string, email: string, locale: Locale = 'en') {
  const provider = paymentProvider(env)
  if (!provider) throw new HttpError(503, '未选择可用的支付渠道。')
  if ((await getBilling(userId)).plan === 'pro')
    throw new HttpError(409, '已有有效订阅，请通过账单门户管理')
  const conflict = await database()
    .prepare(
      "SELECT id FROM subscription WHERE user_id=? AND provider<>? AND status NOT IN ('canceled','incomplete_expired') UNION ALL SELECT id FROM checkout WHERE user_id=? AND provider<>? AND status NOT IN ('complete','expired') LIMIT 1",
    )
    .bind(userId, provider, userId, provider)
    .first()
  if (conflict) throw new HttpError(409, '其他支付渠道仍有待处理记录，请先核对账务。')
  return provider === 'creem'
    ? creemCheckout(userId, email, locale)
    : stripe.checkout(userId, email, locale)
}
export async function portal(userId: string, locale: Locale = 'en', chosen?: string) {
  const provider = chosen ?? paymentProvider(env)
  if (provider === 'creem') return creemPortal(userId)
  if (provider === 'stripe') return stripe.portal(userId, locale)
  throw new HttpError(400, '未选择可用的支付渠道。')
}
export async function webhook(request: Request) {
  const path = new URL(request.url).pathname
  const creem = request.headers.has('creem-signature'),
    stripeHeader = request.headers.has('stripe-signature')
  if (creem === stripeHeader) throw new HttpError(400, '支付事件签名无效')
  if ((path.endsWith('/stripe') && !stripeHeader) || (path.endsWith('/creem') && !creem))
    throw new HttpError(400, '支付事件签名无效')
  return creem ? creemWebhook(request) : stripe.webhook(request)
}
