export declare const PRESET_LIMITS: { min: number; max: number; textMax: number }
export declare function normalizePresets(raw: unknown): { presets: { id: string; text: string }[]; errors: string[]; warnings: string[] }
