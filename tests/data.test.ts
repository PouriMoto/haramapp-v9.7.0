import { describe, expect, it } from 'vitest'
import { createMockApi } from '../src/data/adapters/mock'
import { createMockHelpApi } from '../src/data/adapters/mockHelp'
import { parseToman, validateBank, validateMessage, validatePayment } from '../src/data/validation'
import { normalizeSearch } from '../src/lib/text'
// تست‌ها عمداً به data/causes.json (دادهٔ واقعی مالک) وابسته نیستند؛ فقط fixture.
import causesSeed from './fixtures/causes.json'
import type { CausesFile } from '../src/data/types'

const SEED = causesSeed as unknown as CausesFile
const mk = () => createMockHelpApi({ latencyMs: 0, seed: SEED })

describe('validation', () => {
  it('پیام کوتاه/بلند و موبایل نامعتبر رد می‌شود', () => {
    expect(() => validateMessage({ message: 'ab' })).toThrow()
    expect(() => validateMessage({ message: 'x'.repeat(1001) })).toThrow()
    expect(() => validateMessage({ message: 'سلام آقا', phone: '123' })).toThrow()
    expect(validateMessage({ message: ' سلام آقا ', phone: '۰۹۱۲۳۴۵۶۷۸۹' }).phone).toBe('09123456789')
  })
  it('مبلغ', () => {
    expect(parseToman('۱۰۰٬۰۰۰')).toBe(100000)
    expect(() => parseToman('abc')).toThrow()
    const base = { causeId: 'a', clientId: 'c' }
    expect(() => validatePayment({ ...base, amountToman: 5 })).toThrow()
    expect(() => validatePayment({ ...base, amountToman: 1e12 })).toThrow()
    expect(validatePayment({ ...base, amountToman: 50000 }).amountToman).toBe(50000)
  })
})

describe('mock api', () => {
  it('صفحه‌بندی تا انتها', async () => {
    const api = createMockApi({ latencyMs: 0 })
    let cursor: string | undefined
    let n = 0
    for (let i = 0; i < 10; i++) {
      const p = await api.listMessages({ cursor, limit: 10 })
      n += p.items.length
      if (!p.nextCursor) break
      cursor = p.nextCursor
    }
    expect(n).toBe(27)
  })
  it('صلوات یکی زیاد می‌شود', async () => {
    const api = createMockApi({ latencyMs: 0 })
    const a = await api.getStats()
    expect((await api.addSalavat()).salavat).toBe(a.salavat + 1)
    expect((await api.addSalavat(10)).salavat).toBe(a.salavat + 11)
    await expect(api.addSalavat(0)).rejects.toThrow()
  })
})

