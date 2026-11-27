import { IconCopy } from '../../components/icons'
import { Sheet } from '../../components/Sheet'
import { toast } from '../../components/toast'
import { copyText } from '../../lib/copy'

/** جایگزین اشتراک بومی (دسکتاپ/مرورگر بدون Web Share): پیوند مستقیم به پیام‌رسان‌ها + کپی. */
export function ShareSheet({ open, onClose, title, text, url }: { open: boolean; onClose(): void; title: string; text: string; url: string }) {
  const enc = encodeURIComponent
  const textNoUrl = text.replace(url, '').trim()
  const targets = [
    { label: 'واتس‌اپ', href: `https://wa.me/?text=${enc(text)}` },
    { label: 'تلگرام', href: `https://t.me/share/url?url=${enc(url)}&text=${enc(textNoUrl)}` },
    { label: 'پیامک', href: `sms:?&body=${enc(text)}` },
  ]
  const copy = async () => {
    const ok = await copyText(text)
    toast(ok ? 'متن اشتراک کپی شد' : 'کپی انجام نشد', ok ? 'ok' : 'warn')
    if (ok) onClose()
  }
  return (
    <Sheet open={open} onClose={onClose} title={`اشتراک‌گذاری — ${title}`}>
      <p className="muted">برای ارسال در بله، ایتا و روبیکا، «کپی متن» را بزنید و در همان برنامه بچسبانید (روی گوشی، دکمهٔ اشتراک مستقیم همهٔ برنامه‌ها را نشان می‌دهد).</p>
      <ul className="share-targets">
        {targets.map((t) => (
          <li key={t.label}><a className="btn btn--block" href={t.href} target="_blank" rel="noopener noreferrer">{t.label}</a></li>
        ))}
        <li><button type="button" className="btn btn--block btn--icon btn--outline" onClick={() => void copy()}><IconCopy size={18} aria-hidden /> کپی متن</button></li>
      </ul>
    </Sheet>
  )
}
