import { env } from 'cloudflare:workers'
import { z } from 'zod'

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  })
}
export function assertOrigin(request: Request) {
  if (request.headers.get('origin') !== new URL(env.APP_ORIGIN).origin) {
    throw new HttpError(403, '请求来源不受信任')
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
        throw new HttpError(413, '请求内容过大')
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
    throw new HttpError(415, '请使用 JSON 请求')
  let value: unknown
  try {
    value = JSON.parse(await boundedText(request, maxBytes))
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw new HttpError(400, 'JSON 格式不正确')
  }
  const result = schema.safeParse(value)
  if (!result.success) throw new HttpError(400, result.error.issues[0]?.message ?? '参数不正确')
  return result.data
}
