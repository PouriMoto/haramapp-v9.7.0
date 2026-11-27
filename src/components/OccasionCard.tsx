import { IconCalendarEvent } from './icons'
import { Link } from 'react-router-dom'
import { useOccasions } from '../content/hooks'

/** پیشنهاد مناسبت فعال (قمری/ranges سالانه) بدون سرور. مناسبت دسته‌دار: فقط اگر آن دسته محتوا دارد و هنوز انتخاب نشده؛ بدون دسته: فقط پیام. */
export function OccasionCard({ active, available }: { active: string | null; available: readonly string[] }) {
  const o = useOccasions().active.find((x) => (x.category ? x.category !== active && available.includes(x.category) : true))
  if (!o) return null
  const text = o.text ?? o.title
  if (!o.category) return <div className="occasion"><IconCalendarEvent size={22} aria-hidden /><span>{text}</span></div>
  return (
    <Link to={`/?cat=${o.category}`} className="occasion">
      <IconCalendarEvent size={22} aria-hidden />
      <span>{text}</span>
    </Link>
  )
}
