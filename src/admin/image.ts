/** تصویر انتخاب‌شده را کوچک و به webp تبدیل می‌کند (base64 بدون پیشوند data:) تا آپلود از موبایل سبک باشد. */
export async function resizeToWebp(file: File, maxWidth: number, quality = 0.85): Promise<{ base64: string; blobUrl: string }> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, maxWidth / bmp.width)
  const w = Math.max(1, Math.round(bmp.width * scale))
  const h = Math.max(1, Math.round(bmp.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('پردازش تصویر پشتیبانی نمی‌شود')
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/webp', quality))
  if (!blob) throw new Error('تبدیل تصویر انجام نشد')
  const buf = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  for (const b of buf) bin += String.fromCharCode(b)
  return { base64: btoa(bin), blobUrl: URL.createObjectURL(blob) }
}
