import {
  assertAccountEnabled,
  assertAdministratorDeletion,
  activeAdminCountSQL,
  lastAdministrator,
} from '@/modules/admin/access.server'
import { cleanAccountFiles } from '@/modules/files/files.server'
import { z } from 'zod'
import { features } from '@/config/features'
import { database } from '@/server/database.server'
import { body, HttpError, json } from '@/server/http.server'
import { allowAccountAction, allowPrivateMutation } from '@/server/rate-limit.server'
import { createAuth } from './auth.server'
import type { AccountLifecycle } from './lifecycle'
import {
  acquireBillingLock,
  releaseBillingLock,
  reviewBilling,
} from '@/modules/billing/deletion.server'

const freshWindow = 5 * 60_000
const deletionInput = z
  .object({
    confirmation: z.literal('DELETE'),
    currentPassword: z.string().min(1).max(128).optional(),
    retainSiteContent: z.boolean().optional(),
  })
  .strict()

export async function accountLifecycle(request: Request): Promise<Response> {
  if (!features.auth) throw new HttpError(404, '接口不存在')
  const auth = createAuth(request)
  const viewer = await auth.api.getSession({
    headers: request.headers,
    query: { disableCookieCache: true },
  })
  if (!viewer?.user.emailVerified) throw new HttpError(401, '请先登录并验证邮箱')
  const db = database()
  await assertAccountEnabled(viewer.user.id)
  const userId = viewer.user.id
  const currentId = viewer.session.id
  const path = new URL(request.url).pathname
  const active = await db
    .prepare('SELECT created_at FROM session WHERE id = ? AND user_id = ? AND expires_at > ?')
    .bind(currentId, userId, Date.now())
    .first<{ created_at: number }>()
  if (!active) throw new HttpError(401, '请先登录并验证邮箱')
  const credentials = await db
    .prepare('SELECT id, provider_id, password FROM account WHERE user_id = ?')
    .bind(userId)
    .all<{ id: string; provider_id: string; password: string | null }>()
  const credential = features.emailPassword
    ? credentials.results.find((row) => row.provider_id === 'credential' && !!row.password)
    : undefined
  const mode: AccountLifecycle['verification'] = credential
    ? 'password'
    : features.google && credentials.results.some((row) => row.provider_id === 'google')
      ? 'recent-login'
      : 'unavailable'
  const recent = active.created_at <= Date.now() && active.created_at > Date.now() - freshWindow
  const siteContributions = async () =>
    Number(
      (
        await db
          .prepare(
            'SELECT (SELECT COUNT(*) FROM content_entry WHERE created_by=? OR updated_by=?) + (SELECT COUNT(*) FROM content_asset WHERE uploaded_by=?) AS total',
          )
          .bind(userId, userId, userId)
          .first<{ total: number }>()
      )?.total ?? 0,
    )
  const billingBlocked = async () =>
    !!(await db
      .prepare(
        'SELECT 1 AS found FROM subscription WHERE user_id = ? UNION ALL SELECT 1 FROM checkout WHERE user_id = ? LIMIT 1',
      )
      .bind(userId, userId)
      .first())
  if (path === '/api/account/lifecycle' && request.method === 'GET') {
    const history = await billingBlocked()
    return json({
      lastAdministrator: await lastAdministrator(userId),
      siteContributions: await siteContributions(),
      verification: mode,
      recentLogin: recent,
      billingBlocked: history,
      billing: { state: history ? 'unchecked' : 'none', canCloseCheckouts: false },
    } satisfies AccountLifecycle)
  }
  if (request.method !== 'POST') throw new HttpError(404, '接口不存在')
  if (!(await allowPrivateMutation(userId))) throw new HttpError(429, '请求过于频繁，请稍后重试')
  if (path === '/api/account/billing-review' || path === '/api/account/close-checkouts') {
    const closing = path.endsWith('/close-checkouts')
    if (closing) await body(request, z.object({ confirmation: z.literal('CLOSE') }).strict())
    if (!(await allowAccountAction(userId, closing ? 'close-checkouts' : 'billing-review')))
      throw new HttpError(429, '请求过于频繁，请稍后重试')
    const lock = await acquireBillingLock(userId)
    try {
      return json(await reviewBilling(lock, closing))
    } finally {
      await releaseBillingLock(lock)
    }
  }
  if (path === '/api/account/export') {
    if (!(await allowAccountAction(userId, 'export')))
      throw new HttpError(429, '请求过于频繁，请稍后重试')
    // A single batch gives a consistent owner-scoped snapshot. Never SELECT * from auth/billing tables.
    const snapshot = await db.batch([
      db
        .prepare(
          `SELECT name, email, image, created_at AS createdAt FROM user WHERE id = ?
        AND EXISTS (SELECT 1 FROM session WHERE id = ? AND user_id = ? AND expires_at > ?)`,
        )
        .bind(userId, currentId, userId, Date.now()),
      db
        .prepare(
          'SELECT id, name, description, status, cover_asset_id AS coverAssetId, created_at AS createdAt, updated_at AS updatedAt FROM project WHERE user_id = ? ORDER BY created_at, id LIMIT 1001',
        )
        .bind(userId),
      db
        .prepare(
          'SELECT provider, status, current_period_end AS currentPeriodEnd, cancel_at_period_end AS cancelAtPeriodEnd FROM subscription WHERE user_id = ? ORDER BY id LIMIT 1001',
        )
        .bind(userId),
      db
        .prepare(
          'SELECT provider, status, created_at AS createdAt FROM checkout WHERE user_id = ? ORDER BY created_at, id LIMIT 1001',
        )
        .bind(userId),
      db
        .prepare(
          'SELECT id,name,content_type AS type,size,state,created_at AS createdAt FROM file_asset WHERE user_id=? ORDER BY created_at,id LIMIT 1001',
        )
        .bind(userId),
    ])
    const profile = snapshot[0]!.results[0]
    if (!profile) throw new HttpError(401, '请先登录并验证邮箱')
    if (snapshot.slice(1).some((part) => part.results.length > 1000))
      throw new HttpError(413, '数据量超过即时导出上限，请联系站点支持。')
    const result = {
      version: 1,
      exportedAt: new Date().toISOString(),
      profile,
      projects: snapshot[1]!.results,
      billing: { subscriptions: snapshot[2]!.results, checkouts: snapshot[3]!.results },
      files: snapshot[4]!.results,
      siteData: { ownership: 'site', included: false, retainedAfterDeletion: true },
      auditData: { retained: true, identityReferencesRemovedOnDeletion: true },
    }
    const output = JSON.stringify(result)
    if (new TextEncoder().encode(output).byteLength > 2_000_000)
      throw new HttpError(413, '数据量超过即时导出上限，请联系站点支持。')
    return new Response(output, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': 'attachment; filename="account-data.json"',
      },
    })
  }
  if (path !== '/api/account/delete') throw new HttpError(404, '接口不存在')
  const input = await body(request, deletionInput)
  if (!(await allowAccountAction(userId, 'delete')))
    throw new HttpError(429, '请求过于频繁，请稍后重试')
  if (mode === 'unavailable') throw new HttpError(409, '无法验证当前登录方式，请联系站点支持。')
  if (credential) {
    if (!input.currentPassword) throw new HttpError(400, '请输入当前密码以确认注销。')
    const verified = await auth.api.verifyPassword({
      headers: request.headers,
      body: { password: input.currentPassword },
      asResponse: true,
    })
    await verified.body?.cancel()
    if (!verified.ok) {
      if (verified.status === 400) throw new HttpError(400, '当前密码不正确。')
      throw new HttpError(401, '请重新登录后确认注销。')
    }
  } else if (!recent || input.currentPassword)
    throw new HttpError(401, '请重新登录后在五分钟内确认注销。')
  const lock = await acquireBillingLock(userId)
  let committed = false
  try {
    if ((await siteContributions()) > 0 && input.retainSiteContent !== true)
      throw new HttpError(409, '注销前请确认共享网站内容与素材的保留规则。')
    const billing = await reviewBilling(lock)
    if (!['ready', 'none'].includes(billing.state))
      throw new HttpError(409, '支付状态尚不满足注销条件，请先核对账务。')
    await assertAdministratorDeletion(userId)
    await cleanAccountFiles(lock)
    const now = Date.now()
    // Recheck identity, credential revision and billing in the write itself, not only in a preflight.
    const claimGuard = `id = ? AND email_verified=1 AND EXISTS (SELECT 1 FROM billing_account_state WHERE user_id=? AND lock_id=? AND lock_until>? AND lock_until > unixepoch('subsec')*1000 AND closed_at IS NULL)
    AND EXISTS (SELECT 1 FROM session WHERE id = ? AND user_id = ? AND expires_at > unixepoch('subsec')*1000 AND expires_at > ? ${credential ? '' : "AND created_at > ? AND created_at <= ? AND created_at > unixepoch('subsec')*1000-300000"})
    AND (NOT EXISTS(SELECT 1 FROM admin_user WHERE user_id=user.id) OR ${activeAdminCountSQL}>1)
    AND NOT EXISTS (SELECT 1 FROM account_access WHERE user_id=user.id AND disabled_at IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM file_asset WHERE user_id=?)
    ${credential ? 'AND EXISTS (SELECT 1 FROM account WHERE id = ? AND user_id = ? AND password = ?)' : "AND EXISTS (SELECT 1 FROM account WHERE user_id = ? AND provider_id = 'google')"}`
    const claimValues = [
      userId,
      userId,
      lock.id,
      now,
      currentId,
      userId,
      now,
      ...(!credential ? [now - freshWindow, now] : []),
      userId,
      ...(credential ? [credential.id, userId, credential.password!] : [userId]),
    ]
    // Seal authorization inside the transaction before archiving. After sealing, the lease cannot expire mid-batch.
    const guard =
      'id=? AND EXISTS (SELECT 1 FROM billing_account_state WHERE user_id=? AND lock_id=? AND closed_at=?)'
    const values = [userId, userId, lock.id, now]
    const results = await db.batch([
      db
        .prepare(
          `UPDATE billing_account_state SET closed_at=? WHERE user_id=? AND lock_id=? AND EXISTS (SELECT 1 FROM user WHERE ${claimGuard})`,
        )
        .bind(now, userId, lock.id, ...claimValues),
      db
        .prepare(
          `INSERT INTO billing_subscription_archive (id,provider,owner_ref,customer_id,status,price_id,current_period_end,cancel_at_period_end,revision,sync_id,updated_at,archived_at)
      SELECT id,provider,user_id,customer_id,status,price_id,current_period_end,cancel_at_period_end,revision,sync_id,updated_at,? FROM subscription WHERE user_id=? AND EXISTS (SELECT 1 FROM user WHERE ${guard})`,
        )
        .bind(now, userId, ...values),
      db
        .prepare(
          `INSERT INTO billing_checkout_archive (id,provider,owner_ref,status,created_at,archived_at)
      SELECT id,provider,user_id,status,created_at,? FROM checkout WHERE user_id=? AND EXISTS (SELECT 1 FROM user WHERE ${guard})`,
        )
        .bind(now, userId, ...values),
      // Reset tokens carry the exact user ID. Other verification formats are not guessed or globally removed.
      db
        .prepare(
          `DELETE FROM verification WHERE value = ? AND identifier LIKE 'reset-password:%' AND EXISTS (SELECT 1 FROM user WHERE ${guard})`,
        )
        .bind(userId, ...values),
      db
        .prepare(`DELETE FROM dev_mail WHERE recipient = (SELECT email FROM user WHERE ${guard})`)
        .bind(...values),
      // Existing FK cascades remove credentials, all sessions, owned projects and admin membership atomically.
      db.prepare(`DELETE FROM user WHERE ${guard}`).bind(...values),
      db
        .prepare(
          'UPDATE billing_account_state SET closed_at=?,lock_id=NULL,lock_until=0 WHERE user_id=? AND lock_id=? AND NOT EXISTS (SELECT 1 FROM user WHERE id=?)',
        )
        .bind(now, userId, lock.id, userId),
    ])
    if (!results[5]?.meta.changes) {
      throw new HttpError(401, '请重新登录后确认注销。')
    }
    committed = true
    // The row and all sessions are already gone. Sign-out only clears the browser's matching auth cookies.
    const response = json({ ok: true })
    try {
      const signedOut = await auth.api.signOut({ headers: request.headers, asResponse: true })
      for (const cookie of signedOut.headers.getSetCookie())
        response.headers.append('Set-Cookie', cookie)
      await signedOut.body?.cancel()
    } catch {
      // Do not report an already committed deletion as a failure. Remaining cookies cannot authenticate.
      console.warn(JSON.stringify({ event: 'account_cookie_clear_failed' }))
    }
    return response
  } finally {
    if (!committed) await releaseBillingLock(lock)
  }
}
