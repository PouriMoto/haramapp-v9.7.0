import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import './admin.css'
import { Dashboard } from './Dashboard'
import { createGithub, type Github } from './github'
import { clearVault, decryptToken, encryptToken, loadVault, saveVault, type VaultMeta } from './vault'

const IDLE_MS = 15 * 60 * 1000
const DEFAULT_META: VaultMeta = { owner: 'PouriMoto', repo: 'haramapp.ir', branch: 'main' }

export function AdminPage() {
  const [vault, setVault] = useState(loadVault)
  const [token, setToken] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  // صفحهٔ مدیریت نباید ایندکس شود
  useEffect(() => {
    const m = document.createElement('meta')
    m.name = 'robots'
    m.content = 'noindex,nofollow'
    document.head.appendChild(m)
    const prev = document.title
    document.title = 'مدیریت'
    return () => { m.remove(); document.title = prev }
  }, [])

  const lock = useCallback(() => setToken(null), [])
  const logout = useCallback(() => { clearVault(); setVault(null); setToken(null) }, [])

  // قفل خودکار بعد از ۱۵ دقیقه بی‌فعالیتی
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (!token) return
    const reset = () => { window.clearTimeout(timer.current); timer.current = window.setTimeout(lock, IDLE_MS) }
    const evs = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const
    evs.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    reset()
    return () => { window.clearTimeout(timer.current); evs.forEach((e) => window.removeEventListener(e, reset)) }
  }, [token, lock])

  const gh: Github | null = useMemo(
    () => (token && vault ? createGithub(vault.meta, token) : null),
    [token, vault],
  )

  const setup = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const tk = String(f.get('token') ?? '').trim()
    const pw = String(f.get('pw') ?? '')
    const pw2 = String(f.get('pw2') ?? '')
    const meta: VaultMeta = {
      owner: String(f.get('owner') ?? '').trim(),
      repo: String(f.get('repo') ?? '').trim(),
      branch: String(f.get('branch') ?? '').trim() || 'main',
    }
    if (!tk || !meta.owner || !meta.repo) return setErr('توکن و مشخصات ریپو را کامل کنید')
    if (pw.length < 8) return setErr('رمز باید دست‌کم ۸ نویسه باشد')
    if (pw !== pw2) return setErr('رمز و تکرار آن یکی نیست')
    setBusy(true); setErr('')
    try {
      await createGithub(meta, tk).check() // توکن و دسترسی را همین‌جا می‌سنجد
      const blob = await encryptToken(tk, pw)
      const v = { meta, blob }
      saveVault(v)
      setVault(v)
      setToken(tk)
    } catch (x) {
      setErr(x instanceof Error ? x.message : 'ذخیره انجام نشد')
    } finally { setBusy(false) }
  }

  const unlock = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!vault) return
    const pw = String(new FormData(e.currentTarget).get('pw') ?? '')
    setBusy(true); setErr('')
    try { setToken(await decryptToken(vault.blob, pw)) }
    catch (x) { setErr(x instanceof Error ? x.message : 'باز نشد') }
    finally { setBusy(false) }
  }

  return (
    <main className="adm" dir="rtl">
      {!vault && (
        <form className="adm-card adm-form" onSubmit={(e) => void setup(e)} autoComplete="off">
          <h1>راه‌اندازی داشبورد مدیر</h1>
          <p className="muted">یک‌بار توکن GitHub را وارد کنید. توکن با رمزِ شما رمز می‌شود و فقط روی همین دستگاه می‌ماند؛ هیچ‌جا ارسال نمی‌شود جز به api.github.com.</p>
          <div className="adm-field"><label htmlFor="token">توکن (Fine-grained PAT)</label><input id="token" name="token" type="password" dir="ltr" required autoComplete="off" /></div>
          <div className="adm-row">
            <div className="adm-field"><label htmlFor="owner">مالک</label><input id="owner" name="owner" dir="ltr" defaultValue={DEFAULT_META.owner} /></div>
            <div className="adm-field"><label htmlFor="repo">ریپو</label><input id="repo" name="repo" dir="ltr" defaultValue={DEFAULT_META.repo} /></div>
            <div className="adm-field"><label htmlFor="branch">شاخه</label><input id="branch" name="branch" dir="ltr" defaultValue={DEFAULT_META.branch} /></div>
          </div>
          <div className="adm-field"><label htmlFor="pw">رمز مدیر (حداقل ۸ نویسه)</label><input id="pw" name="pw" type="password" autoComplete="new-password" required /></div>
          <div className="adm-field"><label htmlFor="pw2">تکرار رمز</label><input id="pw2" name="pw2" type="password" autoComplete="new-password" required /></div>
          {err && <p className="field-err" role="alert">{err}</p>}
          <button className="btn" type="submit" disabled={busy}>{busy ? 'در حال بررسی…' : 'ذخیره و ورود'}</button>
        </form>
      )}

      {vault && !token && (
        <form className="adm-card adm-form" onSubmit={(e) => void unlock(e)}>
          <h1>ورود مدیر</h1>
          <p className="muted" dir="ltr">{vault.meta.owner}/{vault.meta.repo}@{vault.meta.branch}</p>
          <div className="adm-field"><label htmlFor="pw">رمز مدیر</label><input id="pw" name="pw" type="password" autoComplete="current-password" autoFocus required /></div>
          {err && <p className="field-err" role="alert">{err}</p>}
          <button className="btn" type="submit" disabled={busy}>{busy ? 'در حال باز کردن…' : 'ورود'}</button>
          <button type="button" className="btn btn--outline" onClick={() => { if (window.confirm('توکن ذخیره‌شده پاک شود؟')) logout() }}>فراموشی رمز / حذف توکن</button>
        </form>
      )}

      {vault && token && <Dashboard gh={gh} onLock={lock} onLogout={logout} />}
    </main>
  )
}
