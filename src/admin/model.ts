/**
 * منطق خالص داشبورد (بدون React/شبکه؛ قابل تست): کار با اسناد JSON، پاک‌سازی، جابه‌جایی و اعتبارسنجی.
 * قواعد محتوا آینهٔ scripts/lib/buildContent.mjs است؛ قواعد کارت‌های همیاری مستقیماً از هستهٔ مشترک
 * scripts/lib/causesCore.mjs می‌آید. build روی GitHub همچنان داور نهایی است (نشست ۴: یکی‌سازی کامل).
 */
import { normalizeOccasions, normalizeTarget } from '../../scripts/lib/occasionsCore.mjs'

export type Kind = 'prayers' | 'music' | 'videos' | 'banners' | 'causes' | 'categories' | 'occasions'
export type Item = Record<string, unknown>
export type Doc = Record<string, unknown>

export const DEFAULT_CATEGORIES = [
  { id: 'fatemiyeh', title: 'فاطمیه' },
  { id: 'muharram', title: 'محرم' },
  { id: 'ramadan', title: 'ماه رمضان' },
  { id: 'qadr', title: 'شب‌های قدر' },
  { id: 'other', title: 'سایر' },
]

const ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/
const HASH_RE = /^[A-Za-z0-9]{3,16}$/
const IMG_FILE = /^[\w.-]+\.(webp|jpg|jpeg|png)$/i
const DEFAULT_HOSTS = ['file.erfan.ir', 'kashoob.com']

export const serialize = (doc: unknown): string => JSON.stringify(doc, null, 2) + '\n'

export function getPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj
  for (const k of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[k]
  }
  return cur
}

/** نسخهٔ جدید با مقدار تازه در مسیر (مثلاً 'bank.cardNumber')؛ ورودی تغییر نمی‌کند */
export function setPath(obj: Item, path: string, value: unknown): Item {
  const [head, ...rest] = path.split('.')
  if (rest.length === 0) return { ...obj, [head]: value }
  const child = obj[head]
  const next = child !== null && typeof child === 'object' && !Array.isArray(child) ? (child as Item) : {}
  return { ...obj, [head]: setPath(next, rest.join('.'), value) }
}

/** مقدارهای خالی (رشتهٔ خالی، آرایه/شیء خالی، undefined) حذف می‌شوند؛ false فقط برای کلیدهای keepFalse می‌ماند */
export function cleanItem(item: Item, keepFalse: readonly string[] = ['enabled', 'online']): Item {
  const out: Item = {}
  for (const [k, v] of Object.entries(item)) {
    if (v === undefined || v === null) continue
    if (typeof v === 'string') { const t = v.trim(); if (t) out[k] = t; continue }
    if (typeof v === 'boolean') { if (v || keepFalse.includes(k)) out[k] = v; continue }
    if (Array.isArray(v)) {
      const arr = v.map((x) => (x !== null && typeof x === 'object' && !Array.isArray(x) ? cleanItem(x as Item, keepFalse) : x)).filter((x) => !(x !== null && typeof x === 'object' && Object.keys(x as object).length === 0))
      if (arr.length) out[k] = arr
      continue
    }
    if (typeof v === 'object') { const o = cleanItem(v as Item, keepFalse); if (Object.keys(o).length) out[k] = o; continue }
    out[k] = v
  }
  return out
}

export function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
}

export function moveItem<T>(arr: T[], index: number, dir: -1 | 1): T[] {
  const j = index + dir
  if (index < 0 || index >= arr.length || j < 0 || j >= arr.length) return arr
  const next = [...arr]
  ;[next[index], next[j]] = [next[j], next[index]]
  return next
}

export const listOf = (doc: Doc | null, key: string): Item[] => (doc && Array.isArray(doc[key]) ? (doc[key] as Item[]) : [])

