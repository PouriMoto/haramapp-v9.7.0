/**
 * کلاینت حداقلی GitHub REST برای داشبورد. فقط با توکن fine-grained همین ریپو
 * (Contents: Read and write، Actions: Read-only، Metadata: Read).
 * انتشار = «یک commit اتمیِ چندفایله» (Git Data API) تا برای هر تغییر فقط یک deploy اجرا شود.
 */
export class GithubError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'GithubError'
    this.status = status
  }
}

export interface RepoRef {
  owner: string
  repo: string
  branch: string
}

export interface FileChange {
  path: string
  /** متن UTF-8 */
  text?: string
  /** برای تصویر (base64 بدون پیشوند data:) */
  base64?: string
  delete?: boolean
}

export interface CommitInfo {
  sha: string
  message: string
  date: string
}

export interface RunInfo {
  id: number
  name: string
  status: string // queued | in_progress | completed
  conclusion: string | null // success | failure | cancelled | …
  url: string
  headSha: string
}

/** آنچه داشبورد از «پشتیبان» می‌خواهد: GitHub (با توکن) یا محلی (فقط dev، بدون توکن) */
export interface AdminBackend {
  mode: 'github' | 'local'
  getText(path: string, at?: string): Promise<{ text: string; sha: string } | null>
  commit(changes: FileChange[], message: string): Promise<string>
  history(limit?: number): Promise<CommitInfo[]>
  runFor(sha: string): Promise<RunInfo | null>
  /** فقط محلی: نتیجهٔ push آخرین commit */
  lastPush?: { pushed: boolean; error?: string }
}

type Fetch = typeof fetch

const decodeUtf8 = (b64: string): string => {
  const bin = atob(b64.replace(/\s/g, ''))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

function friendly(status: number, body: string): string {
  if (status === 401) return 'توکن نامعتبر یا منقضی است'
  if (status === 403) return 'دسترسی توکن کافی نیست (Contents: Read and write لازم است) یا سقف درخواست پر شده'
  if (status === 404) return 'ریپو/فایل پیدا نشد یا توکن به این ریپو دسترسی ندارد'
  if (status === 409 || status === 422) return 'تعارض: شاخه در همین فاصله تغییر کرده؛ صفحه را دوباره بارگذاری کنید'
  return `خطای GitHub (${status}) ${body.slice(0, 120)}`
}

export function createGithub(ref: RepoRef, token: string, fetchImpl: Fetch = (...a) => fetch(...a)) {
  const base = `https://api.github.com/repos/${ref.owner}/${ref.repo}`

  async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
    let res: Response
    try {
      res = await fetchImpl(`${base}${path}`, {
        ...init,
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          Authorization: `Bearer ${token}`,
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        },
        cache: 'no-store',
      })
    } catch {
      throw new GithubError(0, 'اتصال به GitHub برقرار نشد')
    }
    if (!res.ok) throw new GithubError(res.status, friendly(res.status, await res.text().catch(() => '')))
    return (await res.json()) as T
  }

  const enc = (p: string) => p.split('/').map(encodeURIComponent).join('/')

  return {
    mode: 'github' as const,
    /** بررسی توکن: ریپو در دسترس و حق نوشتن (push) دارد؟ */
    async check(): Promise<{ fullName: string; canPush: boolean }> {
      const r = await api<{ full_name: string; permissions?: { push?: boolean } }>('')
      return { fullName: r.full_name, canPush: r.permissions?.push === true }
    },

    /** متن فایل در شاخه (یا در ref/commit دلخواه)؛ نبودن فایل = null */
    async getText(path: string, at?: string): Promise<{ text: string; sha: string } | null> {
      try {
        const r = await api<{ content?: string; sha: string; encoding?: string }>(`/contents/${enc(path)}?ref=${encodeURIComponent(at ?? ref.branch)}`)
        if (r.content === undefined || r.encoding !== 'base64') throw new GithubError(422, `فایل بزرگ است یا قالب پشتیبانی‌نشده: ${path}`)
        return { text: decodeUtf8(r.content), sha: r.sha }
      } catch (e) {
        if (e instanceof GithubError && e.status === 404) return null
        throw e
      }
    },

    async headSha(): Promise<string> {
      const r = await api<{ object: { sha: string } }>(`/git/ref/heads/${enc(ref.branch)}`)
      return r.object.sha
    },

    /** commit اتمی چندفایله روی شاخه؛ شناسهٔ commit جدید را برمی‌گرداند */
    async commit(changes: FileChange[], message: string): Promise<string> {
      if (changes.length === 0) throw new GithubError(422, 'تغییری برای انتشار نیست')
      const head = await this.headSha()
      const headCommit = await api<{ tree: { sha: string } }>(`/git/commits/${head}`)
      const entries: { path: string; mode: '100644'; type: 'blob'; sha: string | null }[] = []
      for (const c of changes) {
        if (c.delete) { entries.push({ path: c.path, mode: '100644', type: 'blob', sha: null }); continue }
        const blob = await api<{ sha: string }>('/git/blobs', {
          method: 'POST',
          body: JSON.stringify(c.base64 !== undefined ? { content: c.base64, encoding: 'base64' } : { content: c.text ?? '', encoding: 'utf-8' }),
        })
        entries.push({ path: c.path, mode: '100644', type: 'blob', sha: blob.sha })
      }
      const tree = await api<{ sha: string }>('/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: headCommit.tree.sha, tree: entries }) })
      const commit = await api<{ sha: string }>('/git/commits', { method: 'POST', body: JSON.stringify({ message, tree: tree.sha, parents: [head] }) })
      // بدون force: اگر کسی همزمان push کرده باشد، خطای تعارض می‌دهد و چیزی از دست نمی‌رود
      await api(`/git/refs/heads/${enc(ref.branch)}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }) })
      return commit.sha
    },

    /** آخرین commitهایی که data/ را تغییر داده‌اند */
    async history(limit = 15): Promise<CommitInfo[]> {
      const r = await api<{ sha: string; commit: { message: string; author: { date: string } } }[]>(
        `/commits?sha=${encodeURIComponent(ref.branch)}&path=data&per_page=${limit}`,
      )
      return r.map((c) => ({ sha: c.sha, message: c.commit.message.split('\n')[0], date: c.commit.author.date }))
    },

    /** اجرای workflow مربوط به یک commit (انتشار)؛ هنوز ساخته نشده = null */
    async runFor(sha: string): Promise<RunInfo | null> {
      const r = await api<{ workflow_runs: { id: number; name: string; status: string; conclusion: string | null; html_url: string; head_sha: string }[] }>(
        `/actions/runs?branch=${encodeURIComponent(ref.branch)}&per_page=15`,
      )
      const mine = r.workflow_runs.filter((x) => x.head_sha === sha)
      // برای یک commit چند workflow (مثلاً CI و Deploy) اجرا می‌شود؛ «Deploy» مهم است
      const run = mine.find((x) => x.name === 'Deploy') ?? mine[0]
      return run ? { id: run.id, name: run.name, status: run.status, conclusion: run.conclusion, url: run.html_url, headSha: run.head_sha } : null
    },
  }
}

export type Github = ReturnType<typeof createGithub>