describe('mock help', () => {
  it('کارت‌های اولیه و جستجو', async () => {
    const h = mk()
    // کارت غیرفعال (enabled:false) نمایش داده نمی‌شود
    expect(await h.listCauses({})).toHaveLength(causesSeed.causes.filter((c) => (c as { enabled?: boolean }).enabled !== false).length)
    expect(await h.listCauses({ q: 'جهادی' })).toHaveLength(1)
    expect(await h.listCauses({ q: 'zzz' })).toHaveLength(0)
  })

  it('جستجو فقط روی نام کارت است؛ نه توضیح، حساب‌ها یا نام صاحب حساب', async () => {
    const h = mk()
    expect(await h.listCauses({ q: 'آزمایشی' })).toHaveLength(0) // فقط در description
    expect(await h.listCauses({ q: 'عمرانی' })).toHaveLength(0) // عنوان حساب
    expect(await h.listCauses({ q: 'صاحب نمونه' })).toHaveLength(0) // نام صاحب حساب
    expect(await h.listCauses({ q: 'حسینیه' })).toHaveLength(1)
  })

  it('کارت غیرفعال با getCause هم پیدا نمی‌شود و ترتیب از order است', async () => {
    const h = mk()
    await expect(h.getCause('fx-hidden')).rejects.toThrow()
    expect((await h.listCauses({})).map((c) => c.id)).toEqual(['fx-multi', 'fx-hoseiniyeh', 'fx-jihadi'])
    expect((await h.getCause('fx-hoseiniyeh')).channels?.telegram).toBe('https://t.me/fxhoseini')
  })

  it('پرداخت، جمع کل و پرداخت‌های من', async () => {
    const h = mk()

    // causeهایی که bank دارند (برای پرداخت معتبر لازم است)
    const bankCauses = causesSeed.causes.filter((c) => c.bank?.cardNumber)
    expect(bankCauses.length).toBeGreaterThanOrEqual(1)
    const withBank = bankCauses[0]

    // cause چندحسابه (اگر وجود داشته باشد)
    const multi = causesSeed.causes.find((c) => (c.accounts?.length ?? 0) > 0)

    // پرداخت اول به cause دارای bank
    await h.startPayment({ causeId: withBank.id, amountToman: 100000, clientId: 'dev-A' })

    // پرداخت دوم به اولین حساب multi (در صورت وجود)
    if (multi) {
      const acc = multi.accounts[0]
      await h.startPayment({ causeId: multi.id, accountId: acc.id, amountToman: 50000, clientId: 'dev-B' })

      // پرداخت تکراری بدون accountId باید رد شود
      await expect(
        h.startPayment({ causeId: multi.id, amountToman: 50000, clientId: 'dev-B' })
      ).rejects.toThrow()
    }

    const expectedTotal = multi ? 150000 : 100000
    expect((await h.getHelpTotal()).totalToman).toBe(expectedTotal)

    if (multi) {
      const acc = multi.accounts[0]
      expect((await h.getCause(multi.id)).accounts.find((a) => a.id === acc.id)?.totalToman).toBe(50000)
    }

    const mine = await h.listMyPayments('dev-A')
    expect(mine).toHaveLength(1)
    expect(mine[0]).not.toHaveProperty('clientId')
  })

  it('داده‌محور: seed از JSON و bank خالی حذف می‌شود', async () => {
    const h = mk()
    const list = await h.listCauses({})

    const seedIds = ['fx-multi', 'fx-hoseiniyeh', 'fx-jihadi'] // به ترتیب order، بدون کارت غیرفعال
    expect(list.map((c) => c.id)).toEqual(seedIds)

    const seedById = new Map(causesSeed.causes.map((c) => [c.id, c]))

    const isBankEmpty = (bank?: Record<string, unknown>) =>
      !bank || Object.values(bank).every((v) => !v || v === '')

    const assertBank = (actual: any, seedBank: any, label: string) => {
      if (isBankEmpty(seedBank)) {
        expect(actual, `${label}: bank خالی باید حذف شود`).toBeUndefined()
      } else {
        expect(actual, `${label}: bank باید حفظ شود`).toBeDefined()
        expect(actual?.cardNumber).toBe(seedBank.cardNumber)
        expect(actual?.iban ?? '').toBe(seedBank.iban ?? '')
        expect(actual?.ownerName ?? '').toBe(seedBank.ownerName ?? '')
        expect(actual?.bankName ?? '').toBe(seedBank.bankName ?? '')
      }
    }

    for (const cause of list) {
      const seed = seedById.get(cause.id)
      if (!seed) continue
      assertBank(cause.bank, seed.bank, `cause:${cause.id}`)

      if (seed.accounts?.length) {
        expect(cause.accounts.map((a) => a.title)).toEqual(seed.accounts.map((a) => a.title))
      }

      for (const acc of cause.accounts ?? []) {
        const seedAcc = (seed.accounts ?? []).find((a) => a.id === acc.id)
        if (!seedAcc) continue
        assertBank(acc.bank, seedAcc.bank, `cause:${cause.id}/account:${acc.id}`)
      }
    }
  })

  it('bank: نرمال‌سازی و اعتبارسنجی', () => {
    expect(
      validateBank({
        bankName: ' ملی ',
        ownerName: 'الف',
        cardNumber: '۶۰۳۷ ۹۹۷۱ ۱۲۳۴ ۵۶۷۸',
        iban: 'ir ۰۶۲۰۱۰۰۰۰۰۰۰۱۲۳۴۵۶۷۸۹۰۱۲',
      })
    ).toEqual({
      bankName: 'ملی',
      ownerName: 'الف',
      cardNumber: '6037997112345678',
      iban: 'IR062010000000123456789012',
    })
    expect(validateBank({ bankName: '', ownerName: '', cardNumber: '', iban: '' })).toBeUndefined()
    expect(() => validateBank({ bankName: '', ownerName: '', cardNumber: '123', iban: '' })).toThrow()
    expect(() => validateBank({ bankName: '', ownerName: '', cardNumber: '', iban: 'IR12' })).toThrow()
  })
})

describe('text', () => {
  it('normalizeSearch', () => expect(normalizeSearch('كتاب‌خانه ۱')).toBe('کتاب خانه 1'))
})

describe('mock help: کلید و upsert', () => {
  it('getConfig و online، و upsert با id', async () => {
    const h = mk()
    expect(await h.getConfig()).toEqual({ paymentsEnabled: true })
    // mock به‌صورت پیش‌فرض online را true می‌دهد (رفتار mock مستقل از seed)
    expect((await h.listCauses({}))[0].online).toBe(true)
  })
})

import { mergeCauses } from '../src/data/adapters/appsScript'
describe('mergeCauses (ایستا + شیت)', () => {
  const file = {
    version: 1 as const,
    causes: [
      { id: 'a', title: 'الف', intro: 'معرفی', channels: { bale: 'https://ble.ir/x' }, accounts: [] },
      { id: 'm', title: 'چندحسابه', accounts: [{ id: 'x', title: 'ایکس' }] },
      { id: 'off', title: 'خاموش', enabled: false, accounts: [] },
    ],
  }
  it('ایستا مرجع همهٔ فیلدهاست؛ شیت فقط مبلغ و online', () => {
    const live = [
      { id: 'a', title: 'قدیمی', totalToman: 500, online: true, accounts: [] },
      { id: 'm', title: 'م', totalToman: 0, online: false, accounts: [{ id: 'x', title: 'x', totalToman: 70, online: true }] },
    ]
    const r = mergeCauses(file, live)
    expect(r.map((c) => [c.id, c.title])).toEqual([['a', 'الف'], ['m', 'چندحسابه']])
    expect(r[0]).toMatchObject({ totalToman: 500, online: true, intro: 'معرفی', channels: { bale: 'https://ble.ir/x' } })
    expect(r[1].accounts[0]).toMatchObject({ totalToman: 70, online: true })
  })
  it('باگ کارت شبح: ردیفِ فقط-شیتی (حذف‌شده از فایل) دیگر نمایش داده نمی‌شود', () => {
    const live = [{ id: 'ghost', title: 'شبح', totalToman: 0, online: true, accounts: [] }]
    expect(mergeCauses(file, live).map((c) => c.id)).toEqual(['a', 'm'])
  })
  it('شیت در دسترس نیست → کارت‌های ایستا با آنلاین=خاموش', () => {
    const r = mergeCauses(file, [])
    expect(r).toHaveLength(2)
    expect(r.every((c) => c.online === false && c.totalToman === 0)).toBe(true)
  })
})
