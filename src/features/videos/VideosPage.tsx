import { useMemo, useState } from 'react'
import { CategoryChips } from '../../components/CategoryChips'
import { ListState } from '../../components/ListState'
import { SearchBox } from '../../components/SearchBox'
import { useCategoryParam } from '../../components/useCategoryParam'
import { useCategories, useVideos } from '../../content/hooks'
import { categoryCounts, inCategory } from '../../content/selectors'
import { normalizeSearch } from '../../lib/text'
import { VideoCard } from './VideoCard'

export function VideosPage() {
  const { data, isPending, isError, refetch } = useVideos()
  const [q, setQ] = useState('')
  const [cat, setCat] = useCategoryParam()
  const categories = useCategories()
  const chips = useMemo(() => categoryCounts(data ?? [], categories), [data, categories])
  const active = cat && chips.some((c) => c.id === cat) ? cat : null
  const rows = useMemo(() => {
    const needle = normalizeSearch(q)
    return inCategory(data ?? [], active).filter((v) => !needle || normalizeSearch(v.title).includes(needle))
  }, [data, q, active])

  return (
    <section>
      <h2 className="page-title">ویدیوها</h2>
      <CategoryChips items={chips} value={active} onChange={setCat} total={data?.length ?? 0} />
      <SearchBox value={q} onChange={setQ} placeholder="جستجو در ویدیوها" />
      <ListState loading={isPending} error={isError} empty={rows.length === 0} emptyText={q ? 'موردی پیدا نشد.' : 'هنوز ویدیویی اضافه نشده است.'} onRetry={() => void refetch()}>
        <ul className="rows">{rows.map((v) => <VideoCard key={v.id} video={v} />)}</ul>
      </ListState>
    </section>
  )
}
