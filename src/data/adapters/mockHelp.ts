import type { HelpApi } from '../contract'
import { ApiError } from '../errors'
import seedFile from '../../../data/causes.json'
import type { Cause, CausesFile, Payment } from '../types'
import { matchesCauseName, visibleCauses } from '../causeList'
import { validateBank, validatePayment } from '../validation'

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

type Stored = CausesFile['causes'][number]
// در mock همهٔ مقصدها «آنلاین» هستند تا کل جریان قابل آزمایش باشد (در seed، online برای سرور واقعی است).
interface StoredPayment extends Payment { clientId: string }

/** منبع داده: seed/causes.json (هر ورودی از راه validateBank عبور می‌کند؛ bank خالی حذف می‌شود) */
function loadSeed(file: CausesFile): Stored[] {
  return file.causes.map((c) => ({
    ...c,
    bank: validateBank(c.bank),
    accounts: c.accounts.map((a) => ({ id: a.id, title: a.title, bank: validateBank(a.bank) })),
  }))
}

/** seed: فایل کارت‌ها (پیش‌فرض data/causes.json). تست‌ها fixture خودشان را می‌دهند تا ویرایش دادهٔ مالک تست را نشکند. */
export function createMockHelpApi(opts: { latencyMs?: number; seed?: CausesFile } = {}): HelpApi {
  const wait = () => delay(opts.latencyMs ?? 120)
  const causes: Stored[] = loadSeed(opts.seed ?? (seedFile as CausesFile))
  const payments: StoredPayment[] = []
  let seq = 0

  const paidSum = (causeId: string, accountId?: string) =>
    payments
      .filter((p) => p.status === 'paid' && p.causeId === causeId && (accountId === undefined || p.accountId === accountId))
      .reduce((s, p) => s + p.amountToman, 0)

  const view = (c: Stored): Cause => ({
    ...c,
    online: true,
    accounts: c.accounts.map((a) => ({ ...a, online: true, totalToman: paidSum(c.id, a.id) })),
    totalToman: paidSum(c.id),
  })

  return {
    async listCauses({ q }) {
      await wait()
      return visibleCauses(causes.map(view)).filter((c) => matchesCauseName(c, q ?? ''))
    },
    async getCause(id) {
      await wait()
      const c = causes.find((x) => x.id === id && x.enabled !== false)
      if (!c) throw new ApiError('not_found', 'مقصد پیدا نشد')
      return view(c)
    },
    async startPayment(i) {
      await wait()
      const v = validatePayment(i)
      const c = causes.find((x) => x.id === v.causeId)
      if (!c) throw new ApiError('not_found', 'مقصد پیدا نشد')
      const acc = c.accounts.find((a) => a.id === v.accountId)
      if (c.accounts.length > 0 && !acc) throw new ApiError('validation', 'حساب انتخاب نشده')
      const id = `p${++seq}`
      payments.push({
        id,
        clientId: v.clientId,
        causeId: c.id,
        causeTitle: c.title,
        accountId: acc?.id,
        accountTitle: acc?.title,
        amountToman: v.amountToman,
        status: 'paid', // mock: بلافاصله موفق؛ در واقعیت پس از verify سرور
        createdAt: new Date().toISOString(),
        refId: `MOCK-${id}`,
      })
      return { payUrl: `/help/result?status=ok&id=${id}` }
    },
    async listMyPayments(clientId) {
      await wait()
      return payments
        .filter((p) => p.clientId === clientId)
        .map(({ clientId: _c, ...p }) => p)
        .reverse()
    },
    async getConfig() {
      await wait()
      return { paymentsEnabled: true }
    },
    async getHelpTotal() {
      await wait()
      return { totalToman: payments.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amountToman, 0) }
    },
  }
}
