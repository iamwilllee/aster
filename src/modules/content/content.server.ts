import { z } from 'zod'
import { features } from '@/config/features'
import { database } from '@/server/database.server'
import { body, boundedBytes, HttpError, json } from '@/server/http.server'
import { assetBucket, filesConfigured } from '@/modules/files/files.server'
import { fileLimits, imageType } from '@/modules/files/policy'
import { contentInput, contentLimits, type ContentRecord, type PublicContent } from './policy'

// A revoked admin or an account undergoing deletion cannot commit an editorial mutation.
const editor =
  "EXISTS (SELECT 1 FROM admin_user JOIN user ON user.id=admin_user.user_id WHERE user_id=? AND NOT EXISTS(SELECT 1 FROM account_access WHERE user_id=user.id AND disabled_at IS NOT NULL)) AND NOT EXISTS (SELECT 1 FROM billing_account_state WHERE user_id=? AND (closed_at IS NOT NULL OR lock_until>unixepoch('subsec')*1000))"
const editableAsset =
  "(? IS NULL OR EXISTS (SELECT 1 FROM content_asset WHERE id=? AND state='ready'))"
type Entry = {
  id: string
  draft: string
  live: string | null
  revision: number
  published_at: number | null
  updated_at: number
}
const record = (r: Entry): ContentRecord => ({
  id: r.id,
  draft: contentInput.parse(JSON.parse(r.draft)),
  live: r.live ? contentInput.parse(JSON.parse(r.live)) : null,
  revision: r.revision,
  publishedAt: r.published_at,
  updatedAt: r.updated_at,
})
function changed(result: D1Result) {
  if (!result.meta.changes) throw new HttpError(409, '内容已变化或暂不可用，请刷新后重试。')
}
async function save(statement: D1PreparedStatement) {
  try {
    const result = await statement.run()
    changed(result)
    return result
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint'))
      throw new HttpError(409, '该发布网址已被占用。')
    throw error
  }
}
export async function publicEntries(input: {
  locale: 'en' | 'zh'
  q?: string
  kind?: string
  category?: string
  page?: number
}) {
  if (!features.content) throw new HttpError(404, '接口不存在')
  const { locale, q = '', kind = '', category = '' } = input,
    page = Math.max(1, Math.floor(Math.min(10000, input.page ?? 1))),
    db = database()
  const where =
    "live IS NOT NULL AND live_locale=? AND (?='' OR json_extract(live,'$.kind')=?) AND (?='' OR json_extract(live,'$.category')=?) AND instr(lower(json_extract(live,'$.title')||' '||json_extract(live,'$.summary')),lower(?))>0"
  const values = [locale, kind, kind, category, category, q.slice(0, 80)]
  const rows = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT live,published_at FROM content_entry WHERE ${where} ORDER BY published_at DESC,id LIMIT 12 OFFSET ?`,
      )
      .bind(...values, (page - 1) * 12),
    db.prepare(`SELECT COUNT(*) AS total FROM content_entry WHERE ${where}`).bind(...values),
    db
      .prepare(
        "SELECT DISTINCT json_extract(live,'$.category') AS category FROM content_entry WHERE live IS NOT NULL AND live_locale=? ORDER BY category LIMIT 501",
      )
      .bind(locale),
  ])
  return {
    items: rows[0]!.results.map((r) => {
      const value = contentInput.parse(JSON.parse(String(r.live)))
      return {
        title: value.title,
        slug: value.slug,
        locale: value.locale,
        kind: value.kind,
        category: value.category,
        summary: value.summary,
        coverAssetId: features.files ? value.coverAssetId : null,
        publishedAt: Number(r.published_at),
      }
    }),
    total: Number(rows[1]!.results[0]?.total ?? 0),
    page,
    categories: rows[2]!.results.map((r) => String(r.category)).filter(Boolean),
  }
}
export async function publicEntry(
  locale: 'en' | 'zh',
  slug: string,
): Promise<PublicContent | null> {
  if (!features.content) return null
  const row = await database()
    .prepare(
      'SELECT live,published_at FROM content_entry WHERE live IS NOT NULL AND live_locale=? AND live_slug=?',
    )
    .bind(locale, slug)
    .first<{ live: string; published_at: number }>()
  if (!row) return null
  const value = contentInput.parse(JSON.parse(row.live))
  return {
    ...value,
    coverAssetId: features.files ? value.coverAssetId : null,
    publishedAt: row.published_at,
  }
}
const references =
  '(SELECT COUNT(*) FROM content_entry WHERE cover_asset_id=content_asset.id OR live_cover_asset_id=content_asset.id)'
async function assetContent(id: string, admin: boolean, method: string) {
  const row = await database()
    .prepare(
      `SELECT object_key,content_type FROM content_asset WHERE id=? AND state='ready' ${admin ? '' : 'AND EXISTS (SELECT 1 FROM content_entry WHERE live IS NOT NULL AND live_cover_asset_id=content_asset.id)'}`,
    )
    .bind(id)
    .first<{ object_key: string; content_type: string }>()
  if (!row) throw new HttpError(404, '网站素材不存在。')
  const object = await assetBucket().get(row.object_key)
  if (!object) throw new HttpError(404, '网站素材不存在。')
  if (method === 'HEAD') await object.body.cancel()
  return new Response(method === 'HEAD' ? null : object.body, {
    headers: {
      'Content-Type': row.content_type,
      'Content-Length': String(object.size),
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'X-Robots-Tag': 'noindex',
    },
  })
}
export async function handlePublicContent(request: Request) {
  if (!features.content) throw new HttpError(404, '接口不存在')
  const url = new URL(request.url),
    match = /^\/api\/content\/assets\/([a-f0-9-]{36})$/.exec(url.pathname)
  if (match && features.files && ['GET', 'HEAD'].includes(request.method))
    return assetContent(match[1]!, false, request.method)
  if (url.pathname === '/api/content' && request.method === 'GET')
    return json(
      await publicEntries({
        locale: url.searchParams.get('locale') === 'zh' ? 'zh' : 'en',
        q: url.searchParams.get('q') ?? '',
        kind: url.searchParams.get('kind') ?? '',
        category: url.searchParams.get('category') ?? '',
        page: Number(url.searchParams.get('page')) || 1,
      }),
    )
  throw new HttpError(404, '接口不存在')
}
async function upload(request: Request, userId: string) {
  const store = assetBucket(),
    bytes = await boundedBytes(request, fileLimits.maxFileBytes),
    type = imageType(bytes)
  if (!type || type !== request.headers.get('content-type'))
    throw new HttpError(400, '仅支持文件头匹配的 PNG、JPEG 或 WebP 图片。')
  let name: string
  try {
    name = decodeURIComponent(request.headers.get('x-file-name') ?? '')
      .normalize('NFC')
      .trim()
  } catch {
    throw new HttpError(400, '图片名称无效。')
  }
  if (!name || name.length > 160 || /[\x00-\x1f\x7f/\\]/.test(name))
    throw new HttpError(400, '图片名称无效。')
  const id = crypto.randomUUID(),
    key = 'content/' + id,
    db = database()
  changed(
    await db
      .prepare(
        `INSERT INTO content_asset (id,object_key,name,content_type,size,state,uploaded_by,created_at) SELECT ?,?,?,?,?,'pending',?,? WHERE ${editor} AND (SELECT COUNT(*) FROM content_asset)<? AND (SELECT COALESCE(SUM(size),0) FROM content_asset)+?<=?`,
      )
      .bind(
        id,
        key,
        name,
        type,
        bytes.length,
        userId,
        Date.now(),
        userId,
        userId,
        contentLimits.assets,
        bytes.length,
        contentLimits.totalBytes,
      )
      .run(),
  )
  try {
    const object = await store.put(key, bytes, {
      httpMetadata: { contentType: type },
      customMetadata: { contentAssetId: id },
    })
    if (object.size !== bytes.length) throw new Error('Unconfirmed upload')
    changed(
      await db
        .prepare(
          `UPDATE content_asset SET state='ready' WHERE id=? AND state='pending' AND ${editor}`,
        )
        .bind(id, userId, userId)
        .run(),
    )
  } catch {
    throw new HttpError(503, '网站素材上传尚未确认，请先检查素材，不要重复上传。')
  }
  return json({ id }, 201)
}
export async function handleAdminContent(request: Request, userId: string) {
  if (!features.content) throw new HttpError(404, '接口不存在')
  // The API entrypoint authenticates and checks current admin membership before dispatch.
  const path = new URL(request.url).pathname,
    method = request.method,
    db = database()
  if (path.startsWith('/api/admin/content/assets')) {
    if (!features.files) throw new HttpError(404, '接口不存在')
    if (path === '/api/admin/content/assets') {
      if (method === 'POST') return upload(request, userId)
      if (method === 'GET')
        return json({
          configured: filesConfigured(),
          assets: (
            await db
              .prepare(
                `SELECT id,name,content_type AS type,size,state,${references} AS refs FROM content_asset ORDER BY created_at DESC,id LIMIT 101`,
              )
              .all()
          ).results.map(({ refs, ...r }) => ({ ...r, references: refs })),
        })
    }
    const match = /^\/api\/admin\/content\/assets\/([a-f0-9-]{36})(?:\/(content|reconcile))?$/.exec(
      path,
    )
    if (!match) throw new HttpError(404, '接口不存在')
    const id = match[1]!
    if (match[2] === 'content' && ['GET', 'HEAD'].includes(method))
      return assetContent(id, true, method)
    const row = await db
      .prepare('SELECT * FROM content_asset WHERE id=?')
      .bind(id)
      .first<{ object_key: string; size: number; content_type: string; state: string }>()
    if (!row) throw new HttpError(404, '网站素材不存在。')
    if (match[2] === 'reconcile' && method === 'POST') {
      if (row.state !== 'pending') throw new HttpError(409, '内容已变化或暂不可用，请刷新后重试。')
      const object = await assetBucket().head(row.object_key)
      if (
        !object ||
        object.size !== row.size ||
        object.httpMetadata?.contentType !== row.content_type ||
        object.customMetadata?.contentAssetId !== id
      )
        throw new HttpError(409, '网站素材上传尚未确认，请先检查素材，不要重复上传。')
      changed(
        await db
          .prepare(
            `UPDATE content_asset SET state='ready' WHERE id=? AND state='pending' AND ${editor}`,
          )
          .bind(id, userId, userId)
          .run(),
      )
      return json({ ok: true })
    }
    if (!match[2] && method === 'DELETE') {
      changed(
        await db
          .prepare(
            `UPDATE content_asset SET state='deleting' WHERE id=? AND state IN ('ready','deleting') AND (${references})=0 AND ${editor}`,
          )
          .bind(id, userId, userId)
          .run(),
      )
      try {
        await assetBucket().delete(row.object_key)
      } catch {
        throw new HttpError(503, '图片清理尚未完成，请重试删除。')
      }
      // Delete only this fenced record; a concurrent draft cannot attach a deleting asset.
      changed(
        await db
          .prepare(`DELETE FROM content_asset WHERE id=? AND state='deleting' AND ${editor}`)
          .bind(id, userId, userId)
          .run(),
      )
      return json({ ok: true })
    }
    throw new HttpError(404, '接口不存在')
  }
  if (path === '/api/admin/content') {
    if (method === 'GET') {
      const raw = Number(new URL(request.url).searchParams.get('page')) || 1
      const page = Math.max(1, Math.min(10000, Math.floor(raw)))
      const rows = await db.batch<Entry>([
        db
          .prepare(
            'SELECT id,draft,live,revision,published_at,updated_at FROM content_entry ORDER BY updated_at DESC,id LIMIT 12 OFFSET ?',
          )
          .bind((page - 1) * 12),
      ])
      const count = await db
        .prepare('SELECT COUNT(*) AS total FROM content_entry')
        .first<{ total: number }>()
      return json({ records: rows[0]!.results.map(record), total: count?.total ?? 0, page })
    }
    if (method === 'POST') {
      const input = await body(request, contentInput, 65536),
        id = crypto.randomUUID(),
        now = Date.now()
      if (input.coverAssetId && !features.files) throw new HttpError(400, '图片资源功能未启用。')
      await save(
        db
          .prepare(
            `INSERT INTO content_entry (id,draft,cover_asset_id,revision,created_by,updated_by,created_at,updated_at) SELECT ?,?,?,1,?,?,?,? WHERE ${editor} AND (SELECT COUNT(*) FROM content_entry)<? AND ${editableAsset}`,
          )
          .bind(
            id,
            JSON.stringify(input),
            input.coverAssetId,
            userId,
            userId,
            now,
            now,
            userId,
            userId,
            contentLimits.entries,
            input.coverAssetId,
            input.coverAssetId,
          ),
      )
      return json({ id }, 201)
    }
  }
  const match = /^\/api\/admin\/content\/([a-f0-9-]{36})(?:\/(publish|withdraw))?$/.exec(path)
  if (!match) throw new HttpError(404, '接口不存在')
  const id = match[1]!
  if (method === 'PATCH' && !match[2]) {
    const input = await body(
        request,
        z.object({ revision: z.int().positive(), draft: contentInput }).strict(),
        65536,
      ),
      d = input.draft
    if (d.coverAssetId && !features.files) throw new HttpError(400, '图片资源功能未启用。')
    await save(
      db
        .prepare(
          `UPDATE content_entry SET draft=?,cover_asset_id=?,revision=revision+1,updated_by=?,updated_at=? WHERE id=? AND revision=? AND ${editor} AND ${editableAsset}`,
        )
        .bind(
          JSON.stringify(d),
          d.coverAssetId,
          userId,
          Date.now(),
          id,
          input.revision,
          userId,
          userId,
          d.coverAssetId,
          d.coverAssetId,
        ),
    )
    return json({ ok: true })
  }
  if (method === 'POST' && match[2]) {
    const { revision } = await body(request, z.object({ revision: z.int().positive() }).strict())
    if (match[2] === 'withdraw')
      await save(
        db
          .prepare(
            `UPDATE content_entry SET live=NULL,live_slug=NULL,live_locale=NULL,live_cover_asset_id=NULL,published_at=NULL,revision=revision+1,updated_by=?,updated_at=? WHERE id=? AND revision=? AND ${editor}`,
          )
          .bind(userId, Date.now(), id, revision, userId, userId),
      )
    else {
      const entry = await db
        .prepare('SELECT draft FROM content_entry WHERE id=? AND revision=?')
        .bind(id, revision)
        .first<{ draft: string }>()
      if (!entry) throw new HttpError(409, '内容已变化或暂不可用，请刷新后重试。')
      const d = contentInput.parse(JSON.parse(entry.draft))
      if (d.coverAssetId && !features.files) throw new HttpError(400, '图片资源功能未启用。')
      await save(
        db
          .prepare(
            `UPDATE content_entry SET live=draft,live_slug=?,live_locale=?,live_cover_asset_id=cover_asset_id,published_at=?,revision=revision+1,updated_by=?,updated_at=? WHERE id=? AND revision=? AND ${editor} AND ${editableAsset}`,
          )
          .bind(
            d.slug,
            d.locale,
            Date.now(),
            userId,
            Date.now(),
            id,
            revision,
            userId,
            userId,
            d.coverAssetId,
            d.coverAssetId,
          ),
      )
    }
    return json({ ok: true })
  }
  if (method === 'DELETE' && !match[2]) {
    const { revision } = await body(request, z.object({ revision: z.int().positive() }).strict())
    await save(
      db
        .prepare(
          `DELETE FROM content_entry WHERE id=? AND revision=? AND live IS NULL AND ${editor}`,
        )
        .bind(id, revision, userId, userId),
    )
    return json({ ok: true })
  }
  throw new HttpError(404, '接口不存在')
}
