/**
 * گاوصندوق توکن: توکن GitHub هرگز به‌صورت متن ساده ذخیره نمی‌شود.
 * با رمز مدیر (PBKDF2-SHA256 → AES-GCM-256) رمز می‌شود و فقط شکل رمزشده در localStorage می‌ماند؛
 * نسخهٔ باز فقط در حافظهٔ همین تب است و با قفل خودکار/خروج پاک می‌شود.
 */
const ITERATIONS = 310_000
const KEY = 'haram.admin.vault.v1'

export interface VaultBlob {
  v: 1
  salt: string
  iv: string
  ct: string
}

export interface VaultMeta {
  owner: string
  repo: string
  branch: string
}

export interface StoredVault {
  meta: VaultMeta
  blob: VaultBlob
}

const b64 = (buf: ArrayBuffer | Uint8Array): string => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}
const unb64 = (s: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptToken(token: string, password: string): Promise<VaultBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt)
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(token))
  return { v: 1, salt: b64(salt), iv: b64(iv), ct: b64(ct) }
}

/** رمز اشتباه = خطا (AES-GCM تأیید اصالت دارد) */
export async function decryptToken(blob: VaultBlob, password: string): Promise<string> {
  const key = await deriveKey(password, unb64(blob.salt))
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(blob.iv) }, key, unb64(blob.ct))
    return new TextDecoder().decode(pt)
  } catch {
    throw new Error('رمز اشتباه است')
  }
}

export function loadVault(): StoredVault | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const j = JSON.parse(raw) as StoredVault
    return j?.blob?.v === 1 && j.meta?.owner && j.meta?.repo ? j : null
  } catch {
    return null
  }
}

export function saveVault(v: StoredVault): void {
  try { localStorage.setItem(KEY, JSON.stringify(v)) } catch { /* حالت خصوصی مرورگر */ }
}

export function clearVault(): void {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}
