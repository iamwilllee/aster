import { features } from '@/config/features'
import { createServerFn } from '@tanstack/react-start'
import { getRequest, setResponseHeader } from '@tanstack/react-start/server'

export const getAuthInfo = createServerFn({ method: 'GET' }).handler(async () => {
  const { isLocalRequest } = await import('./http.server')
  setResponseHeader('Cache-Control', 'private, no-store')
  const { googleAuthStatus } = await import('@/modules/auth/config.server')
  const { isMailConfigured } = await import('@/modules/mail/mail.server')
  const local = isLocalRequest(getRequest())
  return {
    local,
    emailPassword: features.emailPassword,
    google: googleAuthStatus(),
    mailReady: isMailConfigured(getRequest()),
  }
})

export const getWorkspace = createServerFn({ method: 'GET' }).handler(async () => {
  setResponseHeader('Cache-Control', 'private, no-store')
  if (!features.auth) return null
  const { workspace } = await import('./app.server')
  const { HttpError } = await import('./http.server')
  try {
    return await workspace(getRequest())
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) return null
    throw error
  }
})

export const getPublicConfig = createServerFn({ method: 'GET' }).handler(async () => {
  const { env } = await import('cloudflare:workers')
  const { isMailConfigured } = await import('@/modules/mail/mail.server')
  setResponseHeader('Cache-Control', 'private, no-store')
  return {
    origin: new URL(env.APP_ORIGIN).origin,
    local: (await import('./http.server')).isLocalRequest(getRequest()),
    indexable: String(env.PUBLIC_INDEXABLE) === 'true',
    features,
    registrationReady:
      features.auth &&
      ((features.emailPassword && isMailConfigured(getRequest())) ||
        (features.google &&
          (await import('@/modules/auth/config.server')).googleAuthStatus().ready)),
  }
})
