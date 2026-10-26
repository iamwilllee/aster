import type Stripe from 'stripe'
import { env } from 'cloudflare:workers'
import { database } from '@/server/database.server'
import { HttpError } from '@/server/http.server'
import type { BillingDeletionStatus } from '@/modules/auth/lifecycle'
import { stripeClient } from './stripe.server'

export interface BillingLock {
  userId: string
  id: string
  until: number
}
export async function acquireBillingLock(userId: string): Promise<BillingLock> {
  const now = Date.now()
  const lock = { userId, id: crypto.randomUUID(), until: now + 90_000 }
  const result = await database()
    .prepare(
      `INSERT INTO billing_account_state (user_id,lock_id,lock_until)
    SELECT ?,?,? WHERE EXISTS (SELECT 1 FROM user WHERE id = ?)
    ON CONFLICT(user_id) DO UPDATE SET lock_id=excluded.lock_id,lock_until=excluded.lock_until
    WHERE billing_account_state.closed_at IS NULL AND billing_account_state.lock_until <= ?`,
    )
    .bind(userId, lock.id, lock.until, userId, now)
    .run()
  if (!result.meta.changes) throw new HttpError(409, '账号正在核对注销条件，请稍后重试。')
  return lock
}
export async function releaseBillingLock(lock: BillingLock) {
  await database()
    .prepare(
      'UPDATE billing_account_state SET lock_id=NULL,lock_until=0 WHERE user_id=? AND lock_id=? AND closed_at IS NULL',
    )
    .bind(lock.userId, lock.id)
    .run()
}
const status = (
  state: BillingDeletionStatus['state'],
  canCloseCheckouts = false,
): BillingDeletionStatus => ({ state, canCloseCheckouts })
const terminal = (state: string) => state === 'canceled' || state === 'incomplete_expired'

