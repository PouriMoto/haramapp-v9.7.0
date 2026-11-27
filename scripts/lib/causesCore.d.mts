export const CHANNEL_KEYS: string[]
export const LIMITS: Record<string, number>
export function normalizeChannel(key: string, raw: unknown): string | null
export interface CausesCoreResult {
  file: { version: 1; causes: Record<string, unknown>[] } | null
  images: string[]
  errors: string[]
  warnings: string[]
}
export function validateCausesCore(raw: unknown, opts?: { imageExists?: (name: string) => Promise<boolean> }): Promise<CausesCoreResult>
