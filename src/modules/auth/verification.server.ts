import { APIError } from 'better-auth/api'
import { signJWT, verifyJWT } from 'better-auth/crypto'
import { z } from 'zod'

// Better Auth's default verification JWT names only an email. Bind delivered links to an account
// incarnation so a pre-deletion link cannot verify a later signup with the same email address.
export async function bindVerificationLink(
  url: string,
  token: string,
  userId: string,
  secret: string,
) {
  const payload = z
    .object({ email: z.email(), exp: z.number() })
    .passthrough()
    .parse(await verifyJWT(token, secret))
  const bound = new URL(url)
  bound.searchParams.set(
    'token',
    await signJWT(
      { ...payload, sub: userId },
      secret,
      Math.max(1, payload.exp - Math.floor(Date.now() / 1000)),
    ),
  )
  return bound.toString()
}

export async function assertVerificationOwner(request: Request, userId: string, secret: string) {
  const token = new URL(request.url).searchParams.get('token')
  const payload = z
    .object({ sub: z.string() })
    .safeParse(token ? await verifyJWT(token, secret) : null)
  if (!payload.success || payload.data.sub !== userId)
    throw new APIError('BAD_REQUEST', {
      code: 'INVALID_TOKEN',
      message: 'Invalid verification token',
    })
}
