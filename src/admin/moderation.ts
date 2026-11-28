/**
 * تأیید/رد پیام‌های درد و دل از طریق Apps Script (action: adminMessages / adminModerate).
 * ADMIN_TOKEN فقط در حافظهٔ همین تب نگه داشته می‌شود (ذخیره نمی‌شود)؛ در نشست ۷ به Worker منتقل می‌شود.
 * درخواست‌ها POST با text/plain هستند تا توکن در URL/لاگ نیاید و preflight رخ ندهد.
 */
export interface PendingMessage {
  id: string
  createdAt: string
  name: string
  message: string
}

export interface PendingList {
  items: PendingMessage[]
  total: number
}

type Fetch = typeof fetch

async function call<T>(url: string, body: Record<string, unknown>, f: Fetch): Promise<T> {
  if (!url) throw new Error('آدرس Apps Script در data/site.json تنظیم نشده')
  let res: Response
  try {
    res = await f(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), redirect: 'follow' })
  } catch { throw new Error('اتصال برقرار نشد') }
  let j: { ok?: boolean; data?: T; error?: string }
  try { j = (await res.json()) as typeof j } catch { throw new Error('پاسخ سرور نامعتبر است') }
  if (!j.ok) throw new Error(j.error || 'خطای سرور')
  return j.data as T
}

export function createModeration(url: string, adminToken: string, f: Fetch = fetch) {
  return {
    list: () => call<PendingList>(url, { action: 'adminMessages', adminToken }, f),
    approve: (id: string) => call<null>(url, { action: 'adminModerate', adminToken, id, decision: 'approve' }, f),
    reject: (id: string) => call<null>(url, { action: 'adminModerate', adminToken, id, decision: 'reject' }, f),
  }
}
