import { env } from 'cloudflare:workers'
import { z } from 'zod'
import { features } from '@/config/features'
import { database } from '@/server/database.server'
import { boundedText, HttpError } from '@/server/http.server'
import { localizePath, type Locale } from '@/i18n/core'
import type { BillingLock } from './deletion.server'
import type { BillingDeletionStatus } from '@/modules/auth/lifecycle'

const id = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/)
const relation = z.union([id, z.object({ id })])
const reference = (value: z.infer<typeof relation>) =>
  typeof value === 'string' ? value : value.id
const mode = z.enum(['test', 'sandbox'])
const subscriptionSchema = z.object({
  id,
  mode,
  product: relation,
  customer: relation,
  status: z.enum([
    'active',
    'canceled',
    'unpaid',
    'paused',
    'trialing',
    'scheduled_cancel',
    'past_due',
  ]),
  current_period_end_date: z.iso.datetime({ offset: true }).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  last_transaction: z.object({ status: z.string() }).optional().nullable(),
})
const checkoutSchema = z.object({
  id,
  mode,
  request_id: z.string().min(1).max(128).optional(),
  product: relation,
  status: z.enum(['pending', 'processing', 'completed', 'expired']),
  customer: relation.optional().nullable(),
  subscription: relation.optional().nullable(),
  order: z.object({ status: z.string() }).optional().nullable(),
  checkout_url: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})
