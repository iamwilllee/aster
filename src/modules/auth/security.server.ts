import { assertAccountEnabled } from '@/modules/admin/access.server'
import { z } from 'zod'
import { features } from '@/config/features'
import { database } from '@/server/database.server'
import { body, HttpError, json } from '@/server/http.server'
import { allowPasswordChange, allowPrivateMutation } from '@/server/rate-limit.server'
import { createAuth } from './auth.server'
import { sessionDevice, type AccountSecurity } from './security'

const passwordInput = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(12).max(128),
  })
  .strict()

async function credentialPassword(userId: string) {
  if (!features.emailPassword) return false
  return !!(await database()
    .prepare(
      "SELECT id FROM account WHERE user_id = ? AND provider_id = 'credential' AND password IS NOT NULL AND length(password) > 0 LIMIT 1",
    )
    .bind(userId)
    .first())
}

export async function accountSecurity(request: Request): Promise<Response> {
  if (!features.auth) throw new HttpError(404, 'error_api_missing')
  const auth = createAuth(request)
  const viewer = await auth.api.getSession({
    headers: request.headers,
    query: { disableCookieCache: true },
  })
  if (!viewer?.user.emailVerified) throw new HttpError(401, 'error_unauthorized')
  await assertAccountEnabled(viewer.user.id)
  const userId = viewer.user.id
  const currentId = viewer.session.id
  const now = Date.now()
  const path = new URL(request.url).pathname
  if (path === '/api/account/security' && request.method === 'GET') {
    const [rows, canChangePassword] = await Promise.all([
      database()
        .prepare(
          'SELECT id, user_agent, created_at, updated_at, expires_at FROM session WHERE user_id = ? AND expires_at > ? ORDER BY (id = ?) DESC, updated_at DESC, id DESC LIMIT 51',
        )
        .bind(userId, now, currentId)
        .all<{
          id: string
          user_agent: string | null
          created_at: number
          updated_at: number
          expires_at: number
        }>(),
      credentialPassword(userId),
    ])
    const result: AccountSecurity = {
      canChangePassword,
      sessions: rows.results.slice(0, 50).map((row) => ({
        id: row.id,
        current: row.id === currentId,
        ...sessionDevice(row.user_agent),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        expiresAt: row.expires_at,
      })),
      hasMore: rows.results.length > 50,
    }
    return json(result)
  }
  if (!(await allowPrivateMutation(userId))) throw new HttpError(429, 'error_throttled')
  if (path === '/api/account/password' && request.method === 'POST') {
    if (!(await credentialPassword(userId))) throw new HttpError(404, 'account_no_password_error')
    const input = await body(request, passwordInput)
    if (input.currentPassword === input.newPassword)
      throw new HttpError(400, 'account_different_password_error')
    if (!(await allowPasswordChange(userId))) throw new HttpError(429, 'error_throttled')
    const changed = await auth.api.changePassword({
      headers: request.headers,
      body: { ...input, revokeOtherSessions: true },
      asResponse: true,
    })
    if (!changed.ok) {
      const payload: unknown = await changed.json()
      if (
        typeof payload === 'object' &&
        payload !== null &&
        'code' in payload &&
        payload.code === 'INVALID_PASSWORD'
      )
        throw new HttpError(400, 'account_current_password_error')
      if (changed.status === 401) throw new HttpError(401, 'error_unauthorized')
      throw new HttpError(503, 'account_password_failed_error')
    }
    // Better Auth rotates the current session when revoking others. Discard its token/user JSON.
    const response = json({ ok: true })
    for (const cookie of changed.headers.getSetCookie())
      response.headers.append('Set-Cookie', cookie)
    await changed.body?.cancel()
    return response
  }
  if (path === '/api/account/sessions/revoke-others' && request.method === 'POST') {
    await database()
      .prepare(
        'DELETE FROM session WHERE user_id = ? AND id <> ? AND EXISTS (SELECT 1 FROM session AS active WHERE active.id = ? AND active.user_id = ? AND active.expires_at > ?)',
      )
      .bind(userId, currentId, currentId, userId, now)
      .run()
    return json({ ok: true })
  }
  const match = /^\/api\/account\/sessions\/([a-zA-Z0-9_-]{1,128})$/.exec(path)
  if (match && request.method === 'DELETE') {
    if (match[1] === currentId) throw new HttpError(409, 'account_current_session_error')
    const deleted = await database()
      .prepare(
        'DELETE FROM session WHERE id = ? AND user_id = ? AND EXISTS (SELECT 1 FROM session AS active WHERE active.id = ? AND active.user_id = ? AND active.expires_at > ?)',
      )
      .bind(match[1], userId, currentId, userId, now)
      .run()
    if (!deleted.meta.changes) throw new HttpError(404, 'account_missing_session_error')
    return json({ ok: true })
  }
  throw new HttpError(404, 'error_api_missing')
}
