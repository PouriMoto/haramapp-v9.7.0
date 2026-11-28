import { useEffect, useMemo, useRef, useState } from 'react'
import { validateCausesCore } from '../../scripts/lib/causesCore.mjs'
import { Sheet } from '../components/Sheet'
import { pageUrl } from '../lib/share'
import { KIND_ORDER, KINDS, type KindDef } from './fields'
import type { AdminBackend, CommitInfo, RunInfo } from './github'
import { resizeToWebp } from './image'
import { ItemEditor, type EditorCtx } from './ItemEditor'
import { MessagesTab } from './MessagesTab'
import {
  DEFAULT_CATEGORIES, linesToList, listOf, moveItem, replaceList, serialize, validateContentDoc, type Doc, type Item, type Kind,
} from './model'

type Tab = Kind | 'messages' | 'settings' | 'history'
type Pub = { phase: 'idle' | 'working' | 'watching' | 'done' | 'failed'; text: string; url?: string; errors?: string[] }
interface Editing { def: KindDef; index: number; item: Item; text: string }
interface TextEntry { base: string | null; text: string }

const CONTENT_PATH = 'data/content.json'
const CAUSES_PATH = 'data/causes.json'
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const labelOf = (def: KindDef) => def.label

export function Dashboard({ gh, onLock, onLogout }: { gh: AdminBackend | null; onLock?(): void; onLogout?(): void }) {
  const local = gh?.mode === 'local'
  const [load, setLoad] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [loadError, setLoadError] = useState('')
  const [content, setContent] = useState<Doc | null>(null)
  const [causes, setCauses] = useState<Doc | null>(null)
  const [base, setBase] = useState({ content: '', causes: '' })
  const [texts, setTexts] = useState<Record<string, TextEntry>>({})
  const [deletedTexts, setDeletedTexts] = useState<string[]>([])
  const [uploads, setUploads] = useState<Record<string, string>>({}) // path → base64 (منتظر انتشار)
  const [previews, setPreviews] = useState<Record<string, string>>({}) // 'dir/name' → blob URL
  const [tab, setTab] = useState<Tab>('prayers')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Editing | null>(null)
  const [message, setMessage] = useState('به‌روزرسانی محتوا از داشبورد')
  const [pub, setPub] = useState<Pub>({ phase: 'idle', text: '' })
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false }, [])

  // ---------- بارگذاری ----------
  useEffect(() => {
    if (!gh || load !== 'idle') return
    setLoad('loading')
    void (async () => {
      try {
        const [c, k] = await Promise.all([gh.getText(CONTENT_PATH), gh.getText(CAUSES_PATH)])
        if (!c || !k) throw new Error('فایل‌های data/content.json یا data/causes.json در ریپو پیدا نشد')
        setContent(JSON.parse(c.text) as Doc)
        setCauses(JSON.parse(k.text) as Doc)
        setBase({ content: c.text, causes: k.text })
        setLoad('ready')
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : 'بارگذاری انجام نشد')
        setLoad('error')
      }
    })()
  }, [gh, load])

  const contentDirty = !!content && serialize(content) !== base.content
  const causesDirty = !!causes && serialize(causes) !== base.causes
  const referenced = useMemo(() => serialize(content) + serialize(causes), [content, causes])
  const pendingUploads = Object.keys(uploads).filter((p) => referenced.includes(p.split('/').pop() as string))
  const changedTexts = Object.entries(texts).filter(([id, t]) => {
    if (t.text === (t.base ?? '')) return false
    const title = String(listOf(content, 'prayers').find((p) => p.id === id)?.title ?? '')
    return !(t.base === null && (t.text.trim() === '' || t.text.trim() === `# ${title}`))
  })
  const liveTexts = changedTexts.filter(([id]) => listOf(content, 'prayers').some((p) => p.id === id))
  const dirtyCount = Number(contentDirty) + Number(causesDirty) + liveTexts.length + deletedTexts.length + pendingUploads.length
  const dirty = dirtyCount > 0

  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  // ---------- ویرایش فهرست‌ها ----------
  const docOf = (def: KindDef) => (def.file === 'content' ? content : causes)
  const updateList = (def: KindDef, fn: (list: Item[]) => Item[]) => {
    const set = def.file === 'content' ? setContent : setCauses
    set((d) => (d ? replaceList(d, def.listKey, fn(listOf(d, def.listKey))) : d))
  }

  const categories = useMemo(() => {
    const c = content && Array.isArray(content.categories) ? (content.categories as Item[]) : null
    return c ? c.map((x) => ({ id: String(x.id), title: String(x.title ?? x.id) })) : DEFAULT_CATEGORIES
  }, [content])

  const titled = (list: Item[]) => list.map((x) => ({ id: String(x.id ?? ''), title: String(x.title ?? x.id ?? '') }))
  const ctx: EditorCtx = {
    categories,
    targets: { prayers: titled(listOf(content, 'prayers')), causes: titled(listOf(causes, 'causes')), occasions: titled(listOf(content, 'occasions')) },
    previewUrl: (dir, name) => previews[`${dir}/${name}`] ?? pageUrl(`/content/${dir}/${name}`),
    stageImage: async (file, dir) => {
      const r = await resizeToWebp(file, dir === 'banners' ? 1200 : 900)
      const name = `img-${Date.now().toString(36)}.webp`
      setUploads((u) => ({ ...u, [`data/${dir}/${name}`]: r.base64 }))
      setPreviews((p) => ({ ...p, [`${dir}/${name}`]: r.blobUrl }))
      return name
    },
  }

  const openEdit = async (def: KindDef, index: number) => {
    const list = listOf(docOf(def), def.listKey)
    const item = index >= 0 ? list[index] : def.newItem()
    let text = ''
    if (def.hasText) {
      const id = String(item.id ?? '')
      if (texts[id]) text = texts[id].text
      else if (index >= 0 && gh) {
        try {
          const f = await gh.getText(`data/prayers/${id}.md`)
          text = f?.text ?? `# ${String(item.title ?? '')}\n`
          setTexts((t) => ({ ...t, [id]: { base: f?.text ?? null, text } }))
        } catch (e) { alert(e instanceof Error ? e.message : 'خواندن متن دعا انجام نشد'); return }
      } else text = `# ${String(item.title ?? '')}\n`
    }
    setEditing({ def, index, item, text })
  }

  const saveItem = (item: Item, text: string) => {
    if (!editing) return
    const { def, index } = editing
    updateList(def, (list) => (index >= 0 ? list.map((x, i) => (i === index ? item : x)) : def.file === 'causes' ? [...list, item] : [item, ...list]))
    if (def.hasText) {
      const id = String(item.id)
      setTexts((t) => ({ ...t, [id]: { base: t[id]?.base ?? null, text } }))
      setDeletedTexts((d) => d.filter((x) => x !== id))
    }
    setEditing(null)
  }

  const removeItem = (def: KindDef, index: number) => {
    const it = listOf(docOf(def), def.listKey)[index]
    if (!it || !window.confirm(`«${def.titleOf(it) || 'این مورد'}» حذف شود؟ (تا قبل از «انتشار» اعمال نمی‌شود)`)) return
    updateList(def, (list) => list.filter((_, i) => i !== index))
    if (def.hasText) setDeletedTexts((d) => [...d, String(it.id)])
  }

  // ---------- انتشار ----------
  const watch = async (sha: string) => {
    setPub({ phase: 'watching', text: 'تغییرات روی GitHub ذخیره شد؛ منتظر ساخت و انتشار…' })
    let run: RunInfo | null = null
    for (let i = 0; i < 70 && alive.current; i++) {
      await sleep(6000)
      try { run = gh ? await gh.runFor(sha) : null } catch { /* شبکهٔ لحظه‌ای */ }
      if (run?.status === 'completed') break
      if (run) setPub({ phase: 'watching', text: run.status === 'queued' ? 'در صف انتشار…' : 'در حال ساخت و انتشار…', url: run.url })
    }
    if (!alive.current) return
    if (run?.status === 'completed' && run.conclusion === 'success') setPub({ phase: 'done', text: '✔ منتشر شد. اگر تغییر را در اپ نمی‌بینید، صفحه را یک‌بار تازه کنید.', url: run.url })
    else if (run?.status === 'completed') setPub({ phase: 'failed', text: '✖ ساخت/انتشار ناموفق بود (سایت قبلی سالم مانده). جزئیات را در GitHub ببینید.', url: run.url })
    else setPub({ phase: 'failed', text: 'وضعیت انتشار را نتوانستم بگیرم؛ در GitHub → Actions بررسی کنید.' })
  }

  const publish = async () => {
    if (!gh || !content || !causes) return
    setPub({ phase: 'working', text: 'اعتبارسنجی…' })
    try {
      const own = new Set(Object.keys(uploads).map((p) => p.split('/').pop() as string))
      const known = new Set(listOf(causes, 'causes').map((c) => String(c.image ?? '')))
      const core = await validateCausesCore(causes, { imageExists: async (n: string) => own.has(n) || known.has(n) })
      const errors: string[] = [...validateContentDoc(content, { causeIds: listOf(causes, 'causes').map((c) => String(c.id)) }), ...(core.errors as string[])]
      if (errors.length) { setPub({ phase: 'failed', text: 'ابتدا این خطاها را اصلاح کنید:', errors }); return }

      setPub({ phase: 'working', text: 'بررسی تعارض با تغییرات تازهٔ GitHub…' })
      const files: { path: string; text?: string; base64?: string; delete?: boolean }[] = []
      for (const [path, doc, before, isDirty] of [[CONTENT_PATH, content, base.content, contentDirty], [CAUSES_PATH, causes, base.causes, causesDirty]] as const) {
        if (!isDirty) continue
        const fresh = await gh.getText(path)
        if (fresh?.text !== before) { setPub({ phase: 'failed', text: `فایل ${path} روی GitHub تغییر کرده است (شاید از جای دیگری). صفحه را تازه کنید تا آخرین نسخه بارگذاری شود؛ تغییرات فعلی را قبلش یادداشت کنید.` }); return }
        files.push({ path, text: serialize(doc) })
      }
      for (const [id, t] of liveTexts) files.push({ path: `data/prayers/${id}.md`, text: t.text.endsWith('\n') ? t.text : `${t.text}\n` })
      for (const id of deletedTexts) { if (await gh.getText(`data/prayers/${id}.md`)) files.push({ path: `data/prayers/${id}.md`, delete: true }) }
      for (const p of pendingUploads) files.push({ path: p, base64: uploads[p] })

      setPub({ phase: 'working', text: 'ثبت تغییرات روی GitHub…' })
      const sha = await gh.commit(files, message.trim() || 'به‌روزرسانی محتوا از داشبورد')
      setBase({ content: serialize(content), causes: serialize(causes) })
      setTexts((t) => Object.fromEntries(Object.entries(t).map(([id, e]) => [id, { base: e.text, text: e.text }])))
      setDeletedTexts([])
      setUploads({})
      if (gh.mode === 'local') {
        const r = gh.lastPush
        setPub(r?.pushed
          ? { phase: 'done', text: '✔ در فایل‌های همین کامپیوتر ذخیره، commit و به GitHub push شد. ساخت و انتشار سایت چند دقیقه طول می‌کشد (وضعیت: GitHub → Actions).' }
          : { phase: 'failed', text: `ذخیره و commit محلی انجام شد ولی push نشد؛ بعداً در پوشهٔ پروژه «git push» بزنید.${r?.error ? ` (${r.error})` : ''}` })
        return
      }
      await watch(sha)
    } catch (e) {
      setPub({ phase: 'failed', text: e instanceof Error ? e.message : 'انتشار انجام نشد' })
    }
  }

  // ---------- تاریخچه / بازگردانی ----------
  const [hist, setHist] = useState<CommitInfo[] | null>(null)
  const [histErr, setHistErr] = useState('')
  const loadHistory = async () => {
    if (!gh) return
    setHistErr('')
    try { setHist(await gh.history()) } catch (e) { setHistErr(e instanceof Error ? e.message : 'خطا') }
  }
  useEffect(() => {
    if (tab === 'history' && hist === null && gh && load === 'ready') void loadHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, gh, load])

  const restore = async (c: CommitInfo) => {
    if (!gh || !window.confirm('محتوای دعا/نوا/ویدیو/بنر/همیاری به نسخهٔ این commit برگردانده شود؟ فقط در پیش‌نویس اعمال می‌شود و تا «انتشار» نمی‌زنید چیزی عوض نمی‌شود.')) return
    try {
      const [a, b] = await Promise.all([gh.getText(CONTENT_PATH, c.sha), gh.getText(CAUSES_PATH, c.sha)])
      if (a) setContent(JSON.parse(a.text) as Doc)
      if (b) setCauses(JSON.parse(b.text) as Doc)
      setTab('prayers')
    } catch (e) { alert(e instanceof Error ? e.message : 'بازگردانی انجام نشد') }
  }

  // ---------- نمایش ----------
  if (load === 'idle' || load === 'loading') return <p className="adm-note" role="status">{gh ? 'در حال بارگذاری اطلاعات از GitHub…' : 'برای ادامه قفل را باز کنید.'}</p>
  if (load === 'error') return (
    <div className="adm-note"><p className="field-err" role="alert">{loadError}</p><button type="button" className="btn" onClick={() => setLoad('idle')}>تلاش دوباره</button></div>
  )

  const tabs: { id: Tab; label: string }[] = [...KIND_ORDER.map((k) => ({ id: k as Tab, label: labelOf(KINDS[k]) })), { id: 'messages', label: 'درد و دل‌ها' }, { id: 'settings', label: 'تنظیمات' }, { id: 'history', label: 'تاریخچه' }]
  const def = tab !== 'settings' && tab !== 'history' && tab !== 'messages' ? KINDS[tab] : null
  const list = def ? listOf(docOf(def), def.listKey) : []
  const needle = q.trim().toLowerCase()
  const hostsText = content && Array.isArray(content.allowedHosts) ? (content.allowedHosts as string[]).join('\n') : ''

  return (
    <div className="adm-dash">
      <header className="adm-top">
        <h1>داشبورد مدیر{local && <small className="muted"> — حالت محلی (dev)</small>}</h1>
        {onLock && onLogout && (
          <div className="adm-top__btns">
            <button type="button" className="btn btn--outline" onClick={onLock}>قفل</button>
            <button type="button" className="btn btn--outline" onClick={() => { if (!dirty || window.confirm('تغییرات منتشرنشده از بین می‌رود. خروج؟')) onLogout() }}>خروج</button>
          </div>
        )}
      </header>

      <nav className="adm-tabs" aria-label="بخش‌ها">
        {tabs.map((t) => <button key={t.id} type="button" className={t.id === tab ? 'adm-tab adm-tab--on' : 'adm-tab'} onClick={() => { setTab(t.id); setQ('') }}>{t.label}</button>)}
      </nav>

      {def && (
        <section>
          <div className="adm-bar">
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`جستجو در ${def.label}`} aria-label="جستجو" />
            <button type="button" className="btn" onClick={() => void openEdit(def, -1)}>+ افزودن</button>
          </div>
          <ul className="adm-list">
            {list.map((it, i) => ({ it, i })).filter(({ it }) => !needle || def.titleOf(it).toLowerCase().includes(needle) || String(it.id ?? '').toLowerCase().includes(needle)).map(({ it, i }) => (
              <li key={`${String(it.id ?? it.title ?? '')}-${i}`} className="adm-item">
                <div className="adm-item__text">
                  <strong>{def.titleOf(it) || '(بدون عنوان)'}</strong>
                  <span className="muted">{def.subtitleOf(it)}</span>
                  {it.enabled === false && <span className="adm-badge">غیرفعال</span>}
                </div>
                <div className="adm-item__btns">
                  <button type="button" aria-label="بالا" disabled={i === 0} onClick={() => updateList(def, (l) => moveItem(l, i, -1))}>↑</button>
                  <button type="button" aria-label="پایین" disabled={i === list.length - 1} onClick={() => updateList(def, (l) => moveItem(l, i, 1))}>↓</button>
                  <button type="button" onClick={() => void openEdit(def, i)}>ویرایش</button>
                  <button type="button" className="adm-danger" onClick={() => removeItem(def, i)}>حذف</button>
                </div>
              </li>
            ))}
          </ul>
          {list.length === 0 && <p className="muted">موردی نیست. با «افزودن» شروع کنید.</p>}
          {def.kind === 'categories' && content && !Array.isArray(content.categories) && (
            <button type="button" className="btn btn--outline" onClick={() => setContent(replaceList(content, 'categories', DEFAULT_CATEGORIES.map((c, i) => ({ ...c, order: i + 1 }))))}>شروع با دسته‌های پیش‌فرض</button>
          )}
          {def.file === 'content' && <p className="muted adm-hint">ترتیب فهرست همان ترتیب نمایش در اپ است (بالاترین = اول)؛ آیتم «همیشه اول» جلوتر می‌آید.</p>}
        </section>
      )}

      {tab === 'messages' && <MessagesTab />}

      {tab === 'settings' && content && (
        <section className="adm-form">
          <div className="adm-field">
            <label htmlFor="hoff">جابه‌جایی تقویم قمری (روز)</label>
            <select id="hoff" value={String(content.hijriOffsetDays ?? 0)} onChange={(e) => setContent(replaceDoc(content, 'hijriOffsetDays', Number(e.target.value)))}>
              {[-2, -1, 0, 1, 2].map((n) => <option key={n} value={n}>{n === 0 ? '۰ (ام‌القری)' : (n > 0 ? '+' : '') + n}</option>)}
            </select>
            <small className="muted">اگر تقویم رسمی ایران یک‌دو روز با ام‌القری فرق داشت، همهٔ مناسبت‌ها را یک‌جا جابه‌جا کنید؛ برای یک مناسبت و یک سال خاص از «تاریخ میلادیِ همین سال» در خود مناسبت استفاده کنید.</small>
          </div>
          <div className="adm-field">
            <label htmlFor="hosts">سایت‌های مجاز برای لینک صوت (هر خط یک دامنه)</label>
            <textarea id="hosts" rows={6} dir="ltr" value={hostsText} onChange={(e) => setContent(replaceDoc(content, 'allowedHosts', linesToList(e.target.value)))} />
            <small className="muted">فقط لینک‌های https از همین دامنه‌ها (و زیردامنه‌هایشان) برای دعا و نوا پذیرفته می‌شود.</small>
          </div>
        </section>
      )}

      {tab === 'history' && (
        <section>
          <p className="muted">آخرین تغییرهای پوشهٔ data/. «بازگردانی» فقط پیش‌نویس را به آن نسخه برمی‌گرداند؛ بعدش باید «انتشار» بزنید.</p>
          {histErr && <p className="field-err" role="alert">{histErr}</p>}
          <ul className="adm-list">
            {(hist ?? []).map((c) => (
              <li key={c.sha} className="adm-item">
                <div className="adm-item__text"><strong>{c.message}</strong><span className="muted" dir="ltr">{c.sha.slice(0, 7)} · {new Date(c.date).toLocaleString('fa-IR')}</span></div>
                <div className="adm-item__btns"><button type="button" onClick={() => void restore(c)}>بازگردانی در پیش‌نویس</button></div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing ? `${editing.index >= 0 ? 'ویرایش' : 'افزودن'} — ${editing.def.label}` : ''}>
        {editing && <ItemEditor def={editing.def} initial={editing.item} initialText={editing.text} isNew={editing.index < 0} ctx={ctx} onSave={saveItem} onCancel={() => setEditing(null)} />}
      </Sheet>

      {(dirty || pub.phase !== 'idle') && (
        <footer className="adm-publish" aria-live="polite">
          {dirty && <p><strong>{dirtyCount} مورد منتشرنشده</strong> ({local ? 'با «انتشار» روی فایل‌های همین کامپیوتر نوشته، commit و push می‌شود' : 'پیش‌نویس فقط روی همین دستگاه است'})</p>}
          {pub.text && <p className={pub.phase === 'failed' ? 'field-err' : ''}>{pub.text}{pub.url && <> <a href={pub.url} target="_blank" rel="noopener noreferrer">مشاهده</a></>}</p>}
          {pub.errors && <ul className="field-err">{pub.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
          {dirty && (
            <div className="adm-publish__row">
              <input value={message} onChange={(e) => setMessage(e.target.value)} aria-label="توضیح تغییر" />
              <button type="button" className="btn" disabled={pub.phase === 'working' || pub.phase === 'watching'} onClick={() => void publish()}>انتشار</button>
            </div>
          )}
        </footer>
      )}
    </div>
  )
}

function replaceDoc(doc: Doc, key: string, value: unknown): Doc {
  return { ...doc, [key]: value }
}
