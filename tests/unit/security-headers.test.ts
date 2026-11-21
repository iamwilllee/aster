import { describe, expect, it } from 'vitest'
import { securityHeaders, withSecurityHeaders } from '@/server/security-headers'

const https = new Request('https://app.example/')
const http = new Request('http://127.0.0.1:3100/')

describe('security headers', () => {
  it('forbids framing, base injection, plugins and cross-site form posts', () => {
    const csp = securityHeaders(https)['Content-Security-Policy']!
    for (const directive of [
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "object-src 'none'",
      "form-action 'self'",
    ])
      expect(csp).toContain(directive)
    expect(securityHeaders(https)['X-Frame-Options']).toBe('DENY')
  })

  it('does not restrict scripts or styles, which needs a nonce first', () => {
    expect(securityHeaders(https)['Content-Security-Policy']).not.toMatch(
      /script-src|default-src|style-src/,
    )
  })

  it('sends HSTS only over HTTPS', () => {
    expect(securityHeaders(https)['Strict-Transport-Security']).toBe('max-age=31536000')
    expect(securityHeaders(http)['Strict-Transport-Security']).toBeUndefined()
  })

  it('keeps a stricter header a handler already set', () => {
    const response = new Response('x', {
      headers: { 'Content-Security-Policy': "default-src 'none'; sandbox" },
    })
    const result = withSecurityHeaders(response, https)
    expect(result.headers.get('Content-Security-Policy')).toBe("default-src 'none'; sandbox")
    expect(result.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })

  it('rebuilds a response whose headers are immutable', () => {
    const redirect = Response.redirect('https://app.example/login', 302)
    const result = withSecurityHeaders(redirect, https)
    expect(result.status).toBe(302)
    expect(result.headers.get('Location')).toBe('https://app.example/login')
    expect(result.headers.get('Referrer-Policy')).toBe('no-referrer')
  })
})
