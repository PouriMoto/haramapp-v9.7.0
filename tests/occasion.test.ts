import { describe, expect, it } from 'vitest'
import { activeOccasions, isActive, occasionCategories } from '../src/content/occasion'
import { sortContent } from '../src/content/selectors'
import type { OccasionDef } from '../src/content/types'

const H = (fm: number, fd: number, tm: number, td: number) => ({ fromMonth: fm, fromDay: fd, toMonth: tm, toDay: td })
const defs: OccasionDef[] = [
  { id: 'qadr', title: 'قدر', category: 'qadr', hijri: H(9, 19, 9, 23), priority: 30 },
  { id: 'ramadan', title: 'رمضان', category: 'ramadan', hijri: H(9, 1, 9, 30), priority: 10 },
  { id: 'muharram', title: 'محرم', category: 'muharram', hijri: H(1, 1, 1, 12), priority: 20 },
  { id: 'fatemiyeh', title: 'فاطمیه', category: 'fatemiyeh', hijri: H(5, 13, 6, 3), priority: 20 },
]
const cats = (d: Date, off = 0) => activeOccasions(defs, d, off).map((o) => o.id)

describe('موتور مناسبت‌ها', () => {
  it('رمضان ۱۴۴۷ و شب‌های قدر (اولویت بالاتر اول)', () => {
    expect(cats(new Date('2026-03-01T12:00:00Z'))).toEqual(['ramadan'])
    expect(cats(new Date('2026-03-10T12:00:00Z'))[0]).toBe('qadr')
  })
  it('محرم و روز عادی', () => {
    expect(cats(new Date('2026-06-20T12:00:00Z'))).toEqual(['muharram'])
    expect(cats(new Date('2026-09-01T12:00:00Z'))).toEqual([])
  })
  it('بازهٔ قمری با گذر از ماه (فاطمیه ۱۳ جمادی‌الاول تا ۳ جمادی‌الثانی)', () => {
    expect(isActive(defs[3], new Date('2026-11-10T12:00:00Z'))).toBe(true)
  })
  it('hijriOffsetDays روز را جابه‌جا می‌کند', () => {
    const d23 = new Date('2026-03-12T12:00:00Z') // ۲۳ رمضان (ام‌القری)
    expect(cats(d23, 0)).toContain('qadr')
    expect(cats(d23, 2)).not.toContain('qadr') // با +۲ می‌شود ۲۵
    expect(cats(new Date('2026-03-13T12:00:00Z'), -1)).toContain('qadr') // ۲۴ با -۱ → ۲۳
  })
  it('ranges سالِ جاری جایگزین قاعدهٔ قمری همان سال می‌شود، سال‌های دیگر نه', () => {
    const o: OccasionDef = { id: 'x', title: 'x', hijri: H(9, 1, 9, 30), ranges: [{ from: '2026-12-01', to: '2026-12-03' }], priority: 0 }
    expect(isActive(o, new Date(2026, 11, 2, 12))).toBe(true)
    expect(isActive(o, new Date(2026, 2, 5, 12))).toBe(false) // رمضان ۲۰۲۶ ولی range برای 2026 تعریف است
    expect(isActive(o, new Date(2027, 1, 10, 12))).toBe(true) // رمضان ۲۰۲۷ (بدون range آن سال) → قاعدهٔ قمری
  })
  it('دسته‌های مناسبت‌های فعال و مرتب‌سازی مناسبتی', () => {
    expect(occasionCategories(activeOccasions(defs, new Date('2026-06-20T12:00:00Z')))).toEqual(['muharram'])
    const mk = (id: string, categories: string[], pinned = false, order = 5) => ({ id, order, pinned, addedAt: '', categories })
    const items = [mk('a', ['other']), mk('b', ['muharram']), mk('c', ['other'], true)]
    expect(sortContent(items).map((i) => i.id)).toEqual(['c', 'a', 'b'])
    expect(sortContent(items, ['muharram']).map((i) => i.id)).toEqual(['c', 'b', 'a'])
  })
})
