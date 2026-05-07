import React from 'react'
import { Group } from 'react-konva'
import { FilteredText } from './FilteredText'
import type { TextWeightLevel } from './utils/bubbleTextLayout'
import { BUBBLE_TEXT_DISTRESS_SCALE, heavyStrokeWidthFor } from './utils/bubbleTextLayout'

type BubbleLike = {
    text: string
    fontColor: string
    fontFamily: string
    _overrideFontFamily?: string
    _overrideFontSize?: number
    fontSize: number
    fontWeight?: string
    textStrokeColor?: string
    textStrokeWidth?: number
    letterSpacing?: number
    lineHeight?: number
    _overrideLineHeight?: number
    textRoughness?: number
    autoFitMode?: 'off' | 'shrink-font' | 'expand-bubble'
}

type Props = {
    bubble: BubbleLike
    tw: number
    th: number
    weightLevel: TextWeightLevel
    baseFontStyle: 'normal' | 'bold'
}

/**
 * 横書き吹き出しテキスト（極太用の二重レイヤー + 極太／通常の共通 props）
 */
export const BubbleHorizontalTextLayers: React.FC<Props> = ({ bubble, tw, th, weightLevel, baseFontStyle }) => {
    const fontSize = bubble._overrideFontSize ?? bubble.fontSize
    const fontFamily = bubble._overrideFontFamily ?? bubble.fontFamily
    const lineHeight = bubble._overrideLineHeight ?? bubble.lineHeight ?? 1.0
    const roughness = Math.max(0, Math.min(1, bubble.textRoughness ?? 0))
    const heavyW = heavyStrokeWidthFor(weightLevel, fontSize)
    const outlineW = (bubble.textStrokeWidth ?? 0) > 0 ? (bubble.textStrokeWidth ?? 0) : 0
    const outlineColor = bubble.textStrokeColor ?? '#ffffff'

    // 自動フィット有効時は Konva 側も文字単位で折り返す（既定 'word' は日本語が折り返されない）
    const autoFitActive = !!bubble.autoFitMode && bubble.autoFitMode !== 'off'
    const common = {
        text: bubble.text,
        fontSize,
        fontFamily,
        width: tw,
        height: th,
        verticalAlign: 'middle' as const,
        fontStyle: baseFontStyle,
        lineHeight,
        letterSpacing: bubble.letterSpacing ?? 0,
        lineJoin: 'round' as const,
        wrap: autoFitActive ? ('char' as const) : ('word' as const),
        distressStrength: roughness,
        distressScale: BUBBLE_TEXT_DISTRESS_SCALE,
        enableCache: roughness > 0
    }

    return (
        <Group>
            {weightLevel === 2 && heavyW > 0 && (
                <FilteredText
                    {...common}
                    fill={bubble.fontColor}
                    stroke={bubble.fontColor}
                    strokeWidth={heavyW}
                />
            )}
            <FilteredText
                {...common}
                fill={bubble.fontColor}
                stroke={outlineW > 0 ? outlineColor : undefined}
                strokeWidth={outlineW > 0 ? outlineW : 0}
            />
        </Group>
    )
}
