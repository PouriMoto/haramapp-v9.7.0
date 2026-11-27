import { describe, expect, it } from 'vitest'
import { safePayRedirect } from '../src/lib/redirect'
import { buildCauseShareText } from '../src/lib/causeShare'

describe('safePayRedirect', () => {
  it('فقط https مطلق یا مسیر داخلی نتیجه', () => {
    expect(safePayRedirect('https://www.zarinpal.com/pg/StartPay/A1')).toEqual({ kind: 'external', url: 'https://www.zarinpal.com/pg/StartPay/A1' })
    expect(safePayRedirect('/help/result?status=ok&id=p1')).toEqual({ kind: 'internal', to: '/help/result?status=ok&id=p1' })
    for (const bad of ['javascript:alert(1)', 'http://evil.com', '//evil.com/help/result', '/other', 'data:text/html,x', '']) expect(safePayRedirect(bad)).toBeNull()
  })
})

describe('buildCauseShareText', () => {
  const cause = {
    title: 'حسینیهٔ نمونه',
    bank: { bankName: 'ملی', ownerName: 'صاحب نمونه', cardNumber: '6037997112345678', iban: 'IR062010000000123456789012' },
    accounts: [
      { id: 'a', title: 'عمرانی', totalToman: 0, bank: { bankName: 'ملت', ownerName: 'ب', cardNumber: '6104337712345678', iban: '' } },
      { id: 'b', title: 'فرهنگی', totalToman: 0 },
    ],
  }
  it('اول عنوان و اطلاعات حساب، آخر لینک صفحه', () => {
    const t = buildCauseShareText(cause, 'https://haramapp.ir/help/fx')
    expect(t.startsWith('🤲 حسینیهٔ نمونه')).toBe(true)
    expect(t.indexOf('شماره کارت')).toBeLessThan(t.indexOf('https://haramapp.ir/help/fx'))
    expect(t.endsWith('https://haramapp.ir/help/fx')).toBe(true)
    expect(t).toContain('شماره کارت: 6037 9971 1234 5678')
    expect(t).toContain('شماره شبا: IR062010000000123456789012')
    expect(t).toContain('بانک ملی — به نام صاحب نمونه')
  })
  it('حساب‌های دارای بانک با عنوان می‌آیند؛ حساب بدون بانک نه', () => {
    const t = buildCauseShareText(cause, 'https://x.ir/h')
    expect(t).toContain('▪️ عمرانی')
    expect(t).not.toContain('فرهنگی')
  })
  it('کارت بدون هیچ اطلاعات بانکی: فقط عنوان و لینک', () => {
    expect(buildCauseShareText({ title: 'ک', accounts: [] }, 'https://x.ir')).toBe('🤲 ک\n\nبرای اطلاعات بیشتر و کمک:\nhttps://x.ir')
  })
})
