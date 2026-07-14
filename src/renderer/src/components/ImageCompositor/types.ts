import type { ReferenceCharacter } from '../../store/types'

export type LayerTransform = {
    x: number
    y: number
    scaleX: number
    scaleY: number
    rotation: number
}

export const defaultTransform = (): LayerTransform => ({
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: 0
})

/** 長辺を基準にキャンバス寸法を決める（最大辺 1200px 前後） */
export const LONG_EDGE = 1200

export type AspectPreset = {
    id: string
    label: string
    category: '横長' | '縦長' | '正方形'
    wRatio: number
    hRatio: number
}

export const ASPECT_PRESETS: AspectPreset[] = [
    { id: 'land-3-1', label: '横 3:1（既定）', category: '横長', wRatio: 3, hRatio: 1 },
    { id: 'land-4-1', label: '横 4:1', category: '横長', wRatio: 4, hRatio: 1 },
    { id: 'land-4-3', label: '横 4:3', category: '横長', wRatio: 4, hRatio: 3 },
    { id: 'land-16-9', label: '横 16:9', category: '横長', wRatio: 16, hRatio: 9 },
    { id: 'port-1-3', label: '縦 1:3', category: '縦長', wRatio: 1, hRatio: 3 },
    { id: 'port-1-4', label: '縦 1:4', category: '縦長', wRatio: 1, hRatio: 4 },
    { id: 'port-3-4', label: '縦 3:4', category: '縦長', wRatio: 3, hRatio: 4 },
    { id: 'port-9-16', label: '縦 9:16', category: '縦長', wRatio: 9, hRatio: 16 },
    { id: 'sq-1-1', label: '1:1', category: '正方形', wRatio: 1, hRatio: 1 }
]

export function canvasSizeFromPreset(p: AspectPreset): { w: number; h: number } {
    const { wRatio: wr, hRatio: hr } = p
    if (wr === hr) {
        const s = Math.min(LONG_EDGE, 1000)
        return { w: s, h: s }
    }
    if (wr > hr) {
        const w = LONG_EDGE
        const h = Math.max(200, Math.round((LONG_EDGE * hr) / wr))
        return { w, h }
    }
    const h = LONG_EDGE
    const w = Math.max(200, Math.round((LONG_EDGE * wr) / hr))
    return { w, h }
}

export type RefImageOption = {
    key: string
    characterName: string
    relativePath: string
}

export function flattenReferenceImages(chars: ReferenceCharacter[]): RefImageOption[] {
    const out: RefImageOption[] = []
    for (const c of chars) {
        for (const im of c.images) {
            out.push({
                key: `${c.id}:${im.id}`,
                characterName: c.name,
                relativePath: im.relativePath
            })
        }
    }
    return out
}

export function newInstanceId(): string {
    return globalThis.crypto?.randomUUID?.() ?? `ci_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

export type CompositorCharInstance = {
    instanceId: string
    relativePath: string
    label: string
    transform: LayerTransform
    /** true なら初回の自動スケール済み（Undo 復元時は true のまま保持） */
    layoutResolved?: boolean
}

export type CompositorSnapshot = {
    aspectPresetId: string
    canvasW: number
    canvasH: number
    bgLibraryId: string | null
    /** 内蔵スクリーントーン背景の ID（背景ライブラリ画像とは排他）。null で未使用。 */
    bgToneId: string | null
    /** トーンのタイル倍率 */
    bgToneScale: number
    bgT: LayerTransform
    charInstances: CompositorCharInstance[]
    selected: 'bg' | string | null
}

export const MAX_UNDO = 50

export function cloneSnapshot(s: CompositorSnapshot): CompositorSnapshot {
    return {
        aspectPresetId: s.aspectPresetId,
        canvasW: s.canvasW,
        canvasH: s.canvasH,
        bgLibraryId: s.bgLibraryId,
        bgToneId: s.bgToneId,
        bgToneScale: s.bgToneScale,
        bgT: { ...s.bgT },
        charInstances: s.charInstances.map((c) => ({
            ...c,
            layoutResolved: c.layoutResolved,
            transform: { ...c.transform }
        })),
        selected: s.selected
    }
}

export const waitFrame = (): Promise<void> => new Promise<void>((r) => requestAnimationFrame(() => r()))
