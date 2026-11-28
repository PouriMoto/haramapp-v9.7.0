/**
 * پشتیبان محلی داشبورد (فقط `npm run dev`): بدون توکن GitHub.
 * فایل‌ها روی دیسک همین ریپو نوشته و با build-content اعتبارسنجی می‌شوند، سپس git add/commit/push.
 * سرور آن: scripts/lib/localAdmin.mjs (پلاگین vite؛ فقط در dev، فقط از localhost).
 */
import { GithubError, type AdminBackend, type CommitInfo, type FileChange } from './github'

const BASE = '/__local-admin'
const H = { 'X-Local-Admin': '1' }

async function call<T>(path: string, init: RequestInit = {}, f: typeof fetch = (...a) => fetch(...a)): Promise<T> {
  let res: Response
  try {
    res = await f(`${BASE}${path}`, { ...init, headers: { ...H, ...(init.body ? { 'Content-Type': 'application/json' } : {}) }, cache: 'no-store' })
  } catch { throw new GithubError(0, 'سرور محلی (npm run dev) در دسترس نیست') }
  let j: (T & { error?: string }) | null = null
  try { j = (await res.json()) as T & { error?: string } } catch { /* بدنهٔ غیر JSON */ }
  if (!res.ok || !j) throw new GithubError(res.status, j?.error ?? `خطای سرور محلی (${res.status})`)
  return j
}

/** null = حالت محلی در دسترس نیست (مثلاً سایت build‌شده) */
export async function createLocalBackend(f?: typeof fetch): Promise<(AdminBackend & { branch: string }) | null> {
  let branch = ''
  try { branch = (await call<{ branch: string }>('/info', {}, f)).branch } catch { return null }
  const backend: AdminBackend & { branch: string } = {
    mode: 'local',
    branch,
    async getText(path: string, at?: string) {
      const q = new URLSearchParams({ path, ...(at ? { at } : {}) })
      return (await call<{ file: { text: string; sha: string } | null }>(`/read?${q}`, {}, f)).file
    },
    async commit(changes: FileChange[], message: string) {
      const r = await call<{ sha: string; pushed: boolean; pushError?: string }>('/commit', { method: 'POST', body: JSON.stringify({ changes, message }) }, f)
      backend.lastPush = { pushed: r.pushed, error: r.pushError }
      return r.sha
    },
    async history(limit = 15): Promise<CommitInfo[]> {
      return (await call<{ items: CommitInfo[] }>('/history', {}, f)).items.slice(0, limit)
    },
    async runFor() { return null }, // بدون توکن، وضعیت Actions در دسترس نیست
  }
  return backend
}
