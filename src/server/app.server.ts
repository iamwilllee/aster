import { features } from '@/config/features'
import { database } from '@/server/database.server'
import { googleAuthStatus } from '@/modules/auth/config.server'
import { env } from 'cloudflare:workers'
import { requireUser, isAdmin } from '@/modules/auth/auth.server'
import { getBilling } from '@/modules/billing/billing.server'
import { isLocalRequest } from './http.server'
import { isMailConfigured } from '@/modules/mail/mail.server'

export async function workspace(request: Request) {
  const user = await requireUser(request)
  const [admin, billing, count] = await Promise.all([
    isAdmin(user.id),
    getBilling(user.id),
    features.projects
      ? database()
          .prepare('SELECT COUNT(*) AS count FROM project WHERE user_id = ?')
          .bind(user.id)
          .first<{ count: number }>()
      : Promise.resolve(null),
  ])
  return {
    user: { id: user.id, name: user.name, email: user.email, image: user.image ?? null },
    admin,
    billing,
    projectCount: count?.count ?? 0,
    local: isLocalRequest(request),
    mailMode: env.MAIL_MODE,
    mailReady: isMailConfigured(request),
    google: googleAuthStatus(),
  }
}
