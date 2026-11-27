import { useMemo, useState } from 'react'
import { ListState } from '../../components/ListState'
import { SearchBox } from '../../components/SearchBox'
import { useCauses, useHelpTotal } from '../../data/hooks/useHelp'
import { matchesCauseName } from '../../data/causeList'
import { formatToman } from '../../lib/text'
import { CauseCard } from './CauseCard'
import { PaymentsList } from './PaymentsList'

export function HelpPage() {
  const [q, setQ] = useState('')
  const causes = useCauses()
  const total = useHelpTotal()
  // جستجو فقط روی نام مسجد/حسینیه/خیریه
  const list = useMemo(() => (causes.data ?? []).filter((c) => matchesCauseName(c, q)), [causes.data, q])

  return (
    <section>
      <h2 className="page-title">همیاری</h2>

      <div className="help-total" aria-live="polite">
        <span>مجموع کمک‌های مردمی</span>
        <strong>{total.data ? `${formatToman(total.data.totalToman)} تومان` : total.isError ? '—' : '…'}</strong>
      </div>

      <div className="help-tools">
        <SearchBox value={q} onChange={setQ} placeholder="جستجوی نام مسجد، حسینیه یا خیریه" />
      </div>

      <ListState loading={causes.isPending} error={causes.isError} empty={list.length === 0} emptyText={q ? 'موردی با این نام پیدا نشد.' : 'هنوز کارتی اضافه نشده است.'} onRetry={() => void causes.refetch()}>
        <ul className="rows">{list.map((c) => <CauseCard key={c.id} cause={c} />)}</ul>
      </ListState>

      <div className="section-header"><h2>پرداخت‌های من</h2></div>
      <p className="muted" style={{ marginBottom: 8 }}>فقط پرداخت‌هایی که از همین مرورگر انجام داده‌اید نمایش داده می‌شود.</p>
      <PaymentsList />
    </section>
  )
}
