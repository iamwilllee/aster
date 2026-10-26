import { createServerFn } from '@tanstack/react-start'
import { setResponseHeader } from '@tanstack/react-start/server'
import { z } from 'zod'
const query = z.object({
  locale: z.enum(['en', 'zh']),
  q: z.string().max(80).default(''),
  kind: z.string().max(20).default(''),
  category: z.string().max(60).default(''),
  page: z.int().min(1).max(10000).default(1),
})
export const getContentList = createServerFn({ method: 'GET' })
  .validator(query)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store, max-age=0')
    const { publicEntries } = await import('./content.server')
    return publicEntries(data)
  })
export const getContentDetail = createServerFn({ method: 'GET' })
  .validator(z.object({ locale: z.enum(['en', 'zh']), slug: z.string().max(80) }))
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store, max-age=0')
    const { publicEntry } = await import('./content.server')
    return publicEntry(data.locale, data.slug)
  })
