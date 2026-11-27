// هستهٔ خالص اعتبارسنجی کارت‌های همیاری (منبع حقیقت قواعد). بدون وابستگی به node:fs → هم در build (Node) و هم در داشبورد (مرورگر) اجرا می‌شود.
// ورودی: raw (causes.json) و { imageExists(name) } ؛ خروجی: { file, images, errors, warnings }
// images = نام فایل‌های data/causes/ که باید کپی شوند؛ file همان چیزی است که اپ می‌خواند.

const ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/
const IMG_EXT = /\.(webp|jpg|jpeg|png)$/i
const FA = '۰۱۲۳۴۵۶۷۸۹'
const AR = '٠١٢٣٤٥٦٧٨٩'
export const CHANNEL_KEYS = ['whatsapp', 'telegram', 'bale', 'rubika', 'eitaa', 'website']
export const LIMITS = { title: 80, description: 300, introWordsWarn: 330, introWordsMax: 500, manager: 60, phone: 25, address: 200, accounts: 8 }

const digits = (s) => String(s).replace(/[۰-۹٠-٩]/g, (d) => { const i = FA.indexOf(d); return String(i >= 0 ? i : AR.indexOf(d)) })
const httpsOk = (u) => { try { const x = new URL(u); return x.protocol === 'https:' && !x.username && !x.password } catch { return false } }
const str = (v) => (typeof v === 'string' ? v.trim() : '')
const words = (t) => t.split(/\s+/).filter(Boolean).length

