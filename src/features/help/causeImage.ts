import { resolveMedia } from '../../content/hooks'

/** تصویر کارت؛ مسیر نامعتبر/خراب → undefined (آیکون پیش‌فرض نشان داده می‌شود) */
export function causeImageSrc(image?: string): string | undefined {
  if (!image) return undefined
  try { return resolveMedia(image) } catch { return undefined }
}
