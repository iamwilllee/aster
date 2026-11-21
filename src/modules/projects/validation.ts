import { z } from 'zod'

export const projectInput = z.object({
  coverAssetId: z.uuid().nullable().optional(),
  name: z.string().trim().min(1, 'error_project_name_required').max(80, 'error_project_name_long'),
  description: z.string().trim().max(500, 'error_project_description_long').default(''),
  status: z.enum(['idea', 'building', 'live']).default('idea'),
})
export type ProjectInput = z.infer<typeof projectInput>
export type Project = ProjectInput & {
  id: string
  created_at: number
  updated_at: number
  cover_asset_id: string | null
}
