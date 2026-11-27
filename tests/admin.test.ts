import { describe, expect, it } from 'vitest'
import { createGithub, GithubError } from '../src/admin/github'
import { cleanItem, getPath, linesToList, listOf, moveItem, replaceList, serialize, setPath, validateContentDoc } from '../src/admin/model'
import { decryptToken, encryptToken } from '../src/admin/vault'

const ref = { owner: 'o', repo: 'r', branch: 'main' }
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status })

describe('vault', () => {
  it('رمزگذاری و بازگشایی با رمز درست', async () => {
    const blob = await encryptToken('github_pat_secret', 'password-123')
    expect(JSON.stringify(blob)).not.toContain('github_pat_secret')
    expect(await decryptToken(blob, 'password-123')).toBe('github_pat_secret')
  })
  it('رمز اشتباه خطا می‌دهد', async () => {
    const blob = await encryptToken('tok', 'right-password')
    await expect(decryptToken(blob, 'wrong-password')).rejects.toThrow('رمز اشتباه')
  })
})

describe('model', () => {
  it('cleanItem مقدارهای خالی را حذف و false مجاز را نگه می‌دارد', () => {
    expect(cleanItem({ a: ' ', b: 'x ', c: [], d: false, enabled: false, e: { f: '' } })).toEqual({ b: 'x', enabled: false })
  })
  it('setPath/getPath تغییرناپذیر', () => {
    const o = { a: 1 }
    const n = setPath(o, 'bank.card', '1')
    expect(o).toEqual({ a: 1 })
    expect(getPath(n, 'bank.card')).toBe('1')
  })
  it('moveItem و replaceList', () => {
    expect(moveItem([1, 2, 3], 0, 1)).toEqual([2, 1, 3])
    expect(moveItem([1, 2, 3], 0, -1)).toEqual([1, 2, 3])
    expect(listOf(replaceList({}, 'x', [{ id: 'a' }]), 'x')).toHaveLength(1)
    expect(serialize({ a: 1 }).endsWith('\n')).toBe(true)
    expect(linesToList(' a \n\n b ')).toEqual(['a', 'b'])
  })
  it('validateContentDoc خطاهای رایج را می‌گیرد', () => {
    const bad = validateContentDoc({
      prayers: [{ id: 'A B', title: '' }, { id: 'p1', title: 'x', audio: 'http://evil.com/a.mp3' }],
      music: [{ title: 'n', src: 'https://file.erfan.ir/a.mp3' }],
      videos: [{ title: 'v', aparat: '!!' }],
      banners: [{ id: 'b1', title: 't', href: 'javascript:alert(1)' }],
    })
    expect(bad.length).toBeGreaterThanOrEqual(4)
    expect(validateContentDoc({ prayers: [{ id: 'ok', title: 'دعا' }] })).toEqual([])
  })
})

describe('model: مناسبت و هدف بنر (همان هستهٔ build)', () => {
  const base = { prayers: [{ id: 'p1', title: 'دعا' }], categories: [{ id: 'other', title: 'سایر' }] }
  it('هدف و مناسبت معتبر', () => {
    expect(validateContentDoc({
      ...base,
      occasions: [{ id: 'o1', title: 'م', hijri: { fromMonth: 2, fromDay: 27, toDay: 30 } }],
      banners: [{ id: 'b1', title: 't', target: { type: 'cause', id: 'c1' } }, { id: 'b2', title: 't', target: { type: 'occasion', id: 'o1' } }],
    }, { causeIds: ['c1'] })).toEqual([])
  })
  it('خطاها: کارت ناموجود، مناسبت بی‌بازه، آفست بد، دستهٔ ناشناخته ویدیو', () => {
    const e = validateContentDoc({
      ...base, hijriOffsetDays: 5,
      occasions: [{ id: 'o1', title: 'م' }],
      videos: [{ title: 'v', aparat: 'ckn3o4e', categories: ['zzz'] }],
      banners: [{ id: 'b1', title: 't', target: { type: 'cause', id: 'nope' } }],
    }, { causeIds: ['c1'] }).join('|')
    expect(e).toContain('حداقل یک بازهٔ قمری یا میلادی')
    expect(e).toContain('-۲ و ۲')
    expect(e).toContain('دستهٔ ناشناخته (zzz)')
    expect(e).toContain('کارت همیاریِ هدف پیدا نشد (nope)')
  })
})

describe('github', () => {
  it('commit اتمی: blob → tree → commit → ref (بدون force)', async () => {
    const calls: { url: string; method: string; body?: string }[] = []
    const fake = (async (url: string, init: RequestInit = {}) => {
      calls.push({ url, method: init.method ?? 'GET', body: init.body as string | undefined })
      if (url.endsWith('/git/ref/heads/main')) return json({ object: { sha: 'H' } })
      if (url.endsWith('/git/commits/H')) return json({ tree: { sha: 'T0' } })
      if (url.endsWith('/git/blobs')) return json({ sha: 'B' })
      if (url.endsWith('/git/trees')) return json({ sha: 'T1' })
      if (url.endsWith('/git/commits')) return json({ sha: 'C' })
      return json({})
    }) as unknown as typeof fetch
    const gh = createGithub(ref, 'tok', fake)
    const sha = await gh.commit([{ path: 'data/a.json', text: '{}' }, { path: 'data/old.md', delete: true }], 'm')
    expect(sha).toBe('C')
    const patch = calls.at(-1)!
    expect(patch.method).toBe('PATCH')
    expect(JSON.parse(patch.body!).force).toBe(false)
    const tree = JSON.parse(calls.find((c) => c.url.endsWith('/git/trees'))!.body!)
    expect(tree.tree.find((e: { path: string }) => e.path === 'data/old.md').sha).toBeNull()
  })
  it('getText: 404 → null و کدگشایی UTF-8', async () => {
    const text = 'سلام'
    const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(text)))
    const gh = createGithub(ref, 't', (async (u: string) => (u.includes('missing') ? json({}, 404) : json({ content: b64, sha: 's', encoding: 'base64' }))) as unknown as typeof fetch)
    expect(await gh.getText('missing.md')).toBeNull()
    expect((await gh.getText('a.md'))?.text).toBe(text)
  })
  it('runFor: workflow «Deploy» را ترجیح می‌دهد؛ خطای 401 پیام فارسی', async () => {
    const run = (name: string, id: number) => ({ id, name, status: 'completed', conclusion: 'success', html_url: 'u', head_sha: 'S' })
    const gh = createGithub(ref, 't', (async () => json({ workflow_runs: [run('CI', 1), run('Deploy', 2)] })) as unknown as typeof fetch)
    expect((await gh.runFor('S'))?.name).toBe('Deploy')
    expect(await gh.runFor('none')).toBeNull()
    const bad = createGithub(ref, 't', (async () => json({}, 401)) as unknown as typeof fetch)
    await expect(bad.check()).rejects.toBeInstanceOf(GithubError)
  })
})
