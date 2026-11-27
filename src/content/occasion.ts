import type { OccasionDef } from './types'

/** ماه و روز قمری (ام‌القری) بعد از `offsetDays` جابه‌جایی. با تقویم رسمی ایران ممکن است ±۱ تا ۲ روز فرق کند؛ در data/content.json با hijriOffsetDays یا بازهٔ میلادیِ همان سال (ranges) اصلاح می‌شود. */
export function hijriParts(d: Date, offsetDays = 0): { m: number; d: number } | null {
  try {
    const shifted = new Date(d.getTime() + offsetDays * 86_400_000)
    const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { month: 'numeric', day: 'numeric' }).formatToParts(shifted)
    const m = Number(parts.find((p) => p.type === 'month')?.value)
    const day = Number(parts.find((p) => p.type === 'day')?.value)
    return Number.isFinite(m) && Number.isFinite(day) ? { m, d: day } : null
  } catch { return null }
}

/** تاریخ محلی دستگاه به‌صورت YYYY-MM-DD (برای مقایسهٔ رشته‌ای با ranges) */
export function isoLocalDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function inHijri(h: { m: number; d: number }, r: NonNullable<OccasionDef['hijri']>): boolean {
  const key = h.m * 100 + h.d
  const from = r.fromMonth * 100 + r.fromDay
  const to = r.toMonth * 100 + r.toDay
  return from <= to ? key >= from && key <= to : key >= from || key <= to
}

/** آیا مناسبت اکنون فعال است؟ اگر برای «سال میلادی جاری» ranges تعریف شده باشد فقط همان‌ها ملاک است (override سالانه). */
export function isActive(o: OccasionDef, now: Date, offsetDays = 0): boolean {
  const today = isoLocalDay(now)
  const year = today.slice(0, 4)
  const yearRanges = (o.ranges ?? []).filter((r) => r.from.startsWith(year) || r.to.startsWith(year))
  if (yearRanges.length > 0) return yearRanges.some((r) => r.from <= today && today <= r.to)
  if (!o.hijri) return false
  const h = hijriParts(now, offsetDays)
  return h ? inHijri(h, o.hijri) : false
}

/** مناسبت‌های فعال، پراولویت‌تر اول */
export function activeOccasions(defs: readonly OccasionDef[], now: Date = new Date(), offsetDays = 0): OccasionDef[] {
  return defs.filter((o) => isActive(o, now, offsetDays)).sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
}

/** دسته‌های مناسبت‌های فعال (برای مرتب‌سازی «مناسبتی»: آیتم‌های این دسته‌ها جلوتر) */
export function occasionCategories(active: readonly OccasionDef[]): string[] {
  return [...new Set(active.flatMap((o) => (o.category ? [o.category] : [])))]
}
