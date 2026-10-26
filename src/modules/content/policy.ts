import { z } from 'zod'
export const contentInput = z
  .object({
    title: z.string().trim().min(1).max(160),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(80),
    locale: z.enum(['en', 'zh']),
    kind: z.enum(['article', 'help', 'announcement']),
    category: z.string().trim().max(60),
    summary: z.string().trim().max(500),
    body: z.string().trim().min(1).max(12000),
    seoTitle: z.string().trim().max(160),
    seoDescription: z.string().trim().max(300),
    coverAssetId: z.uuid().nullable(),
  })
  .strict()
export type ContentInput = z.infer<typeof contentInput>
export interface ContentRecord {
  id: string
  draft: ContentInput
  live: ContentInput | null
  revision: number
  publishedAt: number | null
  updatedAt: number
}
export interface PublicContent extends ContentInput {
  publishedAt: number
}
export interface ContentAsset {
  id: string
  name: string
  type: string
  size: number
  state: 'pending' | 'ready' | 'deleting'
  references: number
}
export const contentLimits = { entries: 500, assets: 100, totalBytes: 250 * 1024 * 1024 }
export const contentAssetUrl = (id: string, admin = false) =>
  admin ? '/api/admin/content/assets/' + id + '/content' : '/api/content/assets/' + id
