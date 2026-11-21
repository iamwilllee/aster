// Request ids and structured failure logs. No Worker imports, so it is unit-tested directly.
//
// Logs carry categories and identifiers, never messages. A library error message can contain
// an address, a link, a credential or a query argument, so only the error's class name, our
// own message key and numbers are written (the same rule as the auth SDK log).

type Fields = Record<string, string | number | boolean | undefined>

const ids = new WeakMap<Request, string>()

/**
 * One id per request: Cloudflare's cf-ray when present (it ties our log line to the edge log),
 * otherwise a random UUID. The header is only used when it has a safe shape, so a forged
 * value cannot inject text into the log.
 */
export function getRequestId(request: Request): string {
  let id = ids.get(request)
  if (!id) {
    const ray = request.headers.get('cf-ray')
    id = ray && /^[A-Za-z0-9-]{8,40}$/.test(ray) ? ray : crypto.randomUUID()
    ids.set(request, id)
  }
  return id
}

export function logEvent(level: 'info' | 'warn' | 'error', event: string, fields: Fields = {}) {
  const entry = JSON.stringify({ event, severity: level, ...fields })
  if (level === 'error') console.error(entry)
  else if (level === 'warn') console.warn(entry)
  else console.info(entry)
}

/** Log that an operation failed, with the failure's class and our own code, never its text. */
export function logFailure(event: string, error: unknown, fields: Fields = {}) {
  const code = error instanceof Error && 'code' in error ? error.code : undefined
  logEvent('error', event, {
    ...fields,
    errorName: error instanceof Error ? error.name : typeof error,
    ...(typeof code === 'string' && /^[a-z][a-z0-9_]{2,59}$/.test(code) ? { code } : {}),
  })
}
