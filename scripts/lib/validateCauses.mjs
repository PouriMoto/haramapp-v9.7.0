// اعتبارسنجی data/causes.json هنگام build (Node). قواعد در causesCore.mjs است (مشترک با داشبورد).
// خروجی: { file, copies, errors, warnings } — file همان چیزی است که اپ می‌خواند (public/content/causes.json).
// تصویر: لینک https یا نام فایلی در data/causes/ (به public/content/causes/ کپی می‌شود).
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { validateCausesCore } from './causesCore.mjs'

export { CHANNEL_KEYS, LIMITS, normalizeChannel } from './causesCore.mjs'

const exists = (p) => stat(p).then(() => true, () => false)

export async function validateCauses(dataDir, raw) {
  const r = await validateCausesCore(raw, { imageExists: (name) => exists(join(dataDir, 'causes', name)) })
  const copies = r.images.map((name) => ({ from: join(dataDir, 'causes', name), to: `causes/${name}` }))
  return { file: r.file, copies, errors: r.errors, warnings: r.warnings }
}
