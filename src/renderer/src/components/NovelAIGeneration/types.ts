import type { NovelAIAspect, PreciseRefSource } from '../../store/types'

export type PreciseRefCandidate = {
    key: string
    source: PreciseRefSource
    id: string
    /** 解決済み絶対パス（無い場合は未解決） */
    absolutePath: string | null
    /** URL（表示用） */
    url: string
    label: string
    /** ライブラリの場合は所属キャラ名 */
    subLabel?: string
}

export function pathFromRelative(projectPath: string | null, relPath: string): string | null {
    if (!projectPath || !window.electron) return null
    const abs = window.electron.resolveAssetPath(projectPath, relPath)
    return abs || null
}

export function toDisplayUrl(absolutePath: string | null): string {
    if (!absolutePath || !window.electron) return ''
    return window.electron.pathToUrl(absolutePath)
}

export const MAX_CHARACTER_REFS = 6
export const MAX_PRECISE_REFS = 5

/** NovelAI のベース Anlas 見積（1024x1536 以下 + steps<=28 + Opus は 0） */
export function estimateBaseAnlas(width: number, height: number, tier: number | null): number {
    const STEPS = 28
    const AREA_COEF = 2.951823174884865e-6
    const STEP_AREA_COEF = 5.753298233447344e-7
    const area = width * height
    const isOpus = tier === 3
    if (isOpus && area <= 1048576 && STEPS <= 28) return 0
    return Math.max(Math.ceil(AREA_COEF * area + STEP_AREA_COEF * area * STEPS), 2)
}

export const ASPECT_DIMS: Record<NovelAIAspect, { width: number; height: number }> = {
    portrait: { width: 832, height: 1216 },
    square: { width: 1024, height: 1024 },
    landscape: { width: 1216, height: 832 },
    wide: { width: 1216, height: 384 },
    tall: { width: 384, height: 1216 }
}

export const ASPECT_LABELS: Record<NovelAIAspect, string> = {
    portrait: '縦 832×1216',
    square: '正方 1024×1024',
    landscape: '横 1216×832',
    wide: '超横長 1216×384',
    tall: '超縦長 384×1216'
}
