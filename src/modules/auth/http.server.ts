import { features } from '@/config/features'
import { z } from 'zod'
import { isMailConfigured } from '@/modules/mail/mail.server'
import { createAuth } from './auth.server'
import { reserveVerificationResend } from './resend.server'
import { authError } from '@/i18n/auth-errors'
import { requestLocale, translate } from '@/i18n/core'
import {
  boundedText,
  HttpError,
  json,
  assertOrigin,
  publicErrorMessage,
} from '@/server/http.server'
import { getRequestId } from '@/server/observability'
import { authLog } from './logging.server'

export async function handleAuthRequest(request: Request) {
  const requestId = getRequestId(request)
  let release: (() => Promise<void>) | null = null
  async function releaseReservation() {
    const reserved = release
    release = null
    if (!reserved) return
    try {
      await reserved()
    } catch (error) {
      authLog('error', error instanceof Error ? error.message : 'auth cleanup', requestId)
    }
  }
  try {
    if (request.method === 'POST') {
      const text = await boundedText(request)
      request = new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body: text,
      })
      const path = new URL(request.url).pathname
      if (
        !features.auth ||
        (!features.emailPassword &&
          /\/(?:sign-up\/email|sign-in\/email|send-verification-email|verify-email|request-password-reset|reset-password)$/.test(
            path,
          ))
      )
        throw new HttpError(404, 'error_api_missing')
      if (
        [
          '/api/auth/sign-up/email',
          '/api/auth/send-verification-email',
          '/api/auth/request-password-reset',
        ].includes(path) &&
        !isMailConfigured(request)
      )
        throw new HttpError(503, 'mail_disabled')
      if (path === '/api/auth/send-verification-email') {
        assertOrigin(request)
        let input: unknown
        try {
          input = JSON.parse(text)
        } catch {
          throw new HttpError(400, 'error_json_invalid')
        }
        const parsed = z.object({ email: z.email().max(254) }).safeParse(input)
        if (!parsed.success) throw new HttpError(400, 'error_parameters')
        release = await reserveVerificationResend(parsed.data.email)
        if (!release) {
          const response = json(
            {
              message: translate(requestLocale(request), 'auth_rate_limit'),
              code: 'RESEND_COOLDOWN',
            },
            429,
          )
          response.headers.set('Retry-After', '60')
          return response
        }
      }
    }
    const path = new URL(request.url).pathname
    if (
      !features.auth ||
      (!features.emailPassword &&
        /\/(?:sign-up\/email|sign-in\/email|send-verification-email|verify-email|request-password-reset|reset-password)$/.test(
          path,
        ))
    )
      throw new HttpError(404, 'error_api_missing')
    const response = await createAuth(request, requestId).handler(request)
    if (response.status >= 500) authLog('error', 'auth runtime', requestId)
    if (!response.ok) await releaseReservation()
    // OAuth/email redirects can have immutable headers. Copy them instead of mutating.
    const headers = new Headers(response.headers)
    headers.set('Cache-Control', 'no-store')
    if (
      response.status >= 400 &&
      response.headers.get('content-type')?.includes('application/json')
    ) {
      const payload: unknown = await response.clone().json()
      if (
        typeof payload === 'object' &&
        payload !== null &&
        'code' in payload &&
        typeof payload.code === 'string'
      ) {
        headers.delete('content-length')
        return Response.json(
          { ...payload, message: authError(payload.code, requestLocale(request)) },
          { status: response.status, headers },
        )
      }
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  } catch (error) {
    if (!(error instanceof HttpError))
      authLog('error', error instanceof Error ? error.message : 'auth runtime', requestId)
    await releaseReservation()
    return json(
      {
        message:
          error instanceof HttpError
            ? publicErrorMessage(error, requestLocale(request))
            : translate(requestLocale(request), 'error_auth_unavailable'),
        code: 'AUTH_UNAVAILABLE',
      },
      error instanceof HttpError ? error.status : 503,
    )
  }
}
