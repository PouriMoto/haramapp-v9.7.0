import { useId, useState, type FormEvent } from 'react'
import { TARGET_PAGES } from '../../scripts/lib/occasionsCore.mjs'
import { normalizeDigits } from '../lib/text'
import type { FieldDef, KindDef } from './fields'
import { cleanItem, genId, getPath, setPath, type Item } from './model'

export interface EditorCtx {
  categories: { id: string; title: string }[]
  /** تصویر را کوچک می‌کند و برای انتشار نگه می‌دارد؛ نام فایل را برمی‌گرداند */
  stageImage(file: File, dir: 'banners' | 'causes'): Promise<string>
  previewUrl(dir: 'banners' | 'causes', name: string): string
  /** گزینه‌های «مقصد داخل اپ» برای بنر */
  targets: { prayers: IdTitle[]; causes: IdTitle[]; occasions: IdTitle[] }
}

interface IdTitle { id: string; title: string }
type Range = { from: string; to: string }
const RANGE_RE = /(\d{4}-\d{2}-\d{2})\D+(\d{4}-\d{2}-\d{2})/

function RangesField({ value, onChange, label }: { value: Range[]; onChange(v: Range[]): void; label: string }) {
  const [text, setText] = useState(() => value.map((r) => `${r.from} تا ${r.to}`).join('\n'))
  const commit = () => {
    const out: Range[] = []
    for (const line of normalizeDigits(text).split(/\r?\n/)) {
      const m = RANGE_RE.exec(line)
      if (m) out.push({ from: m[1], to: m[2] })
    }
    onChange(out)
  }
  return <textarea rows={3} dir="ltr" aria-label={label} value={text} placeholder="2026-12-01 تا 2026-12-10" onChange={(e) => setText(e.target.value)} onBlur={commit} />
}

function TargetField({ value, onChange, ctx }: { value: { type?: string; id?: string } | undefined; onChange(v: unknown): void; ctx: EditorCtx }) {
  const type = value?.type ?? ''
  const options: IdTitle[] =
    type === 'page' ? Object.entries(TARGET_PAGES as Record<string, { label: string }>).map(([id, p]) => ({ id, title: p.label }))
      : type === 'prayer' ? ctx.targets.prayers : type === 'cause' ? ctx.targets.causes : type === 'occasion' ? ctx.targets.occasions : []
  return (
    <div className="adm-row">
      <select aria-label="نوع مقصد" value={type} onChange={(e) => onChange(e.target.value ? { type: e.target.value, id: '' } : undefined)}>
        <option value="">— بدون مقصد داخلی —</option>
        <option value="cause">کارت همیاری</option>
        <option value="prayer">دعا</option>
        <option value="occasion">مناسبت</option>
        <option value="page">صفحه</option>
      </select>
      {type && (
        <select aria-label="مقصد" value={value?.id ?? ''} onChange={(e) => onChange({ type, id: e.target.value })}>
          <option value="">— انتخاب کنید —</option>
          {options.map((o) => <option key={o.id} value={o.id}>{o.title || o.id}</option>)}
        </select>
      )}
    </div>
  )
}

const asStr = (v: unknown): string => (typeof v === 'string' || typeof v === 'number' ? String(v) : '')

function ImageField({ def, dir, value, onChange, ctx }: { def: FieldDef; dir: 'banners' | 'causes'; value: string; onChange(v: string): void; ctx: EditorCtx }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const isUrl = /^https:\/\//i.test(value)
  const src = value ? (isUrl ? value : ctx.previewUrl(dir, value)) : ''
  const pick = async (f: File | undefined) => {
    if (!f) return
    setBusy(true)
    setErr('')
    try { onChange(await ctx.stageImage(f, dir)) } catch (e) { setErr(e instanceof Error ? e.message : 'آپلود انجام نشد') } finally { setBusy(false) }
  }
  return (
    <div className="adm-image">
      {src && <img src={src} alt="" className="adm-image__preview" onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />}
      <input value={value} onChange={(e) => onChange(e.target.value)} dir="ltr" placeholder="https://… یا نام فایل" aria-label={def.label} />
      <label className="btn btn--outline adm-upload">
        {busy ? 'در حال آماده‌سازی…' : 'انتخاب تصویر از گوشی'}
        <input type="file" accept="image/*" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = '' }} />
      </label>
      {value && <button type="button" className="adm-link" onClick={() => onChange('')}>حذف تصویر</button>}
      {err && <p className="field-err" role="alert">{err}</p>}
    </div>
  )
}

