import type { ReferenceCharacter, ReferenceCharacterImage } from '../store/types'

export function newReferenceCharacterId(): string {
    return globalThis.crypto?.randomUUID?.() ?? `rc_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

export function newReferenceImageId(): string {
    return globalThis.crypto?.randomUUID?.() ?? `ri_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

export function normalizeReferenceCharacters(input: unknown): ReferenceCharacter[] {
    if (!Array.isArray(input)) return []
    const out: ReferenceCharacter[] = []
    for (const raw of input) {
        if (!raw || typeof raw !== 'object') continue
        const r = raw as Record<string, unknown>
        const id = typeof r.id === 'string' && r.id.trim() ? r.id.trim() : ''
        if (!id) continue
        const name = typeof r.name === 'string' ? r.name : 'キャラクター'
        const positivePrompt = typeof r.positivePrompt === 'string' ? r.positivePrompt : ''
        const negativePrompt = typeof r.negativePrompt === 'string' ? r.negativePrompt : ''
        const imagesRaw = r.images
        const images: ReferenceCharacterImage[] = []
        if (Array.isArray(imagesRaw)) {
            for (const im of imagesRaw) {
                if (!im || typeof im !== 'object') continue
                const o = im as Record<string, unknown>
                const iid = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : ''
                const rel = typeof o.relativePath === 'string' ? o.relativePath.trim() : ''
                const addedAt = typeof o.addedAt === 'string' ? o.addedAt : new Date().toISOString()
                if (iid && rel) images.push({ id: iid, relativePath: rel.replace(/\\/g, '/'), addedAt })
            }
        }
        out.push({ id, name, positivePrompt, negativePrompt, images })
    }
    return out
}

export function referenceAssetsSubdir(characterId: string): string {
    const safe = characterId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80)
    return `reference/characters/${safe || 'unknown'}`
}
