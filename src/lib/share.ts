import { toast } from '../components/toast'
import { env } from '../config/env'
import { copyText } from './copy'

/** آدرس کامل یک صفحهٔ اپ؛ path با «/» شروع می‌شود. */
export function pageUrl(path = '/'): string {
  return location.origin + env.basePath.replace(/\/$/, '') + path
}

/** اشتراک‌گذاری پیوند اپ؛ اگر Web Share نبود، کپی + toast. path با «/» شروع می‌شود. */
export async function shareLink(title: string, path = '/') {
  const url = pageUrl(path)
  try {
    if (navigator.share) { await navigator.share({ title, url }); return }
  } catch (e) {
    if ((e as DOMException).name === 'AbortError') return
  }
  const ok = await copyText(url)
  toast(ok ? 'پیوند کپی شد' : 'کپی انجام نشد', ok ? 'ok' : 'warn')
}

/**
 * پنجرهٔ اشتراک‌گذاری بومی سیستم‌عامل را باز می‌کند (انتخاب واتس‌اپ/بله/ایتا/پیامک/… توسط خود گوشی).
 * 'done' = اشتراک انجام یا کاربر بست؛ 'unsupported' = مرورگر Web Share ندارد یا خطا داد → UI باید گزینهٔ جایگزین نشان بدهد.
 * فقط روی HTTPS (و localhost) و فقط پس از کلیک کاربر کار می‌کند.
 */
export async function nativeShare(title: string, text: string): Promise<'done' | 'unsupported'> {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return 'unsupported'
  try {
    if (typeof navigator.canShare === 'function' && !navigator.canShare({ title, text })) return 'unsupported'
    await navigator.share({ title, text })
    return 'done'
  } catch (e) {
    return (e as DOMException).name === 'AbortError' ? 'done' : 'unsupported'
  }
}
