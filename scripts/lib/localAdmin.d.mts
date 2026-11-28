import type { Plugin } from 'vite'
export declare class LocalAdminError extends Error { status: number }
export declare function safeDataPath(p: unknown): string
export declare function applyChanges(root: string, changes: unknown): Promise<{ paths: string[]; undo(): Promise<void> }>
export declare function localCommit(root: string, changes: unknown, message?: string): Promise<{ sha: string; pushed: boolean; pushError?: string }>
export declare function localRead(root: string, path: unknown, at?: string | null): Promise<{ text: string; sha: string } | null>
export declare function localHistory(root: string, limit?: number): Promise<{ sha: string; date: string; message: string }[]>
export declare function isLocalRequest(req: { headers: Record<string, unknown>; socket?: { remoteAddress?: string } }): boolean
export declare function createLocalAdminMiddleware(root: string): (req: never, res: never) => Promise<void>
export declare function localAdminPlugin(): Plugin
