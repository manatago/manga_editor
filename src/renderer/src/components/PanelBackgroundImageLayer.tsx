import React from 'react'
import { Rect, Image as KonvaImage } from 'react-konva'
import type { Panel } from '../store/types'
import { isBuiltinBackgroundPath, isCustomTonePath } from '../utils/screenToneCatalog'
import { useTonePattern } from '../hooks/useTonePattern'
import { ToneFadeOverlay } from './effects/ToneFadeOverlay'

interface PanelBackgroundImageLayerProps {
    panel: Panel
    projectPath: string | null
}

/**
 * コマの単色・グラデ下地の上、人物画像の下に重ねるスクリーントーン／背景画像。
 */
export const PanelBackgroundImageLayer: React.FC<PanelBackgroundImageLayerProps> = ({ panel, projectPath }) => {
    const blur = panel.backgroundImageBlur ?? 0
    const { patternCanvas, ready } = useTonePattern(panel.backgroundImagePath, projectPath, blur)

    if (!ready || !patternCanvas) return null

    const w = panel.width
    const h = panel.height
    const opacity = panel.backgroundImageOpacity ?? 1
    const scale = panel.backgroundImageScale ?? 1
    const rotation = panel.backgroundImageRotation ?? 0
    const offsetX = panel.backgroundImageOffsetX ?? 0
    const offsetY = panel.backgroundImageOffsetY ?? 0
    const fadeDirections = panel.backgroundImageFadeDirections ?? []
    const fadeStrength = panel.backgroundImageFadeStrength ?? 0.4
    const bgColor = panel.backgroundColor || '#ffffff'
    const path = panel.backgroundImagePath!
    const fit =
        panel.backgroundImageFit ??
        (isBuiltinBackgroundPath(path) || isCustomTonePath(path) ? 'tile' : 'stretch')

    return (
        <>
            {fit === 'tile' ? (
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
            ) : (
                <KonvaImage
                    image={patternCanvas as unknown as HTMLImageElement}
                    x={0}
                    y={0}
                    width={w}
                    height={h}
                    opacity={opacity}
                    listening={false}
                />
            )}
            <ToneFadeOverlay width={w} height={h} fadeDirections={fadeDirections} fadeStrength={fadeStrength} backgroundColor={bgColor} />
        </>
    )
}