function Control({ def, kind, item, setValue, ctx, isNew }: { def: FieldDef; kind: KindDef; item: Item; setValue(v: unknown): void; ctx: EditorCtx; isNew: boolean }) {
  const uid = useId()
  const v = getPath(item, def.key)
  const common = { id: uid, dir: def.ltr ? ('ltr' as const) : undefined, disabled: def.createOnly && !isNew }
  switch (def.type) {
    case 'bool':
      return <label className="adm-check"><input type="checkbox" checked={v === true} onChange={(e) => setValue(e.target.checked)} /> {def.label}</label>
    case 'textarea':
      return <textarea {...common} rows={def.rows ?? 3} value={asStr(v)} onChange={(e) => setValue(e.target.value)} />
    case 'select':
      return (
        <select id={uid} value={asStr(v)} onChange={(e) => setValue(e.target.value)}>
          {(def.options ?? []).map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
      )
    case 'cats': {
      const cur = Array.isArray(v) ? (v as string[]) : []
      return (
        <div className="adm-cats" role="group" aria-label={def.label}>
          {ctx.categories.map((c) => (
            <label key={c.id} className="adm-check">
              <input type="checkbox" checked={cur.includes(c.id)} onChange={(e) => setValue(e.target.checked ? [...cur, c.id] : cur.filter((x) => x !== c.id))} /> {c.title}
            </label>
          ))}
        </div>
      )
    }
    case 'catOne':
      return (
        <select id={uid} value={asStr(v)} onChange={(e) => setValue(e.target.value)}>
          <option value="">— بدون دسته —</option>
          {ctx.categories.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      )
    case 'ranges':
      return <RangesField label={def.label} value={Array.isArray(v) ? (v as Range[]) : []} onChange={setValue} />
    case 'target':
      return <TargetField value={v as { type?: string; id?: string } | undefined} onChange={setValue} ctx={ctx} />
    case 'image':
      return <ImageField def={def} dir={kind.imageDir ?? 'banners'} value={asStr(v)} onChange={setValue} ctx={ctx} />
    case 'number':
      return <input {...common} inputMode="decimal" value={asStr(v)} onChange={(e) => { const t = normalizeDigits(e.target.value).trim(); setValue(t === '' ? '' : Number.isFinite(Number(t)) ? Number(t) : v) }} />
    case 'date':
      return <input {...common} type="date" value={asStr(v)} onChange={(e) => setValue(e.target.value)} />
    default:
      return <input {...common} type={def.type === 'url' ? 'url' : 'text'} inputMode={def.type === 'tel' ? 'numeric' : undefined} value={asStr(v)} onChange={(e) => setValue(e.target.value)} />
  }
}

type Acc = { id?: string; title?: string; bank?: Record<string, string> }

function AccountsField({ accounts, onChange }: { accounts: Acc[]; onChange(a: Acc[]): void }) {
  const upd = (i: number, patch: (a: Acc) => Acc) => onChange(accounts.map((a, j) => (j === i ? patch(a) : a)))
  const bankSet = (i: number, k: string, val: string) => upd(i, (a) => ({ ...a, bank: { ...(a.bank ?? {}), [k]: val } }))
  return (
    <fieldset className="adm-accounts">
      <legend>حساب‌ها (اختیاری؛ برای کارت چندحسابه مثل «عمرانی/فرهنگی»)</legend>
      {accounts.map((a, i) => (
        <div key={a.id ?? i} className="adm-account">
          <input placeholder="عنوان حساب (مثلاً عمرانی)" value={a.title ?? ''} onChange={(e) => upd(i, (x) => ({ ...x, title: e.target.value }))} />
          <input dir="ltr" placeholder="شناسه انگلیسی" value={a.id ?? ''} onChange={(e) => upd(i, (x) => ({ ...x, id: e.target.value }))} />
          <input placeholder="نام بانک" value={a.bank?.bankName ?? ''} onChange={(e) => bankSet(i, 'bankName', e.target.value)} />
          <input placeholder="نام صاحب حساب" value={a.bank?.ownerName ?? ''} onChange={(e) => bankSet(i, 'ownerName', e.target.value)} />
          <input dir="ltr" inputMode="numeric" placeholder="شماره کارت" value={a.bank?.cardNumber ?? ''} onChange={(e) => bankSet(i, 'cardNumber', e.target.value)} />
          <input dir="ltr" placeholder="شبا IR…" value={a.bank?.iban ?? ''} onChange={(e) => bankSet(i, 'iban', e.target.value)} />
          <button type="button" className="adm-link adm-danger" onClick={() => onChange(accounts.filter((_, j) => j !== i))}>حذف این حساب</button>
        </div>
      ))}
      <button type="button" className="btn btn--outline" onClick={() => onChange([...accounts, { id: genId('acc'), title: '' }])}>+ افزودن حساب</button>
    </fieldset>
  )
}

export function ItemEditor({ def, initial, initialText, isNew, ctx, onSave, onCancel }: {
  def: KindDef
  initial: Item
  initialText: string
  isNew: boolean
  ctx: EditorCtx
  onSave(item: Item, text: string): void
  onCancel(): void
}) {
  const [item, setItem] = useState<Item>(initial)
  const [text, setText] = useState(initialText)
  const [errors, setErrors] = useState<string[]>([])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const missing = def.fields.filter((f) => f.required && !asStr(getPath(item, f.key)).trim()).map((f) => `«${f.label}» لازم است`)
    const tg = item.target as { type?: string; id?: string } | undefined
    if (tg && tg.type && !tg.id) missing.push('مقصد داخلی را انتخاب کنید (یا «بدون مقصد»)')
    if (missing.length) { setErrors(missing); return }
    let out = cleanItem(item)
    if (def.kind === 'causes') out = { ...out, accounts: Array.isArray(out.accounts) ? out.accounts : [] }
    onSave(out, text)
  }

  return (
    <form onSubmit={submit} noValidate className="adm-form">
      {def.fields.map((f) => (
        <div key={f.key} className={f.type === 'bool' ? 'adm-field adm-field--bool' : 'adm-field'}>
          {f.type !== 'bool' && <label>{f.label}{f.required && <span aria-hidden> *</span>}</label>}
          <Control def={f} kind={def} item={item} setValue={(v) => setItem((s) => setPath(s, f.key, v))} ctx={ctx} isNew={isNew} />
          {f.hint && f.type !== 'bool' && <small className="muted">{f.hint}</small>}
        </div>
      ))}
      {def.kind === 'causes' && (
        <AccountsField accounts={Array.isArray(item.accounts) ? (item.accounts as Acc[]) : []} onChange={(a) => setItem((s) => ({ ...s, accounts: a }))} />
      )}
      {def.hasText && (
        <div className="adm-field">
          <label>متن دعا (مارک‌داون)</label>
          <textarea rows={14} value={text} onChange={(e) => setText(e.target.value)} placeholder={'# عنوان\n\nمتن عربی…\n\nترجمه…'} />
          <small className="muted">تیتر با # ؛ هر پاراگراف با یک خط خالی جدا می‌شود.</small>
        </div>
      )}
      {errors.length > 0 && <ul className="field-err" role="alert">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
      <div className="adm-actions">
        <button type="submit" className="btn">ثبت در پیش‌نویس</button>
        <button type="button" className="btn btn--outline" onClick={onCancel}>انصراف</button>
      </div>
    </form>
  )
}
