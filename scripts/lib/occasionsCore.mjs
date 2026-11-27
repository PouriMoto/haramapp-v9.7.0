// هستهٔ خالص «مناسبت‌ها» و «هدف بنر» (بدون node:fs) — مشترک بین build (buildContent.mjs) و داشبورد (src/admin/model.ts).
// مناسبت = {id,title,text?,category?, hijri?{fromMonth,fromDay,toMonth?,toDay}, ranges?[{from,to}], priority?, enabled?}
//  - hijri: بازهٔ ماه/روز قمری (گذر از سال/ماه مجاز: from > to یعنی از پایان ماه تا ابتدای ماه بعد).
//  - ranges: بازهٔ میلادی «ویژهٔ همان سال»؛ اگر برای سال جاری range تعریف شده باشد، فقط آن‌ها ملاک‌اند (جایگزین hijri برای آن سال).
const ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi

/** صفحه‌های قابل‌انتخاب برای هدف بنر (مسیر داخلی) */
export const TARGET_PAGES = {
  home: { path: '/', label: 'صفحهٔ اصلی' },
  prayers: { path: '/prayers', label: 'همهٔ دعاها' },
  music: { path: '/music', label: 'همهٔ نواها' },
  videos: { path: '/videos', label: 'ویدیوها' },
  help: { path: '/help', label: 'همیاری' },
  zikr: { path: '/zikr', label: 'ذکرشمار' },
  messages: { path: '/messages', label: 'درد و دل' },
}
export const TARGET_TYPES = ['page', 'prayer', 'cause', 'occasion']

const dateOk = (d) => typeof d === 'string' && DATE_RE.test(d) && !Number.isNaN(Date.parse(d))

export function normalizeOccasions(raw, { catIds }) {
  const errors = []
  const list = []
  const seen = new Set()
  if (raw === undefined) return { list, errors }
  if (!Array.isArray(raw)) return { list, errors: ['occasions: باید فهرست [ ... ] باشد'] }
  raw.forEach((o, i) => {
    const w = `مناسبت ${i + 1}${o && o.title ? ` «${o.title}»` : ''}`
    if (!o || typeof o !== 'object') { errors.push(`${w}: ساختار نامعتبر`); return }
    if (!ID_RE.test(o.id ?? '')) { errors.push(`${w}: شناسه لازم است (انگلیسی کوچک، عدد، - و _)`); return }
    if (seen.has(o.id)) { errors.push(`${w}: شناسهٔ تکراری (${o.id})`); return }
    seen.add(o.id)
    if (!o.title || typeof o.title !== 'string') { errors.push(`${w}: عنوان لازم است`); return }
    if (o.enabled === false) return
    const before = errors.length
    if (o.category !== undefined && !catIds.has(o.category)) errors.push(`${w}: دستهٔ ناشناخته (${o.category})`)
    let hijri
    if (o.hijri !== undefined) {
      const h = o.hijri
      const toMonth = h?.toMonth ?? h?.fromMonth
      if (!h || !int(h.fromMonth, 1, 12) || !int(h.fromDay, 1, 30) || !int(toMonth, 1, 12) || !int(h.toDay, 1, 30)) {
        errors.push(`${w}: بازهٔ قمری نامعتبر (ماه ۱ تا ۱۲، روز ۱ تا ۳۰؛ «تا ماه» اگر خالی باشد همان ماه شروع است)`)
      } else hijri = { fromMonth: h.fromMonth, fromDay: h.fromDay, toMonth, toDay: h.toDay }
    }
    let ranges
    if (o.ranges !== undefined) {
      if (!Array.isArray(o.ranges) || o.ranges.some((r) => !r || !dateOk(r.from) || !dateOk(r.to) || r.from > r.to)) {
        errors.push(`${w}: بازهٔ میلادی نامعتبر (قالب 2026-12-01 تا 2026-12-10 و ابتدا ≤ انتها)`)
      } else if (o.ranges.length) ranges = o.ranges.map((r) => ({ from: r.from, to: r.to }))
    }
    if (!hijri && !ranges && errors.length === before) errors.push(`${w}: حداقل یک بازهٔ قمری یا میلادی لازم است`)
    if (o.text !== undefined && typeof o.text !== 'string') errors.push(`${w}: متن باید رشته باشد`)
    if (errors.length > before) return
    list.push({
      id: o.id, title: String(o.title).slice(0, 80), ...(o.text ? { text: String(o.text).slice(0, 160) } : {}),
      ...(o.category ? { category: o.category } : {}), ...(hijri ? { hijri } : {}), ...(ranges ? { ranges } : {}),
      priority: Number.isFinite(o.priority) ? o.priority : 0,
    })
  })
  return { list, errors }
}

/**
 * target = {type:'page'|'prayer'|'cause'|'occasion', id}  →  { href } یا { error }
 * ctx: { prayerIds:Set, causeIds:Set|null, occasions:[{id,category?}] }
 */
export function normalizeTarget(t, ctx) {
  if (!t || typeof t !== 'object' || !TARGET_TYPES.includes(t.type)) return { error: 'هدف بنر نامعتبر است (page/prayer/cause/occasion)' }
  const id = typeof t.id === 'string' ? t.id : ''
  if (t.type === 'page') return TARGET_PAGES[id] ? { href: TARGET_PAGES[id].path } : { error: `صفحهٔ هدف ناشناخته (${id})` }
  if (t.type === 'prayer') return ctx.prayerIds.has(id) ? { href: `/prayers/${id}` } : { error: `دعای هدف پیدا نشد (${id})` }
  if (t.type === 'cause') {
    if (!ctx.causeIds) return { error: 'کارت همیاری هدف: data/causes.json خوانده نشد' }
    return ctx.causeIds.has(id) ? { href: `/help/${id}` } : { error: `کارت همیاریِ هدف پیدا نشد (${id})` }
  }
  const o = ctx.occasions.find((x) => x.id === id)
  if (!o) return { error: `مناسبت هدف پیدا نشد (${id})` }
  return { href: o.category ? `/?cat=${o.category}` : '/' }
}
