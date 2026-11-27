export interface HijriRange { fromMonth: number; fromDay: number; toMonth: number; toDay: number }
export interface OccasionOut { id: string; title: string; text?: string; category?: string; hijri?: HijriRange; ranges?: { from: string; to: string }[]; priority: number }
export const TARGET_PAGES: Record<string, { path: string; label: string }>
export const TARGET_TYPES: string[]
export function normalizeOccasions(raw: unknown, ctx: { catIds: Set<string> }): { list: OccasionOut[]; errors: string[] }
export function normalizeTarget(
  t: unknown,
  ctx: { prayerIds: Set<string>; causeIds: Set<string> | null; occasions: { id: string; category?: string }[] },
): { href?: string; error?: string }
