import type { Bubble, BubbleType } from '../../store/useMangaStore'

/** 吹き出しタイプごとの内側余白比率（上下左右） */
export function getBubbleInnerPaddingRatio(type: BubbleType): number {
    const isRectType = type === 'rect' || type === 'rect-double' || type === 'megaphone'
    return isRectType ? 0.05 : 0.1
}

export function getBubbleInnerSizeRatio(type: BubbleType): number {
    const p = getBubbleInnerPaddingRatio(type)
    return 1 - p * 2
}

export type TextWeightLevel = 0 | 1 | 2

export function resolveTextWeightLevel(bubble: Pick<Bubble, 'textWeightLevel' | 'fontWeight'>): TextWeightLevel {
    if (bubble.textWeightLevel !== undefined && bubble.textWeightLevel !== null) {
        const v = Number(bubble.textWeightLevel)
        if (v === 0 || v === 1 || v === 2) return v
    }
    return bubble.fontWeight === 'bold' ? 1 : 0
}

export function resolveBaseFontStyle(weightLevel: TextWeightLevel): 'normal' | 'bold' {
    return weightLevel === 0 ? 'normal' : 'bold'
}

/** 極太：同系色の太い stroke で擬似的に太らせる */
export function heavyStrokeWidthFor(weightLevel: TextWeightLevel, fontSize: number): number {
    if (weightLevel !== 2) return 0
    return Math.max(0.8, fontSize * 0.06)
}

export function clampRoughness(bubble: Pick<Bubble, 'textRoughness'>): number {
    return Math.max(0, Math.min(1, bubble.textRoughness ?? 0))
}

/** 掠れフィルタの粒サイズ（DistressAlpha に渡す） */
export const BUBBLE_TEXT_DISTRESS_SCALE = 1.2
