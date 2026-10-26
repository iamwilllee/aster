import { database } from '@/server/database.server'
import { HttpError } from '@/server/http.server'
export const enabledAccountSQL =
  'NOT EXISTS (SELECT 1 FROM account_access WHERE user_id=? AND disabled_at IS NOT NULL)'
import { activeAdminCountSQL } from './access-policy.mjs'
export { activeAdminCountSQL }
export async function accountEnabled(userId: string) {
  return !!(await database()
    .prepare(`SELECT id FROM user WHERE id=? AND ${enabledAccountSQL}`)
    .bind(userId, userId)
    .first())
}
export async function assertAccountEnabled(userId: string) {
  if (!(await accountEnabled(userId)))
    throw new HttpError(401, '账号当前不可用，请联系网站管理员。')
}
export async function lastAdministrator(userId: string) {
  return !!(await database()
    .prepare(`SELECT user_id FROM admin_user WHERE user_id=? AND ${activeAdminCountSQL}<=1`)
    .bind(userId)
    .first())
}
export async function assertAdministratorDeletion(userId: string) {
  if (await lastAdministrator(userId))
    throw new HttpError(409, '请先指定另一位有效管理员，再注销当前管理员账号。')
}
