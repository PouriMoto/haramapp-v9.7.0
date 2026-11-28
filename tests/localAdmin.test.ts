import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyChanges, createLocalAdminMiddleware, isLocalRequest, localRead, safeDataPath } from '../scripts/lib/localAdmin.mjs'
import { createLocalBackend } from '../src/admin/local'

describe('safeDataPath', () => {
  it('فقط data/ با پسوند مجاز', () => {
    expect(safeDataPath('data/content.json')).toBe('data/content.json')
    expect(safeDataPath('data\\prayers\\a.md')).toBe('data/prayers/a.md')
    expect(safeDataPath('data/banners/img-1.webp')).toBe('data/banners/img-1.webp')
  })
  it('رد: خروج از data، مطلق، پسوند ناموجاز، خالی', () => {
    for (const p of ['../x.json', 'data/../.env.json', 'data/../../etc/passwd.json', '/etc/passwd', 'package.json', 'src/a.json', 'data/run.mjs', 'data/', '', 'data//a.json', 'data/a b.json']) {
      expect(() => safeDataPath(p), p).toThrow()
    }
  })
})

describe('applyChanges', () => {
  let root = ''
  beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'haram-la-')); await mkdir(join(root, 'data'), { recursive: true }); await writeFile(join(root, 'data/a.json'), '{"v":1}') })
  afterEach(async () => { await rm(root, { recursive: true, force: true }) })

  it('نوشتن، تصویر base64 و حذف', async () => {
    await writeFile(join(root, 'data/old.md'), 'x')
    await applyChanges(root, [
      { path: 'data/a.json', text: '{"v":2}' },
      { path: 'data/banners/i.webp', base64: Buffer.from('IMG').toString('base64') },
      { path: 'data/old.md', delete: true },
    ])
    expect(await readFile(join(root, 'data/a.json'), 'utf8')).toBe('{"v":2}')
    expect((await readFile(join(root, 'data/banners/i.webp'))).toString()).toBe('IMG')
    await expect(readFile(join(root, 'data/old.md'))).rejects.toThrow()
  })
  it('undo همه چیز را برمی‌گرداند', async () => {
    const r = await applyChanges(root, [{ path: 'data/a.json', text: 'NEW' }, { path: 'data/new.md', text: 'n' }])
    await r.undo()
    expect(await readFile(join(root, 'data/a.json'), 'utf8')).toBe('{"v":1}')
    await expect(readFile(join(root, 'data/new.md'))).rejects.toThrow()
  })
  it('مسیر بد یا محتوای ناقص = خطا و هیچ فایلی تغییر نمی‌کند', async () => {
    await expect(applyChanges(root, [{ path: 'data/a.json', text: 'X' }, { path: '../evil.json', text: 'e' }])).rejects.toThrow()
    await expect(applyChanges(root, [{ path: 'data/a.json', text: 'X' }, { path: 'data/b.json' }])).rejects.toThrow()
    expect(await readFile(join(root, 'data/a.json'), 'utf8')).toBe('{"v":1}')
    await expect(applyChanges(root, [])).rejects.toThrow()
  })
  it('localRead: فایل موجود و ناموجود', async () => {
    expect((await localRead(root, 'data/a.json'))?.text).toBe('{"v":1}')
    expect(await localRead(root, 'data/none.json')).toBeNull()
    await expect(localRead(root, 'data/a.json', 'not;a;sha')).rejects.toThrow()
  })
})

describe('isLocalRequest / middleware', () => {
  const req = (o: { ip?: string; host?: string; hdr?: string | undefined }) => ({ headers: { host: o.host ?? 'localhost:5173', ...(o.hdr === undefined ? {} : { 'x-local-admin': o.hdr }) }, socket: { remoteAddress: o.ip ?? '127.0.0.1' } })
  it('فقط loopback + Host محلی + هدر', () => {
    expect(isLocalRequest(req({ hdr: '1' }))).toBe(true)
    expect(isLocalRequest(req({ hdr: '1', ip: '::1', host: '127.0.0.1:5173' }))).toBe(true)
    expect(isLocalRequest(req({}))).toBe(false)
    expect(isLocalRequest(req({ hdr: '1', ip: '192.168.1.5' }))).toBe(false)
    expect(isLocalRequest(req({ hdr: '1', host: 'evil.com' }))).toBe(false)
  })
  it('درخواست غیرمحلی ۴۰۳ می‌گیرد', async () => {
    const mw = createLocalAdminMiddleware('/nonexistent') as unknown as (r: unknown, s: unknown) => Promise<void>
    const res = { statusCode: 0, body: '', setHeader() { /* noop */ }, end(b: string) { this.body = b } }
    await mw({ ...req({}), url: '/info', method: 'GET' }, res)
    expect(res.statusCode).toBe(403)
  })
})

describe('createLocalBackend (کلاینت)', () => {
  it('اگر سرور محلی نباشد null', async () => {
    expect(await createLocalBackend(vi.fn(async () => { throw new Error('x') }) as unknown as typeof fetch)).toBeNull()
    expect(await createLocalBackend(vi.fn(async () => new Response('<html>', { status: 404 })) as unknown as typeof fetch)).toBeNull()
  })
  it('commit نتیجهٔ push را نگه می‌دارد و هدر امنیتی می‌فرستد', async () => {
    const f = vi.fn(async (url: string) => new Response(JSON.stringify(url.includes('/info') ? { ok: true, branch: 'main' } : { sha: 'abc1234', pushed: false, pushError: 'no net' })))
    const b = await createLocalBackend(f as unknown as typeof fetch)
    expect(b?.mode).toBe('local')
    expect(await b?.commit([{ path: 'data/a.json', text: '{}' }], 'm')).toBe('abc1234')
    expect(b?.lastPush).toEqual({ pushed: false, error: 'no net' })
    const calls = f.mock.calls as unknown as [string, RequestInit][]
    expect((calls[1][1].headers as Record<string, string>)['X-Local-Admin']).toBe('1')
    expect(calls[1][0]).toBe('/__local-admin/commit')
  })
})
