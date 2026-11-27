import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
// @ts-expect-error اسکریپت JS خالص
import { normalizeChannel, validateCauses } from '../scripts/lib/validateCauses.mjs'

const base = { id: 'a-1', title: 'مسجد نمونه', accounts: [] }
async function run(causes: unknown[], files: Record<string, string> = {}) {
  const d = await mkdtemp(join(tmpdir(), 'causes-'))
  await mkdir(join(d, 'causes'), { recursive: true })
  for (const [n, c] of Object.entries(files)) await writeFile(join(d, 'causes', n), c)
  return validateCauses(d, { version: 1, causes })
}

describe('validateCauses', () => {
  it('کارت ساده معتبر است و فیلدهای پیش‌فرض می‌گیرد', async () => {
    const r = await run([base])
    expect(r.errors).toEqual([])
    expect(r.file.causes[0]).toMatchObject({ id: 'a-1', title: 'مسجد نمونه', order: 1, online: false, accounts: [] })
  })
  it('id تکراری، عنوان خالی و bank نامعتبر خطا می‌دهند', async () => {
    const r = await run([base, base, { id: 'b', title: '', accounts: [] }, { ...base, id: 'c', bank: { cardNumber: '123' } }])
    expect(r.errors.join('\n')).toMatch(/تکراری/)
    expect(r.errors.join('\n')).toMatch(/«title»/)
    expect(r.errors.join('\n')).toMatch(/۱۶ رقم/)
  })
  it('معرفی: بیش از حد مجاز خطا، نزدیک ۳۰۰ کلمه بدون خطا', async () => {
    const w = (n: number) => Array.from({ length: n }, () => 'کلمه').join(' ')
    expect((await run([{ ...base, intro: w(300) }])).errors).toEqual([])
    expect((await run([{ ...base, intro: w(340) }])).warnings).toHaveLength(1)
    expect((await run([{ ...base, intro: w(501) }])).errors).toHaveLength(1)
  })
  it('تصویر: لینک https یا فایل داخل data/causes؛ فایل ناموجود خطا', async () => {
    expect((await run([{ ...base, image: 'https://x.ir/a.jpg' }])).file.causes[0].image).toBe('https://x.ir/a.jpg')
    const ok = await run([{ ...base, image: 'a.webp' }], { 'a.webp': 'x' })
    expect(ok.file.causes[0].image).toBe('causes/a.webp')
    expect(ok.copies).toHaveLength(1)
    expect((await run([{ ...base, image: 'nope.webp' }])).errors).toHaveLength(1)
    expect((await run([{ ...base, image: 'http://x.ir/a.jpg' }])).errors).toHaveLength(1)
  })
  it('payLink فقط https', async () => {
    expect((await run([{ ...base, payLink: 'https://pay.ir/x' }])).errors).toEqual([])
    expect((await run([{ ...base, payLink: 'javascript:alert(1)' }])).errors).toHaveLength(1)
  })
  it('کانال‌ها به لینک رسمی نرمال می‌شوند؛ کلید ناشناس خطا', async () => {
    const r = await run([{ ...base, channels: { telegram: '@my_group', bale: 'myhoseini', whatsapp: '۰۹۱۲۳۴۵۶۷۸۹', website: 'example.ir' } }])
    expect(r.errors).toEqual([])
    expect(r.file.causes[0].channels).toEqual({
      telegram: 'https://t.me/my_group', bale: 'https://ble.ir/myhoseini', whatsapp: 'https://wa.me/989123456789', website: 'https://example.ir',
    })
    expect((await run([{ ...base, channels: { fax: '1' } }])).errors).toHaveLength(1)
    expect(normalizeChannel('telegram', 'ab')).toBeNull()
  })
  it('enabled:false و order حفظ می‌شوند', async () => {
    const r = await run([{ ...base, enabled: false, order: 7 }])
    expect(r.file.causes[0]).toMatchObject({ enabled: false, order: 7 })
  })
})
