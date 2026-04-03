import type { BackgroundLibraryImage } from '../store/types'

export const BACKGROUND_LIBRARY_ASSETS_SUBDIR = 'reference/backgrounds'

export function newBackgroundLibraryImageId(): string {
    return globalThis.crypto?.randomUUID?.() ?? `bg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

export function normalizeBackgroundLibrary(input: unknown): BackgroundLibraryImage[] {
    if (!Array.isArray(input)) return []
    const out: BackgroundLibraryImage[] = []
    for (const raw of input) {
        if (!raw || typeof raw !== 'object') continue
        const r = raw as Record<string, unknown>
        const id = typeof r.id === 'string' && r.id.trim() ? r.id.trim() : ''
        const name = typeof r.name === 'string' ? r.name : '背景'
        const rel = typeof r.relativePath === 'string' ? r.relativePath.trim() : ''
        const addedAt = typeof r.addedAt === 'string' ? r.addedAt : new Date().toISOString()
        if (id && rel) {
            out.push({ id, name, relativePath: rel.replace(/\\/g, '/'), addedAt })
        }
    }
    return out
}
