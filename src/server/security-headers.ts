// Response headers every page, API and server-function response carries.
// Pure functions with no Worker imports, so the policy is unit-tested without a runtime.
//
// This is deliberately not a full Content-Security-Policy. A script-src policy needs a nonce
// or hash for the inline theme script and the router's hydration script; until that is done
// the directives below give the protections that do not depend on scripts: framing, <base>
// injection, plugins and form posts to other sites.

const csp = [
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

export function securityHeaders(request: Request): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Security-Policy': csp,
    'X-Content-Type-Options': 'nosniff',
    // Older browsers read X-Frame-Options; frame-ancestors above covers the rest.
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy':
      'camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
  }
  // HSTS only where the request really arrived over HTTPS: never on local http.
  // No includeSubDomains or preload: those are decisions for the domain owner, not a template.
  if (new URL(request.url).protocol === 'https:') {
    headers['Strict-Transport-Security'] = 'max-age=31536000'
  }
  return headers
}

/**
 * Adds the headers a response does not already set (a handler's own, stricter Content-Security-Policy
 * for file downloads wins). Responses with immutable headers, such as redirects, are rebuilt.
 */
export function withSecurityHeaders(
  response: Response,
  request: Request,
  extra: Record<string, string> = {},
): Response {
  const wanted = Object.entries({ ...securityHeaders(request), ...extra }).filter(
    ([name]) => !response.headers.has(name),
  )
  if (wanted.length === 0) return response
  try {
    for (const [name, value] of wanted) response.headers.set(name, value)
    return response
  } catch {
    const headers = new Headers(response.headers)
    for (const [name, value] of wanted) headers.set(name, value)
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  }
}