export function creemStatus() {
  const configured =
    !!env.CREEM_API_KEY &&
    !/[\r\n]/.test(env.CREEM_API_KEY) &&
    !!env.CREEM_WEBHOOK_SECRET &&
    !!env.CREEM_PRODUCT_ID
  const enabled = features.billing && env.BILLING_ENABLED === 'true'
  return {
    name: 'creem' as const,
    enabled,
    configured,
    mode: 'test' as const,
    ready: enabled && configured,
  }
}
export function creemAccess(
  row: { status: string; price_id: string; current_period_end: number },
  now = Date.now(),
) {
  return (
    !!env.CREEM_PRODUCT_ID &&
    row.price_id === env.CREEM_PRODUCT_ID &&
    ['active', 'trialing', 'scheduled_cancel'].includes(row.status) &&
    row.current_period_end * 1000 > now
  )
}
async function request<T extends z.ZodType>(
  path: string,
  schema: T,
  data?: unknown,
): Promise<z.infer<T>> {
  if (!creemStatus().configured) throw new HttpError(503, 'Creem 测试支付尚未配置。')
  // Fixed sandbox host, no redirects or automatic retries. Never log provider bodies or keys.
  const response = await fetch('https://test-api.creem.io' + path, {
    method: data === undefined ? 'GET' : 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(5000),
    headers: {
      'x-api-key': env.CREEM_API_KEY!,
      ...(data === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  })
  if (!response.ok) {
    await response.body?.cancel()
    throw new HttpError(503, '支付服务暂时不可用，请稍后重试。')
  }
  const value: unknown = JSON.parse(
    await boundedText(
      new Request('https://test-api.creem.io', {
        method: 'POST',
        body: response.body,
        duplex: 'half',
      } as RequestInit),
      1_000_000,
    ),
  )
  const parsed = schema.safeParse(value)
  if (!parsed.success) throw new HttpError(503, '支付服务返回了无法验证的数据。')
  return parsed.data
}
function safeUrl(value: string) {
  const url = new URL(value)
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    !(url.hostname === 'creem.io' || url.hostname.endsWith('.creem.io'))
  )
    throw new HttpError(503, '支付服务返回了无法验证的数据。')
  return url.toString()
}
const storedId = (value: string) => 'creem:' + value
const nativeId = (value: string) => id.parse(value.replace(/^creem:/, ''))
const guard =
  "NOT EXISTS (SELECT 1 FROM billing_account_state WHERE user_id=? AND (closed_at IS NOT NULL OR lock_until > unixepoch('subsec')*1000))"
export async function creemCheckout(userId: string, email: string, locale: Locale) {
  if (!creemStatus().ready) throw new HttpError(503, 'Creem 测试支付尚未配置或结账已关闭。')
  const db = database(),
    nonce = crypto.randomUUID(),
    reservation = storedId('pending:' + nonce)
  const reserved = await db
    .prepare(
      `INSERT INTO checkout (id,provider,user_id,status,created_at) SELECT ?,'creem',?,'pending',? WHERE EXISTS (SELECT 1 FROM user WHERE id=?) AND ${guard}`,
    )
    .bind(reservation, userId, Date.now(), userId, userId)
    .run()
  if (!reserved.meta.changes) throw new HttpError(409, '账号正在核对注销条件，请稍后重试。')
  const result = await request('/v1/checkouts', checkoutSchema, {
    request_id: nonce,
    product_id: env.CREEM_PRODUCT_ID,
    customer: { email },
    success_url: env.APP_ORIGIN + localizePath('/app/billing', locale),
    metadata: { userId },
  })
  if (
    result.request_id !== nonce ||
    reference(result.product) !== env.CREEM_PRODUCT_ID ||
    !result.checkout_url
  )
    throw new HttpError(503, '支付服务返回了无法验证的数据。')
  const url = safeUrl(result.checkout_url)
  const saved = await db.batch([
    db
      .prepare(
        `INSERT INTO checkout (id,provider,user_id,status,created_at) SELECT ?,'creem',?,'pending',? WHERE EXISTS (SELECT 1 FROM checkout WHERE id=? AND user_id=? AND provider='creem') AND EXISTS (SELECT 1 FROM user WHERE id=?) ON CONFLICT(id) DO NOTHING`,
      )
      .bind(storedId(result.id), userId, Date.now(), reservation, userId, userId),
    db
      .prepare(
        "DELETE FROM checkout WHERE id=? AND user_id=? AND EXISTS (SELECT 1 FROM checkout AS actual WHERE actual.id=? AND actual.user_id=? AND actual.provider='creem')",
      )
      .bind(reservation, userId, storedId(result.id), userId),
  ])
  if (
    !saved[0]?.meta.changes &&
    !(await db
      .prepare("SELECT id FROM checkout WHERE id=? AND user_id=? AND provider='creem'")
      .bind(storedId(result.id), userId)
      .first())
  )
    throw new HttpError(409, '账号正在核对注销条件，请稍后重试。')
  return { url }
}
export async function creemPortal(userId: string) {
  const row = await database()
    .prepare(
      "SELECT customer_id FROM subscription WHERE provider='creem' AND user_id=? ORDER BY updated_at DESC LIMIT 1",
    )
    .bind(userId)
    .first<{ customer_id: string }>()
  if (!row) throw new HttpError(404, '还没有可管理的订阅')
  const result = await request(
    '/v1/customers/billing',
    z.object({ customer_portal_link: z.string() }),
    { customer_id: row.customer_id },
  )
  return { url: safeUrl(result.customer_portal_link) }
}
async function syncSubscription(
  subscriptionId: string,
  eventId: string,
  eventType: string,
  checkout?: z.infer<typeof checkoutSchema>,
) {
  const db = database(),
    key = storedId(subscriptionId)
  for (let attempt = 0; attempt < 4; attempt++) {
    if (await db.prepare('SELECT id FROM billing_event WHERE id=?').bind(storedId(eventId)).first())
      return
    const previous = await db
      .prepare(
        "SELECT user_id AS owner_ref,customer_id,revision FROM subscription WHERE provider='creem' AND id=? UNION ALL SELECT owner_ref,customer_id,revision FROM billing_subscription_archive WHERE provider='creem' AND id=?",
      )
      .bind(key, key)
      .first<{ owner_ref: string; customer_id: string; revision: number }>()
    const sub = await request(
      '/v1/subscriptions?subscription_id=' + encodeURIComponent(subscriptionId),
      subscriptionSchema,
    )
    if (sub.id !== subscriptionId) throw new HttpError(422, '支付记录缺少有效的账号关联。')
    let userId = previous?.owner_ref
    if (checkout) {
      if (
        !checkout.request_id ||
        !checkout.customer ||
        reference(checkout.customer) !== reference(sub.customer) ||
        reference(checkout.product) !== reference(sub.product) ||
        checkout.order?.status !== 'paid'
      )
        throw new HttpError(422, '支付记录缺少有效的账号关联。')
      const owner = await db
        .prepare(
          "SELECT user_id AS owner_ref FROM checkout WHERE provider='creem' AND id IN (?,?) UNION ALL SELECT owner_ref FROM billing_checkout_archive WHERE provider='creem' AND id IN (?,?)",
        )
        .bind(
          storedId(checkout.id),
          storedId('pending:' + checkout.request_id),
          storedId(checkout.id),
          storedId('pending:' + checkout.request_id),
        )
        .all<{ owner_ref: string }>()
      const owners = new Set(owner.results.map((row) => row.owner_ref))
      if (owners.size !== 1) throw new HttpError(422, '支付记录缺少有效的账号关联。')
      const matched = owner.results[0]!.owner_ref
      if (userId && userId !== matched) throw new HttpError(422, '支付记录缺少有效的账号关联。')
      userId = matched
    }
    // Out-of-order subscription events retry until an owned checkout establishes the association.
    if (!userId) throw new HttpError(503, '订阅状态正在同步，请重试事件')
    if (previous?.customer_id && previous.customer_id !== reference(sub.customer))
      throw new HttpError(422, '支付记录缺少有效的账号关联。')
    if (sub.metadata?.userId !== undefined && sub.metadata.userId !== userId)
      throw new HttpError(422, '支付记录缺少有效的账号关联。')
    const state = await db
      .prepare('SELECT closed_at,lock_until FROM billing_account_state WHERE user_id=?')
      .bind(userId)
      .first<{ closed_at: number | null; lock_until: number }>()
    if (state && state.lock_until > Date.now())
      throw new HttpError(503, '订阅状态正在同步，请重试事件')
    const archived = state?.closed_at != null
    const table = archived ? 'billing_subscription_archive' : 'subscription',
      ownerColumn = archived ? 'owner_ref' : 'user_id',
      checkoutTable = archived ? 'billing_checkout_archive' : 'checkout'
    if (!archived && !(await db.prepare('SELECT id FROM user WHERE id=?').bind(userId).first()))
      throw new HttpError(422, '支付记录缺少有效的账号关联。')
    const expires = sub.current_period_end_date
      ? Math.floor(Date.parse(sub.current_period_end_date) / 1000)
      : 0
    const accessStatus =
      sub.last_transaction && !['paid'].includes(sub.last_transaction.status)
        ? sub.last_transaction.status
        : sub.status
    const sync = crypto.randomUUID(),
      now = Date.now()
    const results = await db.batch([
      db
        .prepare(
          `INSERT INTO ${table} (id,provider,${ownerColumn},customer_id,status,price_id,current_period_end,cancel_at_period_end,revision,sync_id,updated_at${archived ? ',archived_at' : ''})
        SELECT ?,'creem',?,?,?,?,?,?,1,?,?${archived ? ',?' : ''} WHERE NOT EXISTS (SELECT 1 FROM billing_account_state WHERE user_id=? AND lock_until>unixepoch('subsec')*1000)
        AND ${archived ? 'EXISTS (SELECT 1 FROM billing_account_state WHERE user_id=? AND closed_at IS NOT NULL)' : 'EXISTS (SELECT 1 FROM user WHERE id=?)'}
        ON CONFLICT(id) DO UPDATE SET status=excluded.status,price_id=excluded.price_id,current_period_end=excluded.current_period_end,cancel_at_period_end=excluded.cancel_at_period_end,revision=${table}.revision+1,sync_id=excluded.sync_id,updated_at=excluded.updated_at
        WHERE ${table}.provider='creem' AND ${table}.${ownerColumn}=excluded.${ownerColumn} AND ${table}.revision=?`,
        )
        .bind(
          key,
          userId,
          reference(sub.customer),
          accessStatus,
          reference(sub.product),
          expires,
          sub.status === 'scheduled_cancel' ? 1 : 0,
          sync,
          now,
          ...(state?.closed_at != null ? [state.closed_at] : []),
          userId,
          userId,
          previous?.revision ?? 0,
        ),
      db
        .prepare(
          `INSERT INTO billing_event (id,type,processed_at) SELECT ?,?,? WHERE EXISTS (SELECT 1 FROM ${table} WHERE id=? AND sync_id=?) ON CONFLICT(id) DO NOTHING`,
        )
        .bind(storedId(eventId), 'creem:' + eventType, now, key, sync),
      db
        .prepare(
          `INSERT INTO ${checkoutTable} (id,provider,${ownerColumn},status,created_at${archived ? ',archived_at' : ''})
        SELECT ?,'creem',?,'complete',?${archived ? ',?' : ''} WHERE EXISTS (SELECT 1 FROM ${table} WHERE id=? AND sync_id=?) AND ? <> '' ON CONFLICT(id) DO NOTHING`,
        )
        .bind(
          storedId(checkout?.id ?? ''),
          userId,
          now,
          ...(state?.closed_at != null ? [state.closed_at] : []),
          key,
          sync,
          checkout?.id ?? '',
        ),
      db
        .prepare(
          `UPDATE ${checkoutTable} SET status='complete' WHERE provider='creem' AND ${ownerColumn}=? AND id IN (?,?) AND EXISTS (SELECT 1 FROM ${table} WHERE id=? AND sync_id=?)`,
        )
        .bind(
          userId,
          storedId(checkout?.id ?? ''),
          storedId('pending:' + (checkout?.request_id ?? '')),
          key,
          sync,
        ),
      db
        .prepare(
          `DELETE FROM ${checkoutTable} WHERE id=? AND ${ownerColumn}=? AND EXISTS (SELECT 1 FROM ${checkoutTable} AS actual WHERE actual.id=? AND actual.${ownerColumn}=? AND actual.provider='creem') AND EXISTS (SELECT 1 FROM ${table} WHERE id=? AND sync_id=?)`,
        )
        .bind(
          storedId('pending:' + (checkout?.request_id ?? '')),
          userId,
          storedId(checkout?.id ?? ''),
          userId,
          key,
          sync,
        ),
    ])
    if (results[0]?.meta.changes) {
      if (archived && sub.status !== 'canceled')
        console.warn(
          JSON.stringify({
            event: 'closed_account_billing_attention',
            provider: 'creem',
            providerEventId: eventId,
            status: sub.status,
          }),
        )
      return
    }
  }
  throw new HttpError(503, '订阅状态正在同步，请重试事件')
}
export async function creemWebhook(req: Request) {
  if (!creemStatus().configured) throw new HttpError(503, 'Creem 测试支付尚未配置。')
  const raw = await boundedText(req, 262144),
    signature = req.headers.get('creem-signature') ?? ''
  if (!/^[a-f0-9]{64}$/i.test(signature)) throw new HttpError(400, '支付事件签名无效')
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.CREEM_WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )
  if (
    !(await crypto.subtle.verify(
      'HMAC',
      key,
      Uint8Array.from(signature.match(/../g)!, (value) => parseInt(value, 16)),
      new TextEncoder().encode(raw),
    ))
  )
    throw new HttpError(400, '支付事件签名无效')
  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    throw new HttpError(400, '支付事件签名无效')
  }
  const event = z
    .object({ id, eventType: z.string().max(100), object: z.object({ id, mode }) })
    .safeParse(payload)
  if (!event.success) throw new HttpError(400, '当前仅接受测试支付事件。')
  if (
    await database()
      .prepare('SELECT id FROM billing_event WHERE id=?')
      .bind(storedId(event.data.id))
      .first()
  )
    return { received: true }
  if (event.data.eventType === 'checkout.completed') {
    const checkout = await request(
      '/v1/checkouts?checkout_id=' + encodeURIComponent(event.data.object.id),
      checkoutSchema,
    )
    if (
      checkout.id !== event.data.object.id ||
      checkout.status !== 'completed' ||
      !checkout.subscription
    )
      throw new HttpError(503, '订阅状态正在同步，请重试事件')
    await syncSubscription(
      reference(checkout.subscription),
      event.data.id,
      event.data.eventType,
      checkout,
    )
  } else if (
    [
      'subscription.active',
      'subscription.paid',
      'subscription.canceled',
      'subscription.scheduled_cancel',
      'subscription.past_due',
      'subscription.unpaid',
      'subscription.paused',
      'subscription.trialing',
    ].includes(event.data.eventType)
  ) {
    await syncSubscription(event.data.object.id, event.data.id, event.data.eventType)
  }
  return { received: true }
}
export async function reviewCreemBilling(lock: BillingLock): Promise<BillingDeletionStatus> {
  const db = database(),
    unknown: BillingDeletionStatus = { state: 'unknown', canCloseCheckouts: false }
  const [subscriptions, checkouts] = await db.batch<{ id: string; customer_id?: string }>([
    db
      .prepare(
        "SELECT id,customer_id FROM subscription WHERE provider='creem' AND user_id=? ORDER BY id LIMIT 101",
      )
      .bind(lock.userId),
    db
      .prepare("SELECT id FROM checkout WHERE provider='creem' AND user_id=? ORDER BY id LIMIT 101")
      .bind(lock.userId),
  ])
  if (!subscriptions || !checkouts) return unknown
  if (!subscriptions.results.length && !checkouts.results.length)
    return { state: 'none', canCloseCheckouts: false }
  if (
    subscriptions.results.length > 100 ||
    checkouts.results.length > 100 ||
    checkouts.results.some((row) => row.id.startsWith('creem:pending:'))
  )
    return unknown
  const deadline = Math.min(lock.until, Date.now() + 25000),
    customers = new Set<string>()
  const verifiedSubs: z.infer<typeof subscriptionSchema>[] = []
  const verifiedCheckouts: z.infer<typeof checkoutSchema>[] = []
  let active = false,
    open = false,
    unpaid = false
  const budget = () => {
    if (Date.now() >= deadline) throw new Error('Review budget exceeded')
  }
  try {
    const localSubs = new Set(subscriptions.results.map((row) => nativeId(row.id)))
    for (const row of subscriptions.results) {
      budget()
      const sub = await request(
        '/v1/subscriptions?subscription_id=' + encodeURIComponent(nativeId(row.id)),
        subscriptionSchema,
      )
      if (storedId(sub.id) !== row.id || reference(sub.customer) !== row.customer_id) return unknown
      if (sub.metadata?.userId !== undefined && sub.metadata.userId !== lock.userId) return unknown
      verifiedSubs.push(sub)
      customers.add(reference(sub.customer))
      if (sub.status !== 'canceled') active = true
    }
    for (const row of checkouts.results) {
      budget()
      const item = await request(
        '/v1/checkouts?checkout_id=' + encodeURIComponent(nativeId(row.id)),
        checkoutSchema,
      )
      if (storedId(item.id) !== row.id || item.metadata?.userId !== lock.userId) return unknown
      verifiedCheckouts.push(item)
      if (item.status === 'pending' || item.status === 'processing') open = true
      if (item.status === 'completed' && item.order?.status !== 'paid') unpaid = true
      if (item.customer) customers.add(reference(item.customer))
      if (item.subscription && !localSubs.has(reference(item.subscription))) return unknown
    }
    if (customers.size > 5) return unknown
    const pagination = z.object({
      total_pages: z.number().int().nonnegative(),
      current_page: z.number().int().positive(),
      next_page: z.number().int().positive().nullable(),
    })
    // Creem exposes store-wide subscription search, not a customer filter. Bound the complete scan.
    for (let page = 1; page <= 3; page++) {
      budget()
      const list = await request(
        '/v1/subscriptions/search?page_size=100&page_number=' + page,
        z.object({ items: z.array(subscriptionSchema), pagination }),
      )
      for (const sub of list.items)
        if (customers.has(reference(sub.customer)) && sub.status !== 'canceled') active = true
      if (list.pagination.current_page !== page) return unknown
      if (list.pagination.next_page === null && page >= list.pagination.total_pages) break
      if (list.pagination.next_page !== page + 1 || page === 3) return unknown
    }
    const tx = z.object({
      mode,
      customer: z.string().optional(),
      status: z.enum([
        'pending',
        'paid',
        'refunded',
        'partialRefund',
        'chargedBack',
        'uncollectible',
        'declined',
        'canceled',
        'void',
      ]),
    })
    for (const customer of customers)
      for (let page = 1; page <= 3; page++) {
        budget()
        const list = await request(
          '/v1/transactions/search?customer_id=' +
            encodeURIComponent(customer) +
            '&page_size=100&page_number=' +
            page,
          z.object({ items: z.array(tx), pagination }),
        )
        if (list.items.some((item) => item.customer && item.customer !== customer)) return unknown
        if (
          list.items.some((item) => !['paid', 'refunded', 'canceled', 'void'].includes(item.status))
        )
          unpaid = true
        if (list.pagination.current_page !== page) return unknown
        if (list.pagination.next_page === null && page >= list.pagination.total_pages) break
        if (list.pagination.next_page !== page + 1 || page === 3) return unknown
      }
    budget()
    const guarded =
      "EXISTS (SELECT 1 FROM billing_account_state WHERE user_id=? AND lock_id=? AND closed_at IS NULL AND lock_until>unixepoch('subsec')*1000)"
    const writes = verifiedSubs.map((sub) =>
      db
        .prepare(
          `UPDATE subscription SET status=?,current_period_end=?,cancel_at_period_end=?,revision=revision+1,sync_id=?,updated_at=? WHERE provider='creem' AND id=? AND user_id=? AND ${guarded}`,
        )
        .bind(
          sub.last_transaction && sub.last_transaction.status !== 'paid'
            ? sub.last_transaction.status
            : sub.status,
          sub.current_period_end_date
            ? Math.floor(Date.parse(sub.current_period_end_date) / 1000)
            : 0,
          sub.status === 'scheduled_cancel' ? 1 : 0,
          crypto.randomUUID(),
          Date.now(),
          storedId(sub.id),
          lock.userId,
          lock.userId,
          lock.id,
        ),
    )
    for (const item of verifiedCheckouts)
      writes.push(
        db
          .prepare(
            `UPDATE checkout SET status=? WHERE provider='creem' AND id=? AND user_id=? AND ${guarded}`,
          )
          .bind(
            item.status === 'completed' ? 'complete' : item.status,
            item.id.startsWith('creem:') ? item.id : storedId(item.id),
            lock.userId,
            lock.userId,
            lock.id,
          ),
      )
    if (writes.length && (await db.batch(writes)).some((item) => !item.meta.changes)) return unknown
    return {
      state: active ? 'subscription' : unpaid ? 'invoice' : open ? 'checkout' : 'ready',
      canCloseCheckouts: false,
    }
  } catch {
    return unknown
  }
}