// Bounded provider reads; a partial list, stale lease, missing association or provider outage never grants deletion.
export async function reviewStripeBilling(
  lock: BillingLock,
  closeCheckouts = false,
): Promise<BillingDeletionStatus> {
  const db = database()
  const [subscriptions, checkouts] = await db.batch<{
    id: string
    customer_id?: string
    status: string
    revision?: number
  }>([
    db
      .prepare(
        "SELECT id,customer_id,status,revision FROM subscription WHERE provider='stripe' AND user_id=? ORDER BY id LIMIT 101",
      )
      .bind(lock.userId),
    db
      .prepare(
        "SELECT id,status FROM checkout WHERE provider='stripe' AND user_id=? ORDER BY id LIMIT 101",
      )
      .bind(lock.userId),
  ])
  if (!subscriptions || !checkouts) return status('unknown')
  if (!subscriptions.results.length && !checkouts.results.length) return status('none')
  if (subscriptions.results.length > 100 || checkouts.results.length > 100) return status('unknown')
  // Opaque reservations cannot be proved absent from Stripe just because time has elapsed.
  if (checkouts.results.some((row) => String(row.id).startsWith('pending:')))
    return status('unknown')
  const deadline = Date.now() + 25_000
  const customers = new Set<string>()
  const subSnapshots = new Map<string, Stripe.Subscription>()
  const checkoutSnapshots = new Map<string, Stripe.Checkout.Session>()
  let activeSubscription = false
  let openCheckout = false
  let unpaidInvoice = false
  const budget = () => {
    if (Date.now() > deadline || Date.now() >= lock.until)
      throw new Error('Billing review budget exceeded')
  }
  async function listAll<T extends { id: string }>(
    load: (after?: string) => PromiseLike<{ data: T[]; has_more: boolean }>,
  ) {
    const rows: T[] = []
    let after: string | undefined
    for (let page = 0; page < 3; page++) {
      budget()
      const result = await load(after)
      rows.push(...result.data)
      if (!result.has_more) return rows
      if (!result.data.length) throw new Error('Incomplete provider list')
      after = result.data[result.data.length - 1]!.id
    }
    throw new Error('Provider list too large')
  }
  try {
    const stripe = stripeClient({ maxNetworkRetries: 0, timeout: 5000 })
    for (const row of checkouts.results) {
      budget()
      let session = await stripe.checkout.sessions.retrieve(String(row.id))
      if (
        session.livemode ||
        session.mode !== 'subscription' ||
        session.metadata?.userId !== lock.userId ||
        session.client_reference_id !== lock.userId
      )
        return status('unknown')
      if (session.status === 'open' && closeCheckouts) {
        budget()
        // The user explicitly confirmed closing these checkout links; this never cancels subscriptions.
        session = await stripe.checkout.sessions.expire(session.id)
        if (
          session.status !== 'expired' ||
          session.id !== row.id ||
          session.livemode ||
          session.metadata?.userId !== lock.userId ||
          session.client_reference_id !== lock.userId
        )
          return status('unknown')
      }
      if (session.status === 'open') openCheckout = true
      else if (session.status !== 'complete' && session.status !== 'expired')
        return status('unknown')
      if (
        session.status === 'complete' &&
        session.payment_status !== 'paid' &&
        session.payment_status !== 'no_payment_required'
      )
        unpaidInvoice = true
      const customer =
        typeof session.customer === 'string' ? session.customer : session.customer?.id
      if (customer) customers.add(customer)
      if (session.status === 'complete' && (!customer || !session.subscription))
        return status('unknown')
      // A completed session's subscription must be covered even if a webhook has not reached D1 yet.
      if (session.subscription) {
        budget()
        const id =
          typeof session.subscription === 'string' ? session.subscription : session.subscription.id
        const sub = await stripe.subscriptions.retrieve(id)
        if (sub.livemode || sub.metadata.userId !== lock.userId) return status('unknown')
        subSnapshots.set(sub.id, sub)
      }
      checkoutSnapshots.set(session.id, session)
    }
    for (const row of subscriptions.results) {
      budget()
      const sub = await stripe.subscriptions.retrieve(String(row.id))
      const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
      if (sub.livemode || sub.metadata.userId !== lock.userId || customer !== row.customer_id)
        return status('unknown')
      customers.add(customer)
      subSnapshots.set(sub.id, sub)
    }
    if (customers.size > 5) return status('unknown')
    for (const customer of customers) {
      // Include subscriptions missing from local webhook history; canceled-at-period-end is still active.
      const remoteSubs = await listAll((after) =>
        stripe.subscriptions.list({
          customer,
          status: 'all',
          limit: 100,
          ...(after ? { starting_after: after } : {}),
        }),
      )
      for (const sub of remoteSubs) {
        if (sub.livemode) return status('unknown')
        if (!terminal(sub.status)) activeSubscription = true
        if (sub.metadata.userId === lock.userId) subSnapshots.set(sub.id, sub)
      }
      const sessions = await listAll((after) =>
        stripe.checkout.sessions.list({
          customer,
          limit: 100,
          ...(after ? { starting_after: after } : {}),
        }),
      )
      // An untracked open session needs reconciliation rather than accidental omission.
      if (
        sessions.some(
          (session) =>
            session.livemode || (session.status === 'open' && !checkoutSnapshots.has(session.id)),
        )
      )
        return status('unknown')
      const invoices = await listAll((after) =>
        stripe.invoices.list({ customer, limit: 100, ...(after ? { starting_after: after } : {}) }),
      )
      if (invoices.some((invoice) => invoice.livemode)) return status('unknown')
      if (invoices.some((invoice) => invoice.status !== 'paid' && invoice.status !== 'void'))
        unpaidInvoice = true
    }
    for (const sub of subSnapshots.values()) if (!terminal(sub.status)) activeSubscription = true
    budget()
    // Sync only complete, validated provider snapshots while this lease still owns the account.
    const writes = []
    const guarded =
      "EXISTS (SELECT 1 FROM billing_account_state WHERE user_id=? AND lock_id=? AND lock_until>? AND lock_until > unixepoch('subsec')*1000 AND closed_at IS NULL)"
    for (const sub of subSnapshots.values()) {
      const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
      if (!customers.has(customer)) return status('unknown')
      const item = sub.items.data.find((entry) => entry.price.id === env.STRIPE_PRICE_ID)
      writes.push(
        db
          .prepare(
            `INSERT INTO subscription (id,user_id,customer_id,status,price_id,current_period_end,cancel_at_period_end,revision,sync_id,updated_at)
        SELECT ?,?,?,?,?,?,?,1,?,? WHERE ${guarded}
        ON CONFLICT(id) DO UPDATE SET status=excluded.status,price_id=excluded.price_id,current_period_end=excluded.current_period_end,cancel_at_period_end=excluded.cancel_at_period_end,revision=subscription.revision+1,sync_id=excluded.sync_id,updated_at=excluded.updated_at
        WHERE subscription.provider='stripe' AND subscription.user_id=excluded.user_id`,
          )
          .bind(
            sub.id,
            lock.userId,
            customer,
            sub.status,
            item?.price.id ?? '',
            item?.current_period_end ?? 0,
            sub.cancel_at_period_end ? 1 : 0,
            crypto.randomUUID(),
            Date.now(),
            lock.userId,
            lock.id,
            Date.now(),
          ),
      )
    }
    for (const session of checkoutSnapshots.values())
      writes.push(
        db
          .prepare(`UPDATE checkout SET status=? WHERE id=? AND user_id=? AND ${guarded}`)
          .bind(session.status, session.id, lock.userId, lock.userId, lock.id, Date.now()),
      )
    if (writes.length) {
      const results = await db.batch(writes)
      if (results.some((result) => !result.meta.changes)) return status('unknown')
    }
    return activeSubscription
      ? status('subscription', openCheckout)
      : unpaidInvoice
        ? status('invoice', openCheckout)
        : openCheckout
          ? status('checkout', true)
          : status('ready')
  } catch {
    return status('unknown')
  }
}

export async function reviewBilling(
  lock: BillingLock,
  closeCheckouts = false,
): Promise<BillingDeletionStatus> {
  const stripe = await reviewStripeBilling(lock, closeCheckouts)
  const { reviewCreemBilling } = await import('./creem.server')
  const creem = await reviewCreemBilling(lock)
  const order: BillingDeletionStatus['state'][] = [
    'unknown',
    'subscription',
    'invoice',
    'checkout',
    'ready',
    'none',
  ]
  const state = order.find((state) => stripe.state === state || creem.state === state) ?? 'unknown'
  return { state, canCloseCheckouts: stripe.canCloseCheckouts }
}
