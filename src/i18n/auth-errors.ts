import { translate, type Locale, type MessageKey } from './core'
export function authError(code: string, locale: Locale) {
  let key: MessageKey = 'auth_generic_error'
  if (code === 'ACCOUNT_DISABLED') key = 'admin_account_disabled'
  else if (code.includes('EMAIL_NOT_VERIFIED')) key = 'verify_your_email_before_signing_in'
  else if (code.includes('INVALID_EMAIL_OR_PASSWORD')) key = 'invalid_email_or_password'
  else if (code.includes('USER_ALREADY_EXISTS')) key = 'this_email_is_already_registered'
  else if (code.includes('RATE') || code === 'RESEND_COOLDOWN' || code.includes('TOO_MANY'))
    key = 'auth_rate_limit'
  else if (code.includes('TOKEN') || code.includes('PASSWORD')) key = 'auth_password_invalid'
  return translate(locale, key)
}
