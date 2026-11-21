import { z } from 'zod'
import { logFailure } from '@/server/observability'

export type MailProvider = 'brevo' | 'resend'

export function mailSender(value: unknown) {
  if (typeof value !== 'string' || /[\r\n]/.test(value)) return null
  const match = value.trim().match(/^(?:([^<>]+?)\s*<([^<>]+)>|([^<>]+))$/)
  const email = (match?.[2] ?? match?.[3] ?? '').trim()
  if (
    !z.email().safeParse(email).success ||
    /@(.*\.)?example\.(?:invalid|com|test)$|\.invalid$/i.test(email)
  )
    return null
  const name = match?.[1]?.trim()
  return { email, ...(name ? { name } : {}) }
}

// One explicitly selected provider per request. Never retry or fail over automatically:
// a timeout can happen after a provider accepted the email.
export async function sendProviderMail(
  provider: MailProvider,
  key: string,
  message: { from: string; to: string; subject: string; text: string; html: string },
) {
  const sender = mailSender(message.from)
  if (!sender || !key.trim()) throw new Error('Transactional email is not configured')
  // How it failed, never why in words: error bodies can hold the recipient, a link or a credential.
  let outcome = 'request_failed'
  try {
    const brevo = provider === 'brevo'
    const response = await fetch(
      brevo ? 'https://api.brevo.com/v3/smtp/email' : 'https://api.resend.com/emails',
      {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
        headers: {
          'Content-Type': 'application/json',
          ...(brevo ? { 'api-key': key.trim() } : { Authorization: `Bearer ${key.trim()}` }),
        },
        body: JSON.stringify(
          brevo
            ? {
                sender,
                to: [{ email: message.to }],
                subject: message.subject,
                textContent: message.text,
                htmlContent: message.html,
              }
            : { ...message, to: [message.to] },
        ),
      },
    )
    // Neither error bodies nor message IDs are needed here. They can contain
    // recipient addresses, credentials or links; discard without buffering/logging.
    await response.body?.cancel()
    if (response.status !== (brevo ? 201 : 200)) {
      outcome = `http_${response.status}`
      throw new Error('not accepted')
    }
  } catch (error) {
    logFailure('mail_not_accepted', error, { provider, outcome })
    throw new Error('Transactional email provider did not confirm acceptance')
  }
}
