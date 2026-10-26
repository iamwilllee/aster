import { database } from '@/server/database.server'
import { body, HttpError, json } from '@/server/http.server'
import { activeAdminCountSQL } from './access.server'
import { accessInput, type ManagedUser } from './policy'
const actor =
  "EXISTS (SELECT 1 FROM admin_user JOIN user ON user.id=admin_user.user_id LEFT JOIN account_access ON account_access.user_id=user.id WHERE user.id=? AND user.email_verified=1 AND account_access.disabled_at IS NULL) AND NOT EXISTS(SELECT 1 FROM billing_account_state WHERE user_id=? AND (closed_at IS NOT NULL OR lock_until>unixepoch('subsec')*1000))"
const fields = `u.id,u.name,u.email,u.email_verified AS emailVerified,u.created_at AS createdAt,a.disabled_at AS disabledAt,COALESCE(a.revision,0) AS revision,EXISTS(SELECT 1 FROM admin_user WHERE user_id=u.id) AS admin`
type UserRow = Omit<ManagedUser, 'admin' | 'emailVerified' | 'protectedAdministrator'> & {
  admin: number
  emailVerified: number
}
const present = (r: UserRow, count: number): ManagedUser => ({
  ...r,
  admin: !!r.admin,
  emailVerified: !!r.emailVerified,
  protectedAdministrator: !!r.admin && !!r.emailVerified && r.disabledAt === null && count <= 1,
})
const pageNumber = (url: URL) =>
  Math.max(1, Math.min(10000, Math.floor(Number(url.searchParams.get('page')) || 1)))
