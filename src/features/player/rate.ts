/** سرعت پخش: ۱ → ۱٫۲۵ → ۱٫۵ → ۱٫۷۵ → ۲ → ۱ (مثل تایمر خواب، با هر لمس یک گام) */
export const RATES = [1, 1.25, 1.5, 1.75, 2] as const

export function nextRate(r: number): number {
  const i = RATES.findIndex((x) => x === r)
  return RATES[(i + 1) % RATES.length] // مقدار ناشناخته (i=-1) → ۱
}

export function sanitizeRate(v: unknown): number {
  return typeof v === 'number' && (RATES as readonly number[]).includes(v) ? v : 1
}

/** ۱٫۲۵× با رقم فارسی */
export const rateLabel = (r: number): string => `${r.toLocaleString('fa-IR')}×`
