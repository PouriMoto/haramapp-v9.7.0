import type { Manifest } from '../../content/types'

export type FavKind = 'prayer' | 'music' | 'video'
export const FAV_KINDS: { id: FavKind; title: string }[] = [
  { id: 'prayer', title: 'دعاها' },
  { id: 'music', title: 'نواها' },
  { id: 'video', title: 'ویدیوها' },
]

/** علاقه‌مندی‌ها (شناسه‌های `prayer:<id>` / `music:<id>` / `video:<id>`) به تفکیک نوع؛ موردِ حذف‌شده از محتوا نادیده گرفته می‌شود. */
export function favoriteGroups(favs: readonly string[], m: Pick<Manifest, 'prayers' | 'music' | 'videos'>) {
  const has = (k: FavKind, id: string) => favs.includes(`${k}:${id}`)
  return {
    prayer: m.prayers.filter((p) => has('prayer', p.id)),
    music: m.music.filter((x) => has('music', x.id)),
    video: m.videos.filter((v) => has('video', v.id)),
  }
}
