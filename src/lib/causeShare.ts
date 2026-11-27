import type { BankInfo, Cause } from '../data/types'
import { formatCard } from './copy'

function bankLines(b: BankInfo, label?: string): string[] {
  const lines: string[] = []
  if (label) lines.push(`▪️ ${label}`)
  const who = [b.bankName && `بانک ${b.bankName}`, b.ownerName && `به نام ${b.ownerName}`].filter(Boolean).join(' — ')
  if (who) lines.push(who)
  if (b.cardNumber) lines.push(`شماره کارت: ${formatCard(b.cardNumber)}`)
  if (b.iban) lines.push(`شماره شبا: ${b.iban}`)
  return lines
}

/**
 * متن آمادهٔ اشتراک: اول عنوان و اطلاعات حساب (برای واریز سریع)، آخرِ پیام لینک صفحهٔ همین کارت.
 * کارت چندحسابه: همهٔ حساب‌هایی که اطلاعات بانکی دارند، با عنوان هر حساب.
 */
export function buildCauseShareText(cause: Pick<Cause, 'title' | 'bank' | 'accounts'>, url: string): string {
  const blocks: string[] = []
  if (cause.bank) blocks.push(bankLines(cause.bank).join('\n'))
  for (const a of cause.accounts) if (a.bank) blocks.push(bankLines(a.bank, a.title).join('\n'))
  const body = blocks.filter(Boolean).join('\n\n')
  return [`🤲 ${cause.title}`, body, `برای اطلاعات بیشتر و کمک:\n${url}`].filter(Boolean).join('\n\n')
}
