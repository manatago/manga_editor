import React from 'react'
import { Rect } from 'react-konva'
import type { Panel } from '../store/types'
import { useTonePattern } from '../hooks/useTonePattern'
import { ToneFadeOverlay } from './effects/ToneFadeOverlay'

interface PanelForegroundToneLayerProps {
    panel: Panel
    projectPath: string | null
}

/**
 * コマの人物画像の前面（上）に重ねるトーン。常に tile モード。
 */
export const PanelForegroundToneLayer: React.FC<PanelForegroundToneLayerProps> = ({ panel, projectPath }) => {
    const blur = panel.fgToneBlur ?? 0
    const { patternCanvas, ready } = useTonePattern(panel.fgTonePath, projectPath, blur)

    if (!ready || !patternCanvas) return null

    const w = panel.width
    const h = panel.height
    const scale = panel.fgToneScale ?? 1
    const rotation = panel.fgToneRotation ?? 0
    const opacity = panel.fgToneOpacity ?? 1
    const offsetX = panel.fgToneOffsetX ?? 0
    const offsetY = panel.fgToneOffsetY ?? 0
    const fadeDirections = panel.fgToneFadeDirections ?? []
    const fadeStrength = panel.fgToneFadeStrength ?? 0.4
    const bgColor = panel.backgroundColor || '#ffffff'

    return (
        <>
            <Rect
                x={0}
                y={0}
                width={w}
                height={h}
                fillPatternImage={patternCanvas as unknown as HTMLImageElement}
                fillPatternRepeat="repeat"
                fillPatternScaleX={scale}
                fillPatternScaleY={scale}
                fillPatternRotation={rotation}
                fillPatternOffsetX={offsetX}
                fillPatternOffsetY={offsetY}
                opacity={opacity}
                listening={false}
            />
            <ToneFadeOverlay width={w} height={h} fadeDirections={fadeDirections} fadeStrength={fadeStrength} backgroundColor={bgColor} />
        </>
    )
}
