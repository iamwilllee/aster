import { env } from 'cloudflare:workers'
import { features } from '@/config/features'
import { HttpError } from './http.server'

export function database(): D1Database {
  if (!features.database) throw new HttpError(404, 'error_api_missing')
  const binding: unknown = Reflect.get(env, 'DB')
  if (
    !binding ||
    typeof binding !== 'object' ||
    !('prepare' in binding) ||
    typeof binding.prepare !== 'function'
  )
    throw new HttpError(503, 'error_unavailable')
  return binding as D1Database
}
