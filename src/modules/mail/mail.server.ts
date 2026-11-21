import { features } from '@/config/features'
import { database } from '@/server/database.server'
import { env } from 'cloudflare:workers'
import { authMail, type AuthMailKind } from './template'
import { requestLocale } from '@/i18n/core'
import { isLocalRequest } from '@/server/http.server'
import { logFailure } from '@/server/observability'
import { mailSender, sendProviderMail } from './providers.server'

function emailBinding(): SendEmail | undefined {
  const value: unknown = Reflect.get(env, 'EMAIL')
  if (!value || typeof value !== 'object' || !('send' in value) || typeof value.send !== 'function')
    return undefined
  return value as SendEmail
}

export function isMailConfigured(request: Request) {
  return (
    features.mail &&
    ((features.database && env.MAIL_MODE === 'local' && isLocalRequest(request)) ||
      (!!mailSender(env.MAIL_FROM) &&
        ((env.MAIL_MODE === 'cloudflare' && !!emailBinding()) ||
          (env.MAIL_MODE === 'brevo' && !!env.BREVO_API_KEY?.trim()) ||
          (env.MAIL_MODE === 'resend' && !!env.RESEND_API_KEY?.trim()))))
  )
}

export async function sendAuthMail(
  request: Request,
  recipient: string,
  kind: AuthMailKind,
  url: string,
) {
  const { subject, text, html } = authMail(kind, url, requestLocale(request))
  if (new URL(url).origin !== new URL(env.APP_ORIGIN).origin)
    throw new Error('Mail link origin mismatch')
  if (!isMailConfigured(request)) throw new Error('Transactional email is not configured')
  if (env.MAIL_MODE === 'local' && isLocalRequest(request)) {
    await database()
      .prepare(
        'INSERT INTO dev_mail (id, recipient, subject, url, created_at) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(crypto.randomUUID(), recipient, subject, url, Date.now())
      .run()
    // Local-only tokens expire with their auth record; keep the test inbox short-lived too.
    await database()
      .prepare('DELETE FROM dev_mail WHERE created_at < ?')
      .bind(Date.now() - 86_400_000)
      .run()
    return
  }
  if (env.MAIL_MODE === 'cloudflare') {
    const email = emailBinding()
    if (!email) throw new Error('Cloudflare email binding is not configured')
    const from = env.MAIL_FROM
    const message = {
      to: recipient,
      from,
      subject,
      text,
      html,
    }
    try {
      await email.send(message)
    } catch (error) {
      // The class of failure only: its message can hold the recipient or a link.
      logFailure('mail_not_accepted', error, { provider: 'cloudflare' })
      throw new Error('Transactional email provider did not confirm acceptance')
    }
    return
  }
  if (env.MAIL_MODE === 'brevo' || env.MAIL_MODE === 'resend') {
    await sendProviderMail(
      env.MAIL_MODE,
      (env.MAIL_MODE === 'brevo' ? env.BREVO_API_KEY : env.RESEND_API_KEY)!,
      { to: recipient, from: env.MAIL_FROM, subject, text, html },
    )
    return
  }
  throw new Error('Transactional email is not configured')
}
