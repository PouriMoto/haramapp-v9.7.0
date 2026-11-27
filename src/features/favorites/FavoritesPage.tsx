import { useMemo, useState } from 'react'
import { ListState } from '../../components/ListState'
import { useManifest } from '../../content/hooks'
import { musicTrack, prayerTrack } from '../../content/tracks'
import { MusicRow } from '../music/MusicRow'
import { PrayerRow } from '../prayers/PrayerRow'
import { VideoCard } from '../videos/VideoCard'
import { FAV_KINDS, favoriteGroups, type FavKind } from './groups'
import { useFavorites } from './store'

export function FavoritesPage() {
  const favs = useFavorites()
  const m = useManifest()
  const [kind, setKind] = useState<FavKind | null>(null)
  const g = useMemo(() => favoriteGroups(favs, m.data ?? { prayers: [], music: [], videos: [] }), [m.data, favs])
  const queue = useMemo(() => g.music.map(musicTrack), [g.music])
  const total = g.prayer.length + g.music.length + g.video.length
  const show = (k: FavKind) => kind === null || kind === k
  const tabs = FAV_KINDS.map((t) => ({ ...t, count: g[t.id].length })).filter((t) => t.count > 0)
  const active = kind && tabs.some((t) => t.id === kind) ? kind : null

  return (
    <section>
      <h2 className="page-title">علاقه‌مندی‌ها</h2>
      <p className="muted">روی همین گوشی ذخیره می‌شوند و جایی ارسال نمی‌شوند.</p>
      {tabs.length > 1 && (
        <div className="cat-chips fav-tabs" role="group" aria-label="نوع علاقه‌مندی">
          <button type="button" className={active === null ? 'cat-chip cat-chip--on' : 'cat-chip'} aria-pressed={active === null} onClick={() => setKind(null)}>همه <small>{total.toLocaleString('fa-IR')}</small></button>
          {tabs.map((t) => (
            <button key={t.id} type="button" className={active === t.id ? 'cat-chip cat-chip--on' : 'cat-chip'} aria-pressed={active === t.id} onClick={() => setKind(t.id)}>{t.title} <small>{t.count.toLocaleString('fa-IR')}</small></button>
          ))}
        </div>
      )}
      <ListState loading={m.isPending} error={m.isError} empty={total === 0} emptyText="هنوز چیزی را با قلب ♡ علامت نزده‌اید." onRetry={() => void m.refetch()}>
        {show('prayer') && g.prayer.length > 0 && <ul className="rows">{g.prayer.map((p) => <PrayerRow key={p.id} prayer={p} track={prayerTrack(p)} />)}</ul>}
        {show('music') && g.music.length > 0 && <ul className="rows" style={{ marginTop: 10 }}>{g.music.map((x, i) => <MusicRow key={x.id} music={x} track={queue[i]} queue={queue} />)}</ul>}
        {show('video') && g.video.length > 0 && <ul className="rows" style={{ marginTop: 10 }}>{g.video.map((v) => <VideoCard key={v.id} video={v} />)}</ul>}
      </ListState>
    </section>
  )
}
