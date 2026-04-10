import React, { useMemo } from 'react'
import { Rect } from 'react-konva'
import useImage from 'use-image'
import type { Panel } from '../store/types'
import { getScreenToneDataUrl, isBuiltinBackgroundPath, isCustomTonePath, getCustomToneId } from '../utils/screenToneCatalog'
import { useMangaStore } from '../store/useMangaStore'

interface PanelForegroundToneLayerProps {
    panel: Panel
    projectPath: string | null
}

/**
 * コマの人物画像の前面（上）に重ねるトーン。
 * builtin:// / custom-tone:// / assets 相対パスをサポート。常に tile モード。
 */
export const PanelForegroundToneLayer: React.FC<PanelForegroundToneLayerProps> = ({ panel, projectPath }) => {
    const customTonePaths = useMangaStore((s) => s.customTonePaths)

    const imageUrl = useMemo(() => {
        const p = panel.fgTonePath
        if (!p) return undefined
        if (isBuiltinBackgroundPath(p)) {
            const id = p.slice('builtin://'.length)
            return getScreenToneDataUrl(id)
        }
        if (isCustomTonePath(p)) {
            const id = getCustomToneId(p)
            const abs = customTonePaths[id]
            return abs ? window.electron.pathToUrl(abs) : undefined
        }
        if (!projectPath || !window.electron) return undefined
        const abs = window.electron.resolveAssetPath(projectPath, p)
        return abs ? window.electron.pathToUrl(abs) : undefined
    }, [panel.fgTonePath, projectPath, customTonePaths])

    const [img, status] = useImage(imageUrl ?? '', 'anonymous')

    if (!imageUrl || status === 'failed') return null
    if (!img) return null

    const scale = panel.fgToneScale ?? 1
    const rotation = panel.fgToneRotation ?? 0
    const opacity = panel.fgToneOpacity ?? 1

    return (
        <Rect
            x={0}
            y={0}
            width={panel.width}
            height={panel.height}
            fillPatternImage={img}
            fillPatternRepeat="repeat"
            fillPatternScaleX={scale}
            fillPatternScaleY={scale}
            fillPatternRotation={rotation}
            opacity={opacity}
            listening={false}
        />
    )
}
