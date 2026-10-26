import { z } from 'zod'

export const projectInput = z.object({
  coverAssetId: z.uuid().nullable().optional(),
  name: z.string().trim().min(1, '请输入项目名称').max(80, '项目名称不超过 80 个字符'),
  description: z.string().trim().max(500, '描述不超过 500 个字符').default(''),
  status: z.enum(['idea', 'building', 'live']).default('idea'),
})
export type ProjectInput = z.infer<typeof projectInput>
export type Project = ProjectInput & {
  id: string
  created_at: number
  updated_at: number
  cover_asset_id: string | null
}
