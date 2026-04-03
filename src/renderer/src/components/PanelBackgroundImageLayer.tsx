import React, { useMemo } from 'react'
import { Rect, Image as KonvaImage } from 'react-konva'
import useImage from 'use-image'
import type { Panel } from '../store/types'
import { getScreenToneDataUrl, isBuiltinBackgroundPath } from '../utils/screenToneCatalog'

interface PanelBackgroundImageLayerProps {
    panel: Panel
    projectPath: string | null
}

/**
 * コマの単色・グラデ下地の上、人物画像の下に重ねるスクリーントーン／背景画像。
 */
export const PanelBackgroundImageLayer: React.FC<PanelBackgroundImageLayerProps> = ({ panel, projectPath }) => {
    const imageUrl = useMemo(() => {
        const p = panel.backgroundImagePath
        if (!p) return undefined
        if (isBuiltinBackgroundPath(p)) {
            const id = p.slice('builtin://'.length)
            return getScreenToneDataUrl(id)
        }
        if (!projectPath || !window.electron) return undefined
        const abs = window.electron.resolveAssetPath(projectPath, p)
        return abs ? window.electron.pathToUrl(abs) : undefined
    }, [panel.backgroundImagePath, projectPath])

    const [img, status] = useImage(imageUrl ?? '', 'anonymous')

    if (!imageUrl || status === 'failed') return null
    if (!img) return null

    const w = panel.width
    const h = panel.height
    const opacity = panel.backgroundImageOpacity ?? 1
    const fit =
        panel.backgroundImageFit ??
        (panel.backgroundImagePath && isBuiltinBackgroundPath(panel.backgroundImagePath) ? 'tile' : 'stretch')

    if (fit === 'tile') {
        return (
            <Rect
                x={0}
                y={0}
                width={w}
                height={h}
                fillPatternImage={img}
                fillPatternRepeat="repeat"
                opacity={opacity}
                listening={false}
            />
        )
    }

    return (
        <KonvaImage image={img} x={0} y={0} width={w} height={h} opacity={opacity} listening={false} />
    )
}
