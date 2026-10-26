type AuthLogLevel = 'debug' | 'info' | 'warn' | 'error'
// Preserve severity and useful categories without retaining SDK/adapter strings or query arguments.
export function authLog(level: AuthLogLevel, message: string, requestId: string) {
  const category = /query|database|adapter|sql/i.test(message)
    ? 'storage'
    : /session/i.test(message)
      ? 'session'
      : /password|credential|sign.?in/i.test(message)
        ? 'credentials'
        : /mail|email/i.test(message)
          ? 'mail'
          : 'runtime'
  const entry = JSON.stringify({ event: 'auth_sdk', severity: level, category, requestId })
  if (level === 'error') console.error(entry)
  else if (level === 'warn') console.warn(entry)
  else if (level === 'debug') console.debug(entry)
  else console.info(entry)
}
