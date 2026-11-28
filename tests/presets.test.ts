import { describe, expect, it, vi } from 'vitest'
import { normalizePresets } from '../scripts/lib/presetsCore.mjs'
import { createModeration } from '../src/admin/moderation'
import { createMockApi } from '../src/data/adapters/mock'
import { ValidationError } from '../src/data/errors'

describe('normalizePresets', () => {
  it('معتبر', () => {
    const r = normalizePresets({ presets: [{ id: 'a', text: 'سلام ❤️' }, { id: 'b-2', text: 'دلم تنگ شده' }, { id: 'c', text: 'شکرت' }] })
    expect(r.errors).toEqual([])
    expect(r.presets).toHaveLength(3)
  })
  it('خطاها: id بد، تکراری، متن خالی/بلند، ساختار', () => {
    const r = normalizePresets({ presets: [{ id: 'A b', text: 'x' }, { id: 'a', text: 'x' }, { id: 'a', text: 'y' }, { id: 'c', text: '' }, { id: 'd', text: 'x'.repeat(121) }] })
    expect(r.errors).toHaveLength(4)
    expect(normalizePresets({}).errors).toHaveLength(1)
    expect(normalizePresets({ presets: Array.from({ length: 9 }, (_, i) => ({ id: `p${i}`, text: 't' })) }).errors.join()).toContain('حداکثر')
  })
  it('data/presets.json واقعی معتبر است و هر جمله حداقل ۳ کلمه', async () => {
    const { readFileSync } = await import('node:fs')
    const r = normalizePresets(JSON.parse(readFileSync('data/presets.json', 'utf8')))
    expect(r.errors).toEqual([])
    for (const p of r.presets) expect(p.text.split(/\s+/).filter((w) => /[\p{L}]/u.test(w)).length >= 3).toBe(true)
  })
})

describe('mock API: جملهٔ آماده', () => {
  it('فوراً منتشر می‌شود؛ متن آزاد نه', async () => {
    const api = createMockApi({ latencyMs: 0 })
    expect(await api.postMessage({ message: '', presetId: 'salam', name: 'مریم' })).toEqual({ status: 'published' })
    const first = (await api.listMessages({ limit: 1 })).items[0]
    expect(first).toMatchObject({ name: 'مریم', kind: 'preset' })
    const before = (await api.getStats()).messages
    expect(await api.postMessage({ message: 'سلام آقا' })).toEqual({ status: 'pending' })
    expect((await api.getStats()).messages).toBe(before)
  })
  it('شناسهٔ نامعتبر و متن کوتاه رد می‌شود', async () => {
    const api = createMockApi({ latencyMs: 0 })
    await expect(api.postMessage({ message: '', presetId: 'zzz' })).rejects.toThrow()
    await expect(api.postMessage({ message: 'a' })).rejects.toBeInstanceOf(ValidationError)
  })
})

describe('moderation client', () => {
  it('POST با text/plain و توکن در بدنه (نه URL)', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ ok: true, data: { items: [], total: 0 } })))
    const m = createModeration('https://script.example/exec', 'tok', f as unknown as typeof fetch)
    await m.list()
    await m.approve('id1')
    const calls = f.mock.calls as unknown as [string, RequestInit][]
    expect(calls[0][0]).toBe('https://script.example/exec')
    expect(calls[0][1].method).toBe('POST')
    expect((calls[0][1].headers as Record<string, string>)['Content-Type']).toContain('text/plain')
    expect(JSON.parse(String(calls[1][1].body))).toEqual({ action: 'adminModerate', adminToken: 'tok', id: 'id1', decision: 'approve' })
  })
  it('خطای سرور پیام فارسی می‌دهد؛ URL خالی خطا', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ ok: false, error: 'مجاز نیست' })))
    await expect(createModeration('https://x/exec', 't', f as unknown as typeof fetch).list()).rejects.toThrow('مجاز نیست')
    await expect(createModeration('', 't').list()).rejects.toThrow('site.json')
  })
})