export function replaceList(doc: Doc, key: string, list: Item[]): Doc {
  return { ...doc, [key]: list }
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const httpsOk = (u: string): boolean => { try { const x = new URL(u); return x.protocol === 'https:' && !x.username && !x.password } catch { return false } }
const hostOk = (u: string, hosts: string[]): boolean => {
  try {
    const x = new URL(u)
    return x.protocol === 'https:' && !x.username && !x.password && hosts.some((h) => x.hostname === h || x.hostname.endsWith(`.${h}`))
  } catch { return false }
}
const safeHref = (h: string): boolean => /^https:\/\/[^\s]+$/.test(h) || /^\/(?!\/)[^\s]*$/.test(h)
const dateOk = (d: unknown): boolean => d === undefined || d === '' || (typeof d === 'string' && !Number.isNaN(Date.parse(d)))

/** خطاهای فهرست‌شدهٔ کل content.json (فارسی، با نام آیتم) */
export function validateContentDoc(doc: Doc, opts: { causeIds?: readonly string[] } = {}): string[] {
  const errors: string[] = []
  const hosts = (Array.isArray(doc.allowedHosts) ? (doc.allowedHosts as unknown[]) : DEFAULT_HOSTS).map((h) => String(h).trim().toLowerCase()).filter(Boolean)
  const catIds = new Set((Array.isArray(doc.categories) ? (doc.categories as Item[]).map((c) => str(c.id)) : DEFAULT_CATEGORIES.map((c) => c.id)))
  const seen = new Set<string>()
  const tag = (k: Kind, i: number, it: Item) => `${{ prayers: 'دعا', music: 'نوا', videos: 'ویدیو', banners: 'بنر', causes: 'کارت', categories: 'دسته', occasions: 'مناسبت' }[k]} ${i + 1}${str(it.title) ? ` «${str(it.title)}»` : ''}`
  const claim = (where: string, key: string) => { if (seen.has(key)) errors.push(`${where}: شناسهٔ تکراری`); seen.add(key) }
  const cats = (where: string, it: Item) => {
    const l = Array.isArray(it.categories) ? (it.categories as string[]) : []
    const bad = l.filter((c) => !catIds.has(c))
    if (bad.length) errors.push(`${where}: دستهٔ ناشناخته (${bad.join('، ')})`)
  }

  listOf(doc, 'prayers').forEach((p, i) => {
    const w = tag('prayers', i, p)
    if (!str(p.title)) errors.push(`${w}: عنوان لازم است`)
    if (!ID_RE.test(str(p.id))) errors.push(`${w}: شناسه (فقط حروف انگلیسی کوچک، عدد، - و _)`)
    else claim(w, `prayer:${str(p.id)}`)
    if (p.audio !== undefined && !hostOk(str(p.audio), hosts)) errors.push(`${w}: لینک صوت باید https از سایت‌های مجاز باشد`)
    cats(w, p)
  })
  listOf(doc, 'music').forEach((m, i) => {
    const w = tag('music', i, m)
    if (!str(m.title)) errors.push(`${w}: عنوان لازم است`)
    if (!hostOk(str(m.src), hosts)) errors.push(`${w}: لینک صوت باید https از سایت‌های مجاز باشد`)
    if (m.cover !== undefined && !httpsOk(str(m.cover))) errors.push(`${w}: تصویر کاور باید لینک https باشد`)
    if (m.id !== undefined) { if (!ID_RE.test(str(m.id))) errors.push(`${w}: شناسه نامعتبر`); else claim(w, `music:${str(m.id)}`) }
    cats(w, m)
  })
  listOf(doc, 'videos').forEach((v, i) => {
    const w = tag('videos', i, v)
    if (!str(v.title)) errors.push(`${w}: عنوان لازم است`)
    if (!HASH_RE.test(str(v.aparat))) errors.push(`${w}: شناسهٔ آپارات نامعتبر (مثلاً ckn3o4e)`)
    if (v.poster !== undefined && !httpsOk(str(v.poster))) errors.push(`${w}: پوستر باید لینک https باشد`)
    cats(w, v)
  })
  // دسته‌ها
  if (doc.categories !== undefined) {
    const cseen = new Set<string>()
    listOf(doc, 'categories').forEach((c, i) => {
      const w = tag('categories', i, c)
      if (!ID_RE.test(str(c.id))) errors.push(`${w}: شناسه لازم است (انگلیسی کوچک)`)
      else if (cseen.has(str(c.id))) errors.push(`${w}: شناسهٔ تکراری`)
      cseen.add(str(c.id))
      if (!str(c.title)) errors.push(`${w}: عنوان لازم است`)
    })
  }
  // مناسبت‌ها (همان هستهٔ build)
  const occ = normalizeOccasions(doc.occasions, { catIds })
  errors.push(...occ.errors)
  if (doc.hijriOffsetDays !== undefined && !(Number.isInteger(doc.hijriOffsetDays) && Math.abs(doc.hijriOffsetDays as number) <= 2)) errors.push('جابه‌جایی تقویم قمری باید عدد صحیح بین -۲ و ۲ باشد')
  const targetCtx = {
    prayerIds: new Set(listOf(doc, 'prayers').map((p) => str(p.id))),
    causeIds: opts.causeIds ? new Set(opts.causeIds) : null,
    occasions: occ.list,
  }
  const bseen = new Set<string>()
  listOf(doc, 'banners').forEach((b, i) => {
    const w = tag('banners', i, b)
    const id = str(b.id)
    if (!ID_RE.test(id)) errors.push(`${w}: شناسه لازم است (انگلیسی)`)
    else if (bseen.has(id)) errors.push(`${w}: شناسهٔ تکراری`)
    bseen.add(id)
    if (!str(b.image) && !str(b.title)) errors.push(`${w}: تصویر یا عنوان لازم است`)
    const img = str(b.image)
    if (img && !httpsOk(img) && !IMG_FILE.test(img)) errors.push(`${w}: تصویر باید لینک https یا نام فایل (webp/jpg/png) باشد`)
    if (b.target !== undefined) { const t = normalizeTarget(b.target, targetCtx); if (t.error) errors.push(`${w}: ${t.error}`) }
    if (b.href !== undefined && !safeHref(str(b.href))) errors.push(`${w}: لینک مقصد باید با https:// یا / شروع شود`)
    if (!dateOk(b.startsAt) || !dateOk(b.endsAt)) errors.push(`${w}: تاریخ نامعتبر (مثل 2026-12-01)`)
  })
  return errors
}

/** تبدیل متن چندخطی «هر خط یک مورد» ↔ آرایه */
export const linesToList = (t: string): string[] => t.split(/\r?\n/).map((x) => x.trim()).filter(Boolean)
