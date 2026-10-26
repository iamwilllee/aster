import { z } from 'zod'
export const reasons = ['security', 'abuse', 'support', 'maintenance'] as const
export const accessInput = z
  .object({ revision: z.int().min(0), disabled: z.boolean(), reason: z.enum(reasons) })
  .strict()
export interface ManagedUser {
  id: string
  name: string
  email: string
  emailVerified: boolean
  createdAt: number
  disabledAt: number | null
  revision: number
  admin: boolean
  protectedAdministrator: boolean
}
export interface UserDetail {
  user: ManagedUser
  counts: { projects: number; files: number; sessions: number }
  loginMethods: string[]
  hasBillingHistory: boolean
}
export interface AuditRow {
  id: string
  action: 'user.disable' | 'user.enable' | 'admin.grant' | 'admin.revoke'
  reason: (typeof reasons)[number]
  source: 'web' | 'database'
  createdAt: number
  actor: { id: string; name: string; email: string } | null
  target: { id: string; name: string; email: string } | null
}
