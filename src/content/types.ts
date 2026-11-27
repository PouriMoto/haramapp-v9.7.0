export interface Banner {
  id: string
  kind: 'ad' | 'campaign'
  placement: 'home' | 'messages' | 'both'
  image?: string
  title?: string
  text?: string
  alt?: string
  sponsor?: string
  href?: string
  startsAt?: string
  endsAt?: string
  weight: number
}

export interface HijriRange { fromMonth: number; fromDay: number; toMonth: number; toDay: number }

/** مناسبت (data/content.json → occasions). hijri = قاعدهٔ سالانه؛ ranges = بازهٔ میلادیِ ویژهٔ یک سال (جایگزین hijri همان سال) */
export interface OccasionDef {
  id: string
  title: string
  text?: string
  category?: string
  hijri?: HijriRange
  ranges?: { from: string; to: string }[]
  priority: number
}

export interface Category {
  id: string
  title: string
  order: number
}

export interface Prayer {
  id: string
  title: string
  text: string // مسیر نسبی داخل رسانه
  audio?: string
  order: number
  pinned: boolean
  categories: string[]
  addedAt: string
}

export interface Music {
  id: string
  title: string
  artist: string
  src: string
  cover?: string
  order: number
  pinned: boolean
  categories: string[]
  addedAt: string
}

export interface HeroVideo {
  src: string
  poster?: string
}

/** ویدیوی آپارات؛ aparat = شناسهٔ ویدیو (مثلاً ckn3o4e) */
export interface VideoItem {
  id: string
  title: string
  aparat: string
  poster?: string
  featured: boolean // ویدیوی معرفی؛ اول صفحهٔ اصلی
  order: number
  pinned: boolean
  categories: string[]
  addedAt: string
}

export interface Manifest {
  version: 1
  generatedAt: string
  video?: HeroVideo
  categories: Category[]
  occasions: OccasionDef[]
  /** جابه‌جایی تقویم قمری (روز)، برای هماهنگی با اعلام رسمی؛ -۲ تا ۲ */
  hijriOffsetDays: number
  banners: Banner[]
  videos: VideoItem[]
  prayers: Prayer[]
  music: Music[]
}
