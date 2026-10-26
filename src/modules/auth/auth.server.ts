import { authLog } from './logging.server'
import { features } from '@/config/features'
import { database } from '@/server/database.server'
import { accountEnabled, assertAccountEnabled } from '@/modules/admin/access.server'
import { APIError } from 'better-auth/api'
import { betterAuth } from 'better-auth/minimal'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { drizzle } from 'drizzle-orm/d1'
import { env, waitUntil } from 'cloudflare:workers'
import { googleAuthStatus } from './config.server'
import { site } from '@/config/site'
import * as schema from '@/db/schema'
import { sendAuthMail } from '@/modules/mail/mail.server'
import { HttpError, isLocalRequest } from '@/server/http.server'
import { assertVerificationOwner, bindVerificationLink } from './verification.server'

export function createAuth(request: Request, requestId = crypto.randomUUID()) {
  if (!features.auth) throw new HttpError(404, '接口不存在')
  if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32)
    throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters')
  return betterAuth({
    appName: site.name,
    logger: { level: 'info', log: (level, message) => authLog(level, message, requestId) },
    // APIErrors keep their SDK status/headers; unknown errors reach our sanitized HTTP boundary.
    // Returning void from the SDK error hook would let Better Call log the raw database error.
    onAPIError: { throw: true },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.APP_ORIGIN,
    trustedOrigins: [env.APP_ORIGIN],
    // Browser-facing account management uses white-listed metadata and session IDs, never tokens.
    disabledPaths: [
      '/list-sessions',
      '/revoke-session',
      '/revoke-sessions',
      '/revoke-other-sessions',
      '/change-password',
      '/set-password',
      '/verify-password',
      '/delete-user',
      '/delete-user/callback',
    ],
    socialProviders: googleAuthStatus().ready
      ? { google: { clientId: env.GOOGLE_CLIENT_ID!, clientSecret: env.GOOGLE_CLIENT_SECRET! } }
      : {},
    database: drizzleAdapter(drizzle(database(), { schema }), {
      provider: 'sqlite',
      schema,
      transaction: false,
    }),
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            if (!(await accountEnabled(session.userId)))
              throw new APIError('FORBIDDEN', {
                code: 'ACCOUNT_DISABLED',
                message: 'Account unavailable',
              })
          },
        },
      },
    },
    emailAndPassword: {
      enabled: features.emailPassword,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        if (await accountEnabled(user.id)) await sendAuthMail(request, user.email, 'reset', url)
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: false,
      sendVerificationEmail: async ({ user, url, token }) => {
        if (!(await accountEnabled(user.id))) return
        await sendAuthMail(
          request,
          user.email,
          'verify',
          await bindVerificationLink(url, token, user.id, env.BETTER_AUTH_SECRET),
        )
      },
      beforeEmailVerification: async (user, verificationRequest) => {
        await assertVerificationOwner(
          verificationRequest ?? request,
          user.id,
          env.BETTER_AUTH_SECRET,
        )
      },
    },
    session: { expiresIn: 604_800, updateAge: 86_400, cookieCache: { enabled: false } },
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 60,
      customRules: {
        '/sign-in/email': { window: 60, max: 10 },
        '/send-verification-email': { window: 60, max: 5 },
      },
    },
    advanced: {
      // Keep the same origin boundary in SDK tests and deployed requests.
      disableOriginCheck: false,
      backgroundTasks: isLocalRequest(request) ? undefined : { handler: waitUntil },
      useSecureCookies: !isLocalRequest(request),
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
    },
  })
}
export async function requireUser(request: Request) {
  const session = await createAuth(request).api.getSession({ headers: request.headers })
  if (!session?.user.emailVerified) throw new HttpError(401, '请先登录并验证邮箱')
  await assertAccountEnabled(session.user.id)
  return session.user
}
export async function isAdmin(userId: string) {
  return !!(await database()
    .prepare(
      'SELECT roles.user_id FROM admin_user roles JOIN user u ON u.id=roles.user_id LEFT JOIN account_access a ON a.user_id=u.id WHERE roles.user_id=? AND u.email_verified=1 AND a.disabled_at IS NULL',
    )
    .bind(userId)
    .first())
}
