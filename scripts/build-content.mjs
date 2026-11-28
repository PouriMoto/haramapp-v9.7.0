#!/usr/bin/env node
// data/content.json (+ data/prayers/*.md, data/banners/*) → public/content/{manifest.json, prayers/, banners/}
// خودکار قبل از `npm run dev` و `npm run build` اجرا می‌شود. دستی: npm run content
// --check فقط اعتبارسنجی می‌کند و چیزی نمی‌نویسد.
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { buildContent } from './lib/buildContent.mjs'
import { normalizePresets } from './lib/presetsCore.mjs'
import { validateCauses } from './lib/validateCauses.mjs'

const args = process.argv.slice(2)
const check = args.includes('--check')
const dataDir = args.includes('--src') ? args[args.indexOf('--src') + 1] : 'data'
const outDir = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'public/content'

const { manifest, texts, copies, errors, warnings } = await buildContent(dataDir)

// کارت‌های همیاری: data/causes.json (اعتبارسنجی + نرمال‌سازی؛ قواعد در scripts/lib/validateCauses.mjs)
let causesFile = null
try {
  const raw = JSON.parse(await readFile(join(dataDir, 'causes.json'), 'utf8'))
  const r = await validateCauses(dataDir, raw)
  causesFile = r.file
  errors.push(...r.errors)
  warnings.push(...r.warnings)
  copies.push(...r.copies)
} catch (e) {
  errors.push(`data/causes.json: ${e.code === 'ENOENT' ? 'پیدا نشد' : 'JSON نامعتبر (' + e.message + ')'}`)
}
// جمله‌های آمادهٔ درد و دل: data/presets.json (اختیاری؛ نبودنش = فقط متن آزاد)
let presetsFile = { presets: [] }
try {
  const r = normalizePresets(JSON.parse(await readFile(join(dataDir, 'presets.json'), 'utf8')))
  presetsFile = { presets: r.presets }
  errors.push(...r.errors)
  warnings.push(...r.warnings)
} catch (e) {
  if (e.code !== 'ENOENT') errors.push(`data/presets.json: JSON نامعتبر (${e.message})`)
}
for (const w of warnings) console.warn(`⚠ ${w}`)
if (errors.length) {
  console.error('\nخطا در اطلاعات data/ — لطفاً این موارد را اصلاح کنید:')
  for (const e of errors) console.error(`  ✖ ${e}`)
  process.exit(1)
}
const summary = `${manifest.prayers.length} دعا، ${manifest.music.length} نوا، ${manifest.videos.length} ویدیو، ${manifest.banners.length} بنر، ${causesFile.causes.length} کارت همیاری، ${presetsFile.presets.length} جملهٔ آماده`
if (check) { console.log(`✔ معتبر: ${summary}`); process.exit(0) }

await rm(outDir, { recursive: true, force: true })
await mkdir(join(outDir, 'prayers'), { recursive: true })
await writeFile(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
for (const [id, md] of Object.entries(texts)) await writeFile(join(outDir, 'prayers', `${id}.md`), md)
await writeFile(join(outDir, 'causes.json'), JSON.stringify(causesFile) + '\n')
await writeFile(join(outDir, 'presets.json'), JSON.stringify(presetsFile) + '\n')
for (const c of copies) { await mkdir(dirname(join(outDir, c.to)), { recursive: true }); await copyFile(c.from, join(outDir, c.to)) }
console.log(`✔ ${outDir}: ${summary}`)