export async function handleAdmin(request: Request, actorId: string) {
  const url = new URL(request.url),
    path = url.pathname,
    db = database()
  // Caller verifies a live, enabled admin on every request; mutations repeat it inside the SQL statement.
  if (path === '/api/admin/users' && request.method === 'GET') {
    const q = (url.searchParams.get('q') ?? '').slice(0, 80),
      status = url.searchParams.get('status') ?? '',
      page = pageNumber(url)
    const where =
      "instr(lower(u.name||' '||u.email),lower(?))>0 AND (?='' OR (?='disabled' AND a.disabled_at IS NOT NULL) OR (?='active' AND a.disabled_at IS NULL))"
    const values = [q, status, status, status]
    const result = await db.batch<Record<string, unknown>>([
      db
        .prepare(
          `SELECT ${fields} FROM user u LEFT JOIN account_access a ON a.user_id=u.id WHERE ${where} ORDER BY u.created_at DESC,u.id LIMIT 20 OFFSET ?`,
        )
        .bind(...values, (page - 1) * 20),
      db
        .prepare(
          `SELECT COUNT(*) AS total FROM user u LEFT JOIN account_access a ON a.user_id=u.id WHERE ${where}`,
        )
        .bind(...values),
      db.prepare(`SELECT ${activeAdminCountSQL} AS total`),
    ])
    const count = Number(result[2]!.results[0]?.total ?? 0)
    return json({
      users: result[0]!.results.map((r) => present(r as UserRow, count)),
      total: Number(result[1]!.results[0]?.total ?? 0),
      page,
      activeAdministrators: count,
    })
  }
  if (path === '/api/admin/audit' && request.method === 'GET') {
    const target = (url.searchParams.get('target') ?? '').slice(0, 128),
      page = pageNumber(url)
    const rows = await db.batch<Record<string, unknown>>([
      db
        .prepare(
          "SELECT e.id,e.action,e.reason,e.source,e.created_at AS createdAt,actor.id AS actorId,actor.name AS actorName,actor.email AS actorEmail,target.id AS targetId,target.name AS targetName,target.email AS targetEmail FROM admin_audit e LEFT JOIN user actor ON actor.id=e.actor_id LEFT JOIN user target ON target.id=e.target_id WHERE (?='' OR e.target_id=?) ORDER BY e.created_at DESC,e.id LIMIT 20 OFFSET ?",
        )
        .bind(target, target, (page - 1) * 20),
      db
        .prepare("SELECT COUNT(*) AS total FROM admin_audit WHERE (?='' OR target_id=?)")
        .bind(target, target),
    ])
    return json({
      events: rows[0]!.results.map((r) => ({
        id: r.id,
        action: r.action,
        reason: r.reason,
        source: r.source,
        createdAt: r.createdAt,
        actor: r.actorId ? { id: r.actorId, name: r.actorName, email: r.actorEmail } : null,
        target: r.targetId ? { id: r.targetId, name: r.targetName, email: r.targetEmail } : null,
      })),
      total: Number(rows[1]!.results[0]?.total ?? 0),
      page,
    })
  }
  const match = /^\/api\/admin\/users\/([a-zA-Z0-9_-]{1,128})(?:\/(access))?$/.exec(path)
  if (!match) throw new HttpError(404, '接口不存在')
  const id = match[1]!
  if (!match[2] && request.method === 'GET') {
    const row = await db
      .prepare(
        `SELECT ${fields} FROM user u LEFT JOIN account_access a ON a.user_id=u.id WHERE u.id=?`,
      )
      .bind(id)
      .first<UserRow>()
    if (!row) throw new HttpError(404, '用户不存在。')
    const count = await db
      .prepare(`SELECT ${activeAdminCountSQL} AS total`)
      .first<{ total: number }>()
    const counts = await db
      .prepare(
        'SELECT (SELECT COUNT(*) FROM project WHERE user_id=?) AS projects,(SELECT COUNT(*) FROM file_asset WHERE user_id=?) AS files,(SELECT COUNT(*) FROM session WHERE user_id=? AND expires_at>?) AS sessions,EXISTS(SELECT 1 FROM subscription WHERE user_id=? UNION ALL SELECT 1 FROM checkout WHERE user_id=?) AS billing',
      )
      .bind(id, id, id, Date.now(), id, id)
      .first<{ projects: number; files: number; sessions: number; billing: number }>()
    const methods = await db
      .prepare('SELECT DISTINCT provider_id AS provider FROM account WHERE user_id=? LIMIT 10')
      .bind(id)
      .all<{ provider: string }>()
    return json({
      user: present(row, count?.total ?? 0),
      counts: {
        projects: counts?.projects ?? 0,
        files: counts?.files ?? 0,
        sessions: counts?.sessions ?? 0,
      },
      loginMethods: methods.results.map((m) =>
        m.provider === 'credential' ? 'password' : m.provider === 'google' ? 'google' : 'other',
      ),
      hasBillingHistory: !!counts?.billing,
    })
  }
  if (match[2] && request.method === 'POST') {
    const input = await body(request, accessInput)
    if (id === actorId) throw new HttpError(409, '不能停用或更改当前账号的访问状态。')
    const nonce = crypto.randomUUID(),
      now = Date.now()
    const eligible = `EXISTS(SELECT 1 FROM user WHERE id=?) AND ${actor} AND NOT EXISTS(SELECT 1 FROM billing_account_state WHERE user_id=? AND (closed_at IS NOT NULL OR lock_until>unixepoch('subsec')*1000)) AND ${input.disabled ? 'NOT EXISTS' : 'EXISTS'}(SELECT 1 FROM account_access WHERE user_id=? AND disabled_at IS NOT NULL) AND COALESCE((SELECT revision FROM account_access WHERE user_id=?),0)=? AND (?=0 OR NOT EXISTS(SELECT 1 FROM admin_user JOIN user ON user.id=admin_user.user_id WHERE user_id=? AND user.email_verified=1) OR ${activeAdminCountSQL}>1)`
    const result = await db.batch([
      db
        .prepare(
          `INSERT INTO account_access(user_id,disabled_at,revision,operation_id,updated_at) SELECT ?,?,?,?,? WHERE ${eligible} ON CONFLICT(user_id) DO UPDATE SET disabled_at=excluded.disabled_at,revision=excluded.revision,operation_id=excluded.operation_id,updated_at=excluded.updated_at`,
        )
        .bind(
          id,
          input.disabled ? now : null,
          input.revision + 1,
          nonce,
          now,
          id,
          actorId,
          actorId,
          id,
          id,
          id,
          input.revision,
          input.disabled ? 1 : 0,
          id,
        ),
      db
        .prepare(
          'DELETE FROM session WHERE user_id=? AND ?=1 AND EXISTS(SELECT 1 FROM account_access WHERE user_id=? AND operation_id=?)',
        )
        .bind(id, input.disabled ? 1 : 0, id, nonce),
      db
        .prepare(
          "INSERT INTO admin_audit(id,actor_id,target_id,action,reason,source,created_at) SELECT ?,?,?,?, ?,'web',? WHERE EXISTS(SELECT 1 FROM account_access WHERE user_id=? AND operation_id=?)",
        )
        .bind(
          nonce,
          actorId,
          id,
          input.disabled ? 'user.disable' : 'user.enable',
          input.reason,
          now,
          id,
          nonce,
        ),
    ])
    if (!result[0]?.meta.changes)
      throw new HttpError(409, '账号状态或权限已变化，请刷新后重试；至少保留一位有效管理员。')
    return json({ ok: true })
  }
  throw new HttpError(404, '接口不存在')
}
