import { IconExternalLink } from '../../components/icons'
import type { Cause, CauseChannels } from '../../data/types'

const CHANNELS: [keyof CauseChannels, string][] = [
  ['whatsapp', 'واتس‌اپ'],
  ['telegram', 'تلگرام'],
  ['bale', 'بله'],
  ['rubika', 'روبیکا'],
  ['eitaa', 'ایتا'],
  ['website', 'وب‌سایت'],
]

const isHttps = (u: string) => /^https:\/\/[^\s]+$/.test(u)

/** مسئول، تلفن، آدرس (اختیاری) و کانال‌های ارتباطی. هر بخشِ خالی نمایش داده نمی‌شود. */
export function CauseInfo({ cause }: { cause: Pick<Cause, 'contact' | 'channels'> }) {
  const c = cause.contact
  const links = CHANNELS.flatMap(([k, label]) => {
    const url = cause.channels?.[k]
    return url && isHttps(url) ? [{ k, label, url }] : []
  })
  if (!c && links.length === 0) return null
  const tel = c?.phone ? c.phone.replace(/[^\d+]/g, '') : ''
  return (
    <section className="cause-info" aria-label="اطلاعات تماس">
      <h3>تماس و ارتباط</h3>
      {c?.manager && <p><span className="muted">مسئول:</span> <strong>{c.manager}</strong></p>}
      {c?.phone && <p><span className="muted">تلفن:</span> <a href={`tel:${tel}`} dir="ltr"><bdo dir="ltr">{c.phone}</bdo></a></p>}
      {c?.address && <p><span className="muted">آدرس:</span> {c.address}</p>}
      {links.length > 0 && (
        <ul className="cause-channels">
          {links.map((l) => (
            <li key={l.k}>
              <a className="chip" href={l.url} target="_blank" rel="noopener noreferrer">{l.label} <IconExternalLink size={14} aria-hidden /></a>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
