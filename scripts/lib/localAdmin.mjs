// پشتیبان محلی داشبورد /admin — فقط داخل `npm run dev` (پلاگین vite با apply:'serve').
// در حالت محلی توکن GitHub لازم نیست: تغییرها روی فایل‌های همین ریپو (data/) نوشته می‌شود، با build-content
// اعتبارسنجی می‌شود، سپس git add/commit/push (فقط همان فایل‌ها). در build/production این کد هرگز اجرا نمی‌شود.
import { execFile } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)
const MAX_BODY = 40 * 1024 * 1024
const PATH_RE = /^data\/[A-Za-z0-9._\-/]+$/
const EXT_RE = /\.(json|md|webp|png|jpe?g|gif|svg)$/i

export class LocalAdminError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

/** فقط مسیرهای نسبی داخل data/ با پسوند مجاز؛ هر چیز دیگر (.. ، مطلق، پوشهٔ دیگر) رد می‌شود. */
export function safeDataPath(p) {
  const s = String(p ?? '').replaceAll('\\', '/')
  if (!PATH_RE.test(s) || !EXT_RE.test(s) || s.split('/').some((x) => x === '..' || x === '.' || x === '')) {
    throw new LocalAdminError(400, `مسیر مجاز نیست: ${s.slice(0, 80)}`)
  }
  return s
}

const abs = (root, rel) => {
  const full = resolve(root, rel)
  if (!full.startsWith(resolve(root, 'data') + sep)) throw new LocalAdminError(400, 'مسیر خارج از data/')
  return full
}

/** نوشتن/حذف فایل‌ها؛ تابع undo همه را به حالت قبل برمی‌گرداند. */
export async function applyChanges(root, changes) {
  if (!Array.isArray(changes) || changes.length === 0) throw new LocalAdminError(422, 'تغییری برای ذخیره نیست')
  const clean = changes.map((c) => ({ ...c, path: safeDataPath(c?.path) }))
  const before = new Map()
  for (const c of clean) {
    try { before.set(c.path, await readFile(abs(root, c.path))) } catch { before.set(c.path, null) }
  }
  const undo = async () => {
    for (const [p, buf] of before) {
      if (buf === null) await rm(abs(root, p), { force: true })
      else await writeFile(abs(root, p), buf)
    }
  }
  try {
    for (const c of clean) {
      const f = abs(root, c.path)
      if (c.delete) { await rm(f, { force: true }); continue }
      await mkdir(dirname(f), { recursive: true })
      if (typeof c.base64 === 'string') await writeFile(f, Buffer.from(c.base64, 'base64'))
      else if (typeof c.text === 'string') await writeFile(f, c.text, 'utf8')
      else throw new LocalAdminError(422, `محتوای ${c.path} مشخص نیست`)
    }
  } catch (e) {
    await undo()
    throw e
  }
  return { paths: clean.map((c) => c.path), undo }
}

const git = (root, args, timeout = 30_000) =>
  run('git', args, { cwd: root, timeout, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }, maxBuffer: 8 * 1024 * 1024, windowsHide: true })

const errText = (e) => String(e?.stderr || e?.stdout || e?.message || e).trim().slice(0, 400)

async function validateAndBuild(root) {
  try {
    await run(process.execPath, ['scripts/build-content.mjs'], { cwd: root, timeout: 60_000, windowsHide: true })
  } catch (e) {
    throw new LocalAdminError(422, `اعتبارسنجی/ساخت داده ناموفق بود (تغییرات برگردانده شد):\n${errText(e)}`)
  }
}

export async function localCommit(root, changes, message) {
  const msg = String(message || 'به‌روزرسانی محتوا از داشبورد').slice(0, 200)
  const { paths, undo } = await applyChanges(root, changes)
  try {
    await validateAndBuild(root)
  } catch (e) {
    await undo()
    throw e
  }
  try {
    await git(root, ['add', '-A', '--', ...paths])
    await git(root, ['commit', '-m', msg, '--', ...paths])
  } catch (e) {
    const t = errText(e)
    if (/nothing (added )?to commit|no changes added/i.test(t)) throw new LocalAdminError(422, 'تغییری نسبت به نسخهٔ فعلی نبود')
    throw new LocalAdminError(500, `فایل‌ها ذخیره شد ولی git commit انجام نشد: ${t}`)
  }
  const sha = (await git(root, ['rev-parse', 'HEAD'])).stdout.trim()
  try {
    await git(root, ['push'], 90_000)
    return { sha, pushed: true }
  } catch (e) {
    return { sha, pushed: false, pushError: errText(e) }
  }
}

export async function localRead(root, path, at) {
  const p = safeDataPath(path)
  if (at) {
    if (!/^[0-9a-f]{7,40}$/i.test(at)) throw new LocalAdminError(400, 'شناسهٔ commit نامعتبر')
    try { return { text: (await git(root, ['show', `${at}:${p}`])).stdout, sha: at } } catch { return null }
  }
  try { return { text: await readFile(abs(root, p), 'utf8'), sha: 'local' } } catch { return null }
}

export async function localHistory(root, limit = 15) {
  const out = (await git(root, ['log', `-n${Math.min(50, limit)}`, '--format=%H%x09%aI%x09%s', '--', 'data'])).stdout
  return out.split('\n').filter(Boolean).map((l) => {
    const [sha, date, ...rest] = l.split('\t')
    return { sha, date, message: rest.join('\t') }
  })
}

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])
const HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/** فقط از همین کامپیوتر، با Host محلی و هدر سفارشی (جلوی درخواست‌های سایت‌های دیگر). */
export function isLocalRequest(req) {
  const host = String(req.headers.host ?? '').replace(/:\d+$/, '').toLowerCase()
  return LOOPBACK.has(req.socket?.remoteAddress ?? '') && HOSTS.has(host) && req.headers['x-local-admin'] === '1'
}

async function body(req) {
  const chunks = []
  let n = 0
  for await (const c of req) {
    n += c.length
    if (n > MAX_BODY) throw new LocalAdminError(413, 'حجم درخواست زیاد است')
    chunks.push(c)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') } catch { throw new LocalAdminError(400, 'JSON نامعتبر') }
}

export function createLocalAdminMiddleware(root) {
  return async (req, res) => {
    const send = (status, obj) => {
      res.statusCode = status
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      res.end(JSON.stringify(obj))
    }
    if (!isLocalRequest(req)) return send(403, { error: 'فقط از همین کامپیوتر' })
    try {
      const u = new URL(req.url ?? '/', 'http://localhost')
      if (req.method === 'GET' && u.pathname === '/info') {
        const branch = (await git(root, ['rev-parse', '--abbrev-ref', 'HEAD']).catch(() => ({ stdout: '' }))).stdout.trim()
        return send(200, { ok: true, branch })
      }
      if (req.method === 'GET' && u.pathname === '/read') return send(200, { file: await localRead(root, u.searchParams.get('path'), u.searchParams.get('at')) })
      if (req.method === 'GET' && u.pathname === '/history') return send(200, { items: await localHistory(root) })
      if (req.method === 'POST' && u.pathname === '/commit') {
        const b = await body(req)
        return send(200, await localCommit(root, b.changes, b.message))
      }
      return send(404, { error: 'پیدا نشد' })
    } catch (e) {
      return send(e instanceof LocalAdminError ? e.status : 500, { error: e instanceof Error ? e.message : 'خطا' })
    }
  }
}

/** پلاگین vite: فقط در dev */
export function localAdminPlugin() {
  return {
    name: 'haram-local-admin',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__local-admin', createLocalAdminMiddleware(process.cwd()))
    },
  }
}
