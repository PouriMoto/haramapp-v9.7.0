export interface Message {
  id: string
  name: string
  message: string
  createdAt: string // ISO
  /** 'preset' = جملهٔ آمادهٔ سرور؛ 'text' = متن آزاد (تأییدشده) */
  kind?: 'preset' | 'text'
}

/** نتیجهٔ ثبت: جملهٔ آماده فوراً منتشر می‌شود، متن آزاد در انتظار تأیید مدیر می‌ماند */
export interface PostMessageResult {
  status: 'published' | 'pending'
}

/** جملهٔ آمادهٔ درد و دل (data/presets.json) */
export interface MessagePreset {
  id: string
  text: string
}

export interface Page<T> {
  items: T[]
  nextCursor: string | null
}

export interface Stats {
  salavat: number
  messages: number
}

export interface NewMessage {
  name?: string
  phone?: string
  message: string
  /** اگر پر باشد، متن سمت سرور از روی این شناسه گذاشته می‌شود و message نادیده گرفته می‌شود */
  presetId?: string
  website?: string // honeypot: باید خالی بماند
}

/** اطلاعات واریز مستقیم (عمومی است؛ برای کسانی که از لینک پرداخت نمی‌کنند) */
export interface BankInfo {
  bankName: string
  ownerName: string
  cardNumber: string // ۱۶ رقم، فقط لاتین
  iban: string // IR + ۲۴ رقم
}

export interface CauseAccount {
  id: string
  title: string // مثلاً «عمرانی»
  totalToman: number
  bank?: BankInfo
  /** پرداخت آنلاین برای این حساب فعال است (مرچنت جدا تنظیم شده) */
  online?: boolean
}

/** کانال‌های ارتباطی؛ مقدارها در build به لینک https کامل نرمال شده‌اند */
export interface CauseChannels {
  whatsapp?: string
  telegram?: string
  bale?: string
  rubika?: string
  eitaa?: string
  website?: string
}

export interface CauseContact {
  manager?: string
  phone?: string
  address?: string
}

/** فیلدهای معرفی کارت؛ مرجع آن‌ها data/causes.json است (نه شیت) */
export interface CauseProfile {
  image?: string // مسیر نسبی (causes/x.webp) یا لینک https
  intro?: string // معرفی حدود ۳۰۰ کلمه
  contact?: CauseContact
  channels?: CauseChannels
  payLink?: string // لینک پرداخت مستقیم (https)
  order?: number
  enabled?: boolean // false = در اپ نمایش داده نمی‌شود
}

export interface Cause extends CauseProfile {
  id: string
  title: string
  description?: string
  totalToman: number
  bank?: BankInfo // کارت تک‌حساب
  online?: boolean // پرداخت آنلاین برای کارت تک‌حساب فعال است
  accounts: CauseAccount[] // خالی = کارت تک‌حساب
}

/** شکل فایل causes.json (خروجی build) */
export interface CausesFile {
  version: 1
  causes: (CauseProfile & { id: string; title: string; description?: string; bank?: BankInfo; online?: boolean; accounts: { id: string; title: string; bank?: BankInfo; online?: boolean }[] })[]
}

export interface Payment {
  id: string
  causeId: string
  causeTitle: string
  accountId?: string
  accountTitle?: string
  amountToman: number
  status: 'pending' | 'paid' | 'failed'
  createdAt: string
  refId?: string
}

/** تنظیمات زندهٔ همیاری از سرور (بدون نیاز به build مجدد) */
export interface HelpConfig {
  paymentsEnabled: boolean
}

export interface StartPaymentInput {
  causeId: string
  accountId?: string
  amountToman: number
  clientId: string
}
