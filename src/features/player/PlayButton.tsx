import { IconPlayerPauseFilled, IconPlayerPlayFilled } from '../../components/icons'
import { usePlayer, type Track } from './context'

/** دکمهٔ پخش یکسان برای همهٔ ردیف‌ها (دعا و نوا): همیشه آخرین دکمهٔ ردیف. */
export function PlayButton({ track, title, queue }: { track: Track; title: string; queue?: readonly Track[] }) {
  const { current, playing, play } = usePlayer()
  const on = current?.id === track.id && playing
  return (
    <button type="button" className="row__play" onClick={() => play(track, queue)} aria-label={`${on ? 'توقف' : 'پخش'} ${title}`}>
      {on ? <IconPlayerPauseFilled size={20} aria-hidden /> : <IconPlayerPlayFilled size={20} aria-hidden />}
    </button>
  )
}
