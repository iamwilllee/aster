import { createCsrfMiddleware, createMiddleware, createStart } from '@tanstack/react-start'
import { withSecurityHeaders } from '@/server/security-headers'

// Server functions are same-origin RPC endpoints (all of Aster's are read-only GETs).
// Rejecting cross-site requests is defense in depth; mutations go through /api with their own
// Origin check.
const csrf = createCsrfMiddleware({ filter: (context) => context.handlerType === 'serverFn' })

// Security headers on every response: pages, API routes and server functions.
const securityHeaders = createMiddleware().server(async ({ next, request }) => {
  const result = await next()
  return { ...result, response: withSecurityHeaders(result.response, request) }
})

export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeaders, csrf],
}))
