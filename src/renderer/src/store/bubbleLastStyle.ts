import type { Bubble, BubbleType } from './types'

/** 吹き出しタイプごとに「次回追加時に引き継ぐ」スタイル（位置・テキスト・しっぽ先端座標は含めない） */
export type BubbleLastStyleSlice = Pick<
    Bubble,
    | 'fontSize'
    | 'fontFamily'
    | 'lineHeight'
    | 'letterSpacing'
    | 'textStrokeColor'
    | 'textStrokeWidth'
    | 'textWeightLevel'
    | 'textRoughness'
    | 'fontColor'
    | 'fontWeight'
    | 'isVertical'
    | 'backgroundColor'
    | 'backgroundOpacity'
    | 'borderColor'
    | 'borderWidth'
    | 'opacity'
    | 'textOffsetX'
    | 'textOffsetY'
    | 'deformation'
    | 'tailWidth'
    | 'spikeCount'
    | 'flashLength'
    | 'narrowRatio'
    | 'tailType'
    | 'rotation'
>

export const BUBBLE_LAST_STYLE_STORAGE_KEY = 'manga-yarou-bubble-last-style-v1'

export function bubbleToLastStyleSlice(b: Bubble): BubbleLastStyleSlice {
    return {
        fontSize: b.fontSize,
        fontFamily: b.fontFamily,
        lineHeight: b.lineHeight,
        letterSpacing: b.letterSpacing,
        textStrokeColor: b.textStrokeColor,
        textStrokeWidth: b.textStrokeWidth,
        textWeightLevel: b.textWeightLevel,
        textRoughness: b.textRoughness,
        fontColor: b.fontColor,
        fontWeight: b.fontWeight,
        isVertical: b.isVertical,
        backgroundColor: b.backgroundColor,
        backgroundOpacity: b.backgroundOpacity,
        borderColor: b.borderColor,
        borderWidth: b.borderWidth,
        opacity: b.opacity,
        textOffsetX: b.textOffsetX,
        textOffsetY: b.textOffsetY,
        deformation: b.deformation,
        tailWidth: b.tailWidth,
        spikeCount: b.spikeCount,
        flashLength: b.flashLength,
        narrowRatio: b.narrowRatio,
        tailType: b.tailType,
        rotation: b.rotation
    }
}

export function loadBubbleLastStylesFromStorage(): Partial<Record<BubbleType, BubbleLastStyleSlice>> {
    try {
        if (typeof localStorage === 'undefined') return {}
        const raw = localStorage.getItem(BUBBLE_LAST_STYLE_STORAGE_KEY)
        if (!raw) return {}
        const parsed = JSON.parse(raw) as Partial<Record<BubbleType, BubbleLastStyleSlice>>
        return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
        return {}
    }
}

export function saveBubbleLastStylesToStorage(data: Partial<Record<BubbleType, BubbleLastStyleSlice>>): void {
    try {
        if (typeof localStorage === 'undefined') return
        localStorage.setItem(BUBBLE_LAST_STYLE_STORAGE_KEY, JSON.stringify(data))
    } catch (e) {
        console.warn('bubbleLastStyle: failed to persist', e)
    }
}
