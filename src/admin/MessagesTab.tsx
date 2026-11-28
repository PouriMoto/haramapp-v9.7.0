import { useCallback, useState, type FormEvent } from 'react'
import { env } from '../config/env'
import { createModeration, type PendingMessage } from './moderation'

const dateFmt = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' })

/** صفحهٔ تأیید درد و دل‌ها. توکن مدیر Apps Script فقط در حافظه می‌ماند. */
export function MessagesTab() {
  const [token, setToken] = useState('')
  const [items, setItems] = useState<PendingMessage[] | null>(null)
  const [total, setTotal] = useState(0)
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')

  const load = useCallback(async (tk: string) => {
    setBusy('*'); setErr('')
    try {
      const r = await createModeration(env.appsScriptUrl, tk).list()
      setItems(r.items); setTotal(r.total)
    } catch (e) {
      setItems(null)
      setErr(e instanceof Error ? e.message : 'دریافت انجام نشد')
    } finally { setBusy('') }
  }, [])

  const enter = (e: FormEvent) => { e.preventDefault(); if (token.trim()) void load(token.trim()) }

  const decide = async (m: PendingMessage, how: 'approve' | 'reject') => {
    setBusy(m.id); setErr('')
    try {
      const mod = createModeration(env.appsScriptUrl, token.trim())
      await (how === 'approve' ? mod.approve(m.id) : mod.reject(m.id))
      setItems((l) => (l ?? []).filter((x) => x.id !== m.id))
      setTotal((n) => Math.max(0, n - 1))
    } catch (x) { setErr(x instanceof Error ? x.message : 'انجام نشد') }
    finally { setBusy('') }
  }

  if (items === null) {
    return (
      <form className="adm-form" onSubmit={enter}>
        <p className="muted">متن‌های آزاد کاربران تا تأیید شما نمایش داده نمی‌شوند. توکن مدیر (ADMIN_TOKEN در Script Properties) را وارد کنید؛ ذخیره نمی‌شود و با بستن/قفل صفحه پاک می‌شود.</p>
        <div className="adm-field">
          <label htmlFor="admtok">ADMIN_TOKEN</label>
          <input id="admtok" type="password" dir="ltr" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} />
        </div>
        {err && <p className="field-err" role="alert">{err}</p>}
        <button className="btn" type="submit" disabled={busy !== '' || !token.trim()}>{busy ? 'در حال دریافت…' : 'نمایش پیام‌های منتظر تأیید'}</button>
      </form>
    )
  }

  return (
    <section>
      <div className="adm-bar">
        <strong>{total.toLocaleString('fa-IR')} پیام منتظر تأیید</strong>
        <button type="button" className="btn btn--outline" disabled={busy !== ''} onClick={() => void load(token.trim())}>تازه‌سازی</button>
      </div>
      {err && <p className="field-err" role="alert">{err}</p>}
      <ul className="adm-list">
        {items.map((m) => (
          <li key={m.id} className="adm-item">
            <div className="adm-item__text">
              <strong>{m.name || 'ناشناس'}</strong>
              <span style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.message}</span>
              <span className="muted">{Number.isNaN(Date.parse(m.createdAt)) ? '' : dateFmt.format(new Date(m.createdAt))}</span>
            </div>
            <div className="adm-item__btns">
              <button type="button" disabled={busy !== ''} onClick={() => void decide(m, 'approve')}>تأیید و انتشار</button>
              <button type="button" className="adm-danger" disabled={busy !== ''} onClick={() => void decide(m, 'reject')}>رد</button>
            </div>
          </li>
        ))}
      </ul>
      {items.length === 0 && <p className="muted">پیامی منتظر تأیید نیست. 🌹</p>}
      {total > items.length && <p className="muted">فقط ۱۰۰ پیام اول نمایش داده شد؛ بعد از بررسی، تازه‌سازی کنید.</p>}
    </section>
  )
}
