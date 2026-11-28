// جمله‌های آمادهٔ درد و دل (data/presets.json). خالص و بدون وابستگی به node:fs.
// هر جمله حداکثر ۱۲۰ نویسه. متن نهایی سمت سرور (Code.gs → PRESETS) است؛ تست tests/codegs.test.ts یکی‌بودن را می‌سنجد.
export const PRESET_LIMITS = { min: 1, max: 8, textMax: 120 }

/** @returns {{ presets: {id:string,text:string}[], errors: string[], warnings: string[] }} */
export function normalizePresets(raw) {
  const errors = []
  const warnings = []
  const list = raw && typeof raw === 'object' && Array.isArray(raw.presets) ? raw.presets : null
  if (!list) return { presets: [], errors: ['data/presets.json: کلید presets (آرایه) لازم است'], warnings }
  const seen = new Set()
  const presets = []
  list.forEach((p, i) => {
    const at = `data/presets.json → presets[${i}]`
    const id = typeof p?.id === 'string' ? p.id.trim() : ''
    const text = typeof p?.text === 'string' ? p.text.trim() : ''
    if (!/^[a-z0-9_-]{1,32}$/.test(id)) return void errors.push(`${at}: id باید انگلیسی کوچک/عدد/خط‌تیره (حداکثر ۳۲) باشد`)
    if (seen.has(id)) return void errors.push(`${at}: id «${id}» تکراری است`)
    if (text.length < 1 || text.length > PRESET_LIMITS.textMax) return void errors.push(`${at}: متن باید ۱ تا ${PRESET_LIMITS.textMax} نویسه باشد`)
    seen.add(id)
    presets.push({ id, text })
  })
  if (presets.length > PRESET_LIMITS.max) errors.push(`data/presets.json: حداکثر ${PRESET_LIMITS.max} جمله`)
  if (list.length > 0 && presets.length > 0 && presets.length < 3) warnings.push('data/presets.json: کمتر از ۳ جمله آماده است')
  return { presets, errors, warnings }
}
