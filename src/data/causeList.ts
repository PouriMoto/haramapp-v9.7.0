import { normalizeSearch } from '../lib/text'
import type { Cause } from './types'

/** فقط کارت‌های فعال، به ترتیب `order` (هم‌ترازها به ترتیب اصلی فایل) */
export function visibleCauses<T extends Pick<Cause, 'enabled' | 'order'>>(list: T[]): T[] {
  return list
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.enabled !== false)
    .sort((a, b) => (a.c.order ?? Number.MAX_SAFE_INTEGER) - (b.c.order ?? Number.MAX_SAFE_INTEGER) || a.i - b.i)
    .map(({ c }) => c)
}

/** جستجو فقط روی نام مسجد/حسینیه/خیریه (عنوان کارت)؛ نه متن توضیح، حساب‌ها یا نام صاحب حساب */
export function matchesCauseName(c: Pick<Cause, 'title'>, q: string): boolean {
  const needle = normalizeSearch(q)
  return !needle || normalizeSearch(c.title).includes(needle)
}
