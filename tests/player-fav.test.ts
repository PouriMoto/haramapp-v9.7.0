import { describe, expect, it } from 'vitest'
import { nextRate, rateLabel, RATES, sanitizeRate } from '../src/features/player/rate'
import { favoriteGroups } from '../src/features/favorites/groups'
import { categoryCounts, inCategory } from '../src/content/selectors'

describe('سرعت پخش', () => {
  it('چرخهٔ ۱ → ۱٫۲۵ → ۱٫۵ → ۱٫۷۵ → ۲ → ۱', () => {
    const seq = [1]
    for (let i = 0; i < 5; i++) seq.push(nextRate(seq[i]))
    expect(seq).toEqual([1, 1.25, 1.5, 1.75, 2, 1])
    expect(RATES).toHaveLength(5)
  })
  it('مقدار نامعتبر به ۱ برمی‌گردد و برچسب فارسی است', () => {
    expect(nextRate(3)).toBe(1)
    expect(sanitizeRate('x')).toBe(1)
    expect(sanitizeRate(1.5)).toBe(1.5)
    expect(sanitizeRate(0.5)).toBe(1)
    expect(rateLabel(2)).toContain('×')
  })
})

describe('علاقه‌مندی به تفکیک نوع', () => {
  const m = {
    prayers: [{ id: 'a' }, { id: 'b' }],
    music: [{ id: 'm1' }],
    videos: [{ id: 'v1' }, { id: 'v2' }],
  } as never
  it('هر نوع جدا؛ شناسهٔ حذف‌شده یا هم‌نام نوع دیگر نادیده', () => {
    const g = favoriteGroups(['prayer:a', 'music:m1', 'video:v2', 'video:gone', 'prayer:m1'], m)
    expect(g.prayer.map((x: { id: string }) => x.id)).toEqual(['a'])
    expect(g.music).toHaveLength(1)
    expect(g.video.map((x: { id: string }) => x.id)).toEqual(['v2'])
  })
})

describe('دستهٔ ویدیو', () => {
  const v = (id: string, categories: string[]) => ({ id, order: 1, pinned: false, addedAt: '', categories })
  it('فیلتر و شمارش', () => {
    const items = [v('a', ['muharram']), v('b', ['other']), v('c', [])]
    const cats = [{ id: 'muharram', title: 'م' }, { id: 'other', title: 'س' }]
    expect(inCategory(items, 'muharram').map((i) => i.id)).toEqual(['a'])
    expect(inCategory(items, 'other').map((i) => i.id)).toEqual(['b', 'c'])
    expect(categoryCounts(items, cats).map((c) => c.count)).toEqual([1, 2])
  })
})