/** رابط کانال: لینک https، یا شناسه (با/بدون @) → لینک رسمی پیام‌رسان. null = نامعتبر */
export function normalizeChannel(key, raw) {
  const v = digits(str(raw))
  if (!v) return ''
  if (/^https?:\/\//i.test(v)) return httpsOk(v) ? v : null
  const id = v.replace(/^@/, '')
  switch (key) {
    case 'whatsapp': {
      const n = v.replace(/[\s()+-]/g, '')
      if (/^09\d{9}$/.test(n)) return `https://wa.me/98${n.slice(1)}`
      if (/^98\d{10}$/.test(n)) return `https://wa.me/${n}`
      return null
    }
    case 'telegram': return /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(id) ? `https://t.me/${id}` : null
    case 'bale': return /^[A-Za-z0-9_.]{3,40}$/.test(id) ? `https://ble.ir/${id}` : null
    case 'rubika': return /^[A-Za-z0-9_.]{3,40}$/.test(id) ? `https://rubika.ir/${id}` : null
    case 'eitaa': return /^[A-Za-z0-9_.]{3,40}$/.test(id) ? `https://eitaa.com/${id}` : null
    case 'website': return /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(v) && httpsOk(`https://${v}`) ? `https://${v}` : null
    default: return null
  }
}

function bank(b, where, errors) {
  if (b === undefined || b === null) return undefined
  if (typeof b !== 'object') { errors.push(`${where}: «bank» باید یک بلوک باشد`); return undefined }
  const cardNumber = digits(b.cardNumber ?? '').replace(/[\s-]/g, '')
  const iban = digits(b.iban ?? '').replace(/[\s-]/g, '').toUpperCase()
  if (!cardNumber && !iban) return undefined
  if (cardNumber && !/^\d{16}$/.test(cardNumber)) errors.push(`${where}: شماره کارت باید ۱۶ رقم باشد`)
  if (iban && !/^IR\d{24}$/.test(iban)) errors.push(`${where}: شماره شبا باید IR و ۲۴ رقم باشد`)
  return { bankName: str(b.bankName).slice(0, 60), ownerName: str(b.ownerName).slice(0, 80), cardNumber, iban }
}

export async function validateCausesCore(raw, { imageExists = async () => false } = {}) {
  const errors = []
  const warnings = []
  const images = []
  const out = []
  if (!raw || !Array.isArray(raw.causes)) return { file: null, images, errors: ['causes.json: فهرست «causes» پیدا نشد'], warnings }

  const seen = new Set()
  for (const [i, c] of raw.causes.entries()) {
    const where = `causes[${i}]${c?.title ? ` «${c.title}»` : ''}`
    if (!c || typeof c !== 'object') { errors.push(`${where}: باید یک بلوک باشد`); continue }
    const id = str(c.id)
    if (!ID_RE.test(id)) { errors.push(`${where}: «id» لازم است (انگلیسی کوچک، عدد، - و _)`); continue }
    if (seen.has(id)) { errors.push(`${where}: id تکراری (${id})`); continue }
    seen.add(id)
    const title = str(c.title)
    if (!title) { errors.push(`${where}: «title» (نام مسجد/حسینیه/خیریه) لازم است`); continue }
    if (title.length > LIMITS.title) errors.push(`${where}: عنوان حداکثر ${LIMITS.title} کاراکتر`)

    const description = str(c.description)
    if (description.length > LIMITS.description) errors.push(`${where}: «description» (خلاصهٔ کوتاه) حداکثر ${LIMITS.description} کاراکتر؛ متن بلند را در «intro» بنویسید`)

    const intro = str(c.intro)
    const n = words(intro)
    if (n > LIMITS.introWordsMax) errors.push(`${where}: «intro» ${n} کلمه است؛ حداکثر ${LIMITS.introWordsMax} (هدف حدود ۳۰۰)`)
    else if (n > LIMITS.introWordsWarn) warnings.push(`${where}: «intro» ${n} کلمه است (هدف حدود ۳۰۰)`)

    // تصویر
    let image
    if (c.image !== undefined && c.image !== '') {
      const im = str(c.image)
      if (httpsOk(im)) image = im
      else if (/^[\w.-]+$/.test(im) && IMG_EXT.test(im) && await imageExists(im)) {
        image = `causes/${im}`
        images.push(im)
      } else errors.push(`${where}: تصویر پیدا نشد. لینک https بدهید یا فایل را در data/causes/ بگذارید و فقط نام فایل را بنویسید (${im})`)
    }

    // تماس (اختیاری)
    let contact
    if (c.contact !== undefined) {
      const k = c.contact ?? {}
      const manager = str(k.manager).slice(0, LIMITS.manager)
      const phone = digits(str(k.phone)).slice(0, LIMITS.phone)
      const address = str(k.address).slice(0, LIMITS.address)
      if (phone && !/^[0-9+\-\s()]{5,25}$/.test(phone)) errors.push(`${where}: «contact.phone» نامعتبر است`)
      if (manager || phone || address) contact = { ...(manager ? { manager } : {}), ...(phone ? { phone } : {}), ...(address ? { address } : {}) }
    }

    // کانال‌های ارتباطی (اختیاری)
    let channels
    if (c.channels !== undefined) {
      channels = {}
      for (const [key, val] of Object.entries(c.channels ?? {})) {
        if (!CHANNEL_KEYS.includes(key)) { errors.push(`${where}: کانال ناشناخته «${key}». مجاز: ${CHANNEL_KEYS.join('، ')}`); continue }
        const url = normalizeChannel(key, val)
        if (url === null) errors.push(`${where}: مقدار «channels.${key}» نامعتبر است (لینک https یا شناسه)`)
        else if (url) channels[key] = url
      }
      if (Object.keys(channels).length === 0) channels = undefined
    }

    // لینک پرداخت مستقیم (اختیاری): فقط https
    let payLink
    if (c.payLink !== undefined && c.payLink !== '') {
      const p = str(c.payLink)
      if (httpsOk(p)) payLink = p
      else errors.push(`${where}: «payLink» باید لینک https باشد (مرچنت‌کد/توکن را هرگز اینجا نگذارید)`)
    }

    // حساب‌ها
    const accRaw = Array.isArray(c.accounts) ? c.accounts : []
    if (c.accounts !== undefined && !Array.isArray(c.accounts)) errors.push(`${where}: «accounts» باید فهرست باشد`)
    if (accRaw.length > LIMITS.accounts) errors.push(`${where}: حداکثر ${LIMITS.accounts} حساب`)
    const accSeen = new Set()
    const accounts = []
    for (const [j, a] of accRaw.entries()) {
      const aw = `${where} → accounts[${j}]`
      const aid = str(a?.id)
      if (!ID_RE.test(aid)) { errors.push(`${aw}: «id» لازم است`); continue }
      if (accSeen.has(aid)) { errors.push(`${aw}: id تکراری (${aid})`); continue }
      accSeen.add(aid)
      if (!str(a.title)) { errors.push(`${aw}: «title» لازم است`); continue }
      const b = bank(a.bank, aw, errors)
      accounts.push({ id: aid, title: str(a.title), ...(b ? { bank: b } : {}), online: a.online === true })
    }

    const b = bank(c.bank, where, errors)
    if (c.order !== undefined && !Number.isFinite(c.order)) errors.push(`${where}: «order» باید عدد باشد`)
    if (c.enabled !== undefined && typeof c.enabled !== 'boolean') errors.push(`${where}: «enabled» باید true یا false باشد`)

    out.push({
      id, title,
      ...(description ? { description } : {}),
      ...(intro ? { intro } : {}),
      ...(image ? { image } : {}),
      ...(contact ? { contact } : {}),
      ...(channels ? { channels } : {}),
      ...(payLink ? { payLink } : {}),
      ...(b ? { bank: b } : {}),
      online: c.online === true,
      accounts,
      order: Number.isFinite(c.order) ? c.order : i + 1,
      ...(c.enabled === false ? { enabled: false } : {}),
    })
  }
  return { file: { version: 1, causes: out }, images, errors, warnings }
}
