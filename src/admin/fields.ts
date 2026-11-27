import { genId, type Item, type Kind } from './model'

export type FieldType = 'text' | 'textarea' | 'url' | 'number' | 'bool' | 'select' | 'cats' | 'date' | 'image' | 'tel' | 'catOne' | 'ranges' | 'target'

export interface FieldDef {
  key: string // مسیر نقطه‌ای مثل 'bank.cardNumber'
  label: string
  type: FieldType
  required?: boolean
  hint?: string
  ltr?: boolean
  rows?: number
  options?: { v: string; l: string }[]
  /** فقط برای ایجاد (بعد از ساخت قفل می‌شود) */
  createOnly?: boolean
}

export interface KindDef {
  kind: Kind
  label: string
  file: 'content' | 'causes'
  listKey: string
  /** تصویرِ آپلودی در این پوشهٔ data/ ذخیره می‌شود */
  imageDir?: 'banners' | 'causes'
  hasText?: boolean // متن مارک‌داون جدا (دعا)
  fields: FieldDef[]
  titleOf(it: Item): string
  subtitleOf(it: Item): string
  newItem(): Item
}

const s = (v: unknown) => (typeof v === 'string' ? v : '')

export const KINDS: Record<Kind, KindDef> = {
  prayers: {
    kind: 'prayers', label: 'دعاها', file: 'content', listKey: 'prayers', hasText: true,
    fields: [
      { key: 'title', label: 'عنوان', type: 'text', required: true },
      { key: 'id', label: 'شناسه (انگلیسی)', type: 'text', required: true, ltr: true, createOnly: true, hint: 'مثلاً tavassol؛ بعد از ساخت تغییر نمی‌کند' },
      { key: 'audio', label: 'لینک صوت (اختیاری)', type: 'url', ltr: true, hint: 'فقط سایت‌های مجاز (تب تنظیمات)' },
      { key: 'categories', label: 'دسته‌ها', type: 'cats' },
      { key: 'pinned', label: 'همیشه اول نمایش داده شود', type: 'bool' },
    ],
    titleOf: (it) => s(it.title), subtitleOf: (it) => (Array.isArray(it.categories) ? (it.categories as string[]).join('، ') : ''),
    newItem: () => ({ id: genId('prayer'), title: '' }),
  },
  music: {
    kind: 'music', label: 'نواها', file: 'content', listKey: 'music',
    fields: [
      { key: 'title', label: 'عنوان', type: 'text', required: true },
      { key: 'artist', label: 'هنرمند', type: 'text' },
      { key: 'src', label: 'لینک فایل صوتی', type: 'url', required: true, ltr: true, hint: 'فقط سایت‌های مجاز (تب تنظیمات)' },
      { key: 'cover', label: 'لینک تصویر کاور (https)', type: 'url', ltr: true },
      { key: 'categories', label: 'دسته‌ها', type: 'cats' },
      { key: 'pinned', label: 'همیشه اول نمایش داده شود', type: 'bool' },
    ],
    titleOf: (it) => s(it.title), subtitleOf: (it) => s(it.artist),
    newItem: () => ({ title: '' }),
  },
  videos: {
    kind: 'videos', label: 'ویدیوها', file: 'content', listKey: 'videos',
    fields: [
      { key: 'title', label: 'عنوان', type: 'text', required: true },
      { key: 'aparat', label: 'شناسهٔ آپارات', type: 'text', required: true, ltr: true, hint: 'در کد embed، بخش بعد از videohash/ (مثلاً ckn3o4e)' },
      { key: 'poster', label: 'لینک تصویر پوستر (https)', type: 'url', ltr: true },
      { key: 'categories', label: 'دسته‌ها', type: 'cats' },
      { key: 'featured', label: 'ویدیوی معرفی بالای صفحهٔ اصلی (فقط یکی)', type: 'bool' },
      { key: 'pinned', label: 'همیشه اول نمایش داده شود', type: 'bool' },
    ],
    titleOf: (it) => s(it.title), subtitleOf: (it) => s(it.aparat),
    newItem: () => ({ title: '' }),
  },
  banners: {
    kind: 'banners', label: 'بنرها', file: 'content', listKey: 'banners', imageDir: 'banners',
    fields: [
      { key: 'id', label: 'شناسه (انگلیسی)', type: 'text', required: true, ltr: true, createOnly: true },
      { key: 'kind', label: 'نوع', type: 'select', options: [{ v: 'campaign', l: 'کمپین/مراسم' }, { v: 'ad', l: 'تبلیغ' }] },
      { key: 'placement', label: 'محل نمایش', type: 'select', options: [{ v: 'both', l: 'صفحهٔ اصلی و درد و دل' }, { v: 'home', l: 'فقط صفحهٔ اصلی' }, { v: 'messages', l: 'فقط درد و دل' }] },
      { key: 'title', label: 'عنوان', type: 'text' },
      { key: 'text', label: 'متن کوتاه', type: 'text' },
      { key: 'sponsor', label: 'نام حامی (برای تبلیغ)', type: 'text' },
      { key: 'image', label: 'تصویر (نسبت ۳ به ۱)', type: 'image', hint: 'آپلود از گوشی یا لینک https' },
      { key: 'alt', label: 'توضیح تصویر (دسترس‌پذیری)', type: 'text' },
      { key: 'target', label: 'مقصد داخل اپ (کارت همیاری، دعا، مناسبت، صفحه)', type: 'target', hint: 'اگر انتخاب شود، بر «لینک خارجی» اولویت دارد' },
      { key: 'href', label: 'لینک خارجی (اختیاری)', type: 'text', ltr: true, hint: 'https://… (برای مقصد داخلی بالا را استفاده کنید)' },
      { key: 'startsAt', label: 'شروع نمایش', type: 'date' },
      { key: 'endsAt', label: 'پایان نمایش', type: 'date' },
      { key: 'weight', label: 'اولویت (عدد بزرگ‌تر بالاتر)', type: 'number' },
      { key: 'enabled', label: 'فعال', type: 'bool' },
    ],
    titleOf: (it) => s(it.title) || s(it.id), subtitleOf: (it) => [s(it.kind), s(it.endsAt) && `تا ${s(it.endsAt)}`].filter(Boolean).join(' · '),
    newItem: () => ({ id: genId('banner'), kind: 'campaign', placement: 'both', enabled: true }),
  },
  causes: {
    kind: 'causes', label: 'همیاری', file: 'causes', listKey: 'causes', imageDir: 'causes',
    fields: [
      { key: 'title', label: 'نام مسجد / حسینیه / خیریه', type: 'text', required: true },
      { key: 'id', label: 'شناسه (انگلیسی)', type: 'text', required: true, ltr: true, createOnly: true },
      { key: 'description', label: 'خلاصهٔ یک‌خطی (≤۳۰۰ کاراکتر)', type: 'textarea', rows: 2 },
      { key: 'intro', label: 'معرفی کامل (حدود ۳۰۰ کلمه)', type: 'textarea', rows: 9 },
      { key: 'image', label: 'تصویر', type: 'image' },
      { key: 'bank.bankName', label: 'نام بانک', type: 'text' },
      { key: 'bank.ownerName', label: 'نام صاحب حساب', type: 'text' },
      { key: 'bank.cardNumber', label: 'شماره کارت (۱۶ رقم)', type: 'tel', ltr: true },
      { key: 'bank.iban', label: 'شماره شبا (IR…)', type: 'text', ltr: true },
      { key: 'payLink', label: 'لینک پرداخت آنلاین (https)', type: 'url', ltr: true, hint: 'لینک عمومی درگاه؛ مرچنت‌کد را اینجا نگذارید' },
      { key: 'contact.manager', label: 'مسئول (اختیاری)', type: 'text' },
      { key: 'contact.phone', label: 'تلفن (اختیاری)', type: 'tel', ltr: true },
      { key: 'contact.address', label: 'آدرس (اختیاری)', type: 'text' },
      { key: 'channels.whatsapp', label: 'واتس‌اپ (شماره یا لینک)', type: 'text', ltr: true },
      { key: 'channels.telegram', label: 'تلگرام (@شناسه یا لینک)', type: 'text', ltr: true },
      { key: 'channels.bale', label: 'بله (شناسه یا لینک)', type: 'text', ltr: true },
      { key: 'channels.rubika', label: 'روبیکا (شناسه یا لینک)', type: 'text', ltr: true },
      { key: 'channels.eitaa', label: 'ایتا (شناسه یا لینک)', type: 'text', ltr: true },
      { key: 'channels.website', label: 'وب‌سایت', type: 'text', ltr: true },
      { key: 'order', label: 'ترتیب (عدد کوچک‌تر بالاتر)', type: 'number' },
      { key: 'enabled', label: 'نمایش در اپ', type: 'bool' },
    ],
    titleOf: (it) => s(it.title), subtitleOf: (it) => s(it.description).slice(0, 60),
    newItem: () => ({ id: genId('cause'), title: '', enabled: true, online: false, accounts: [] }),
  },
  occasions: {
    kind: 'occasions', label: 'مناسبت‌ها', file: 'content', listKey: 'occasions',
    fields: [
      { key: 'title', label: 'عنوان مناسبت', type: 'text', required: true },
      { key: 'id', label: 'شناسه (انگلیسی)', type: 'text', required: true, ltr: true, createOnly: true, hint: 'مثلاً reza-martyr' },
      { key: 'text', label: 'پیام کارت صفحهٔ اصلی (≤۱۶۰ کاراکتر)', type: 'text' },
      { key: 'category', label: 'دستهٔ مرتبط (آیتم‌های این دسته در این روزها جلوتر می‌آیند)', type: 'catOne' },
      { key: 'hijri.fromMonth', label: 'قمری: از ماه (۱ تا ۱۲؛ محرم=۱، صفر=۲، رمضان=۹)', type: 'number' },
      { key: 'hijri.fromDay', label: 'قمری: از روز', type: 'number' },
      { key: 'hijri.toMonth', label: 'قمری: تا ماه (خالی = همان ماه شروع)', type: 'number' },
      { key: 'hijri.toDay', label: 'قمری: تا روز', type: 'number' },
      { key: 'ranges', label: 'تاریخ میلادیِ همین سال (اختیاری؛ جایگزین قاعدهٔ قمری همان سال)', type: 'ranges', hint: 'هر خط: 2026-12-01 تا 2026-12-10 (از تقویم رسمی)' },
      { key: 'priority', label: 'اولویت (عدد بزرگ‌تر بالاتر)', type: 'number' },
      { key: 'enabled', label: 'فعال', type: 'bool' },
    ],
    titleOf: (it) => s(it.title), subtitleOf: (it) => {
      const h = it.hijri as Record<string, number> | undefined
      return [h ? `قمری ${h.fromMonth}/${h.fromDay} تا ${h.toMonth ?? h.fromMonth}/${h.toDay}` : '', Array.isArray(it.ranges) && it.ranges.length ? 'بازهٔ میلادی' : ''].filter(Boolean).join(' · ')
    },
    newItem: () => ({ id: genId('occ'), title: '', enabled: true, priority: 10 }),
  },
  categories: {
    kind: 'categories', label: 'دسته‌ها', file: 'content', listKey: 'categories',
    fields: [
      { key: 'title', label: 'عنوان دسته', type: 'text', required: true },
      { key: 'id', label: 'شناسه (انگلیسی)', type: 'text', required: true, ltr: true, createOnly: true },
      { key: 'order', label: 'ترتیب نمایش (کوچک‌تر اول)', type: 'number' },
    ],
    titleOf: (it) => s(it.title), subtitleOf: (it) => s(it.id),
    newItem: () => ({ id: genId('cat'), title: '' }),
  },
}

export const KIND_ORDER: Kind[] = ['prayers', 'music', 'videos', 'banners', 'causes', 'occasions', 'categories']
