import { env } from 'cloudflare:workers'
import { z } from 'zod'
import { isMessageKey, localizedError, translate, type Locale, type MessageKey } from '@/i18n/core'

type ErrorParams = Record<string, string | number>

/**
 * An error with an HTTP status and a message safe to show the user.
 *
 * Pass a message key from src/i18n: `new HttpError(409, 'error_project_limit', { count: 3 })`.
 * The key is the stable identifier: the response is translated from it, and renaming or
 * rewording a message cannot silently break the translation. `message` carries the Chinese
 * text for logs and tests. A plain string is accepted only for text from outside (a library
 * message); tests/unit/error-messages.test.ts rejects literals that are not keys.
 */
export class HttpError extends Error {
  readonly code?: MessageKey
  readonly params?: ErrorParams
  constructor(
    readonly status: number,
    keyOrMessage: MessageKey | (string & {}),
    params?: ErrorParams,
  ) {
    const known = isMessageKey(keyOrMessage)
    super(known ? translate('zh', keyOrMessage, params) : keyOrMessage)
    if (known) {
      this.code = keyOrMessage
      this.params = params
    }
  }
}

/** The text of an HttpError in the request's language. */
export function publicErrorMessage(error: HttpError, locale: Locale) {
  return error.code
    ? translate(locale, error.code, error.params)
    : localizedError(error.message, locale)
}
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  })
}
export function assertOrigin(request: Request) {
  if (request.headers.get('origin') !== new URL(env.APP_ORIGIN).origin) {
    throw new HttpError(403, 'error_origin')
  }
}
export function isLocalRequest(request: Request) {
  const url = new URL(request.url)
  const origin = new URL(env.APP_ORIGIN)
  return (
    env.ENVIRONMENT === 'local' &&
    ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) &&
    url.origin === origin.origin
  )
}
export async function boundedBytes(request: Request, maxBytes: number) {
  const reader = request.body?.getReader()
  if (!reader) return new Uint8Array()
  let size = 0
  const chunks: Uint8Array[] = []
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxBytes) {
        await reader.cancel()
        throw new HttpError(413, 'error_large_body')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}
export async function boundedText(request: Request, maxBytes = 16_384) {
  return new TextDecoder().decode(await boundedBytes(request, maxBytes))
}
// Consume the incoming stream before any early response, including origin/auth errors.
// Rebuild from exact bytes so downstream parsers and signed webhooks see the same body.
export async function bufferRequestBody(request: Request, maxBytes = 16_384) {
  if (!request.body) return request
  return new Request(request, { body: await boundedBytes(request, maxBytes) })
}
export async function body<T extends z.ZodType>(
  request: Request,
  schema: T,
  maxBytes = 16_384,
): Promise<z.infer<T>> {
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new HttpError(415, 'error_json_required')
  let value: unknown
  try {
    value = JSON.parse(await boundedText(request, maxBytes))
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw new HttpError(400, 'error_json_invalid')
  }
  const result = schema.safeParse(value)
  if (!result.success) {
    // Schemas carry message keys. Anything else (a library default) must not reach the user.
    const issue = result.error.issues[0]?.message
    const key = issue && isMessageKey(issue) ? issue : 'error_parameters'
    throw new HttpError(400, key)
  }
  return result.data
}
