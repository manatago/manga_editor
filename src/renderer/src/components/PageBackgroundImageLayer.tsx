import React, { useMemo } from 'react'
import { Rect, Image as KonvaImage } from 'react-konva'
import useImage from 'use-image'
import type { Page } from '../store/types'
import { getScreenToneDataUrl, isBuiltinBackgroundPath } from '../utils/screenToneCatalog'

interface PageBackgroundImageLayerProps {
    page: Page | undefined
    canvasWidth: number
    canvasHeight: number
    projectPath: string | null
}

/**
 * ページの下地（単色・グラデ）の上に重ねるスクリーントーン / 背景画像。
 */
export const PageBackgroundImageLayer: React.FC<PageBackgroundImageLayerProps> = ({
    page,
    canvasWidth,
    canvasHeight,
    projectPath
}) => {
    const imageUrl = useMemo(() => {
        const p = page?.backgroundImagePath
        if (!p) return undefined
        if (isBuiltinBackgroundPath(p)) {
            const id = p.slice('builtin://'.length)
            return getScreenToneDataUrl(id)
        }
        if (!projectPath || !window.electron) return undefined
        const abs = window.electron.resolveAssetPath(projectPath, p)
        return abs ? window.electron.pathToUrl(abs) : undefined
    }, [page?.backgroundImagePath, projectPath])

    const [img, status] = useImage(imageUrl, 'anonymous')

    if (!imageUrl || status === 'failed') return null
    if (!img) return null

    const opacity = page?.backgroundImageOpacity ?? 1
    const fit =
        page?.backgroundImageFit ??
        (page?.backgroundImagePath && isBuiltinBackgroundPath(page.backgroundImagePath) ? 'tile' : 'stretch')

    if (fit === 'tile') {
        return (
            <Rect
                x={0}
                y={0}
                width={canvasWidth}
                height={canvasHeight}
                fillPatternImage={img}
                fillPatternRepeat="repeat"
                opacity={opacity}
                listening={false}
            />
        )
    }

    return (
        <KonvaImage
            image={img}
            x={0}
            y={0}
            width={canvasWidth}
            height={canvasHeight}
            opacity={opacity}
            listening={false}
        />
    )
}
