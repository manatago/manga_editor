import { useMemo } from 'react'
import useImage from 'use-image'
import { getScreenToneDataUrl, isBuiltinBackgroundPath, isCustomTonePath, getCustomToneId } from '../utils/screenToneCatalog'
import { useMangaStore } from '../store/useMangaStore'

/**
 * トーン／背景画像パスを URL に解決し、ぼかし済み patternCanvas を返す共通フック。
 * PanelBackgroundImageLayer / PanelForegroundToneLayer 両方で使用。
 */
export function useTonePattern(
    path: string | undefined,
    projectPath: string | null,
    blur: number
): { patternCanvas: HTMLCanvasElement | null; ready: boolean } {
    const customTonePaths = useMangaStore((s) => s.customTonePaths)

    const imageUrl = useMemo(() => {
        if (!path) return undefined
        if (isBuiltinBackgroundPath(path)) {
            return getScreenToneDataUrl(path.slice('builtin://'.length))
        }
        if (isCustomTonePath(path)) {
            const id = getCustomToneId(path)
            const abs = customTonePaths[id]
            return abs ? window.electron.pathToUrl(abs) : undefined
        }
        if (!projectPath || !window.electron) return undefined
        const abs = window.electron.resolveAssetPath(projectPath, path)
        return abs ? window.electron.pathToUrl(abs) : undefined
    }, [path, projectPath, customTonePaths])

    const [img, status] = useImage(imageUrl ?? '', 'anonymous')

    // ぼかしは CSS filter で canvas に事前描画することで Konva filter 系バグを回避
    const patternCanvas = useMemo(() => {
        if (!img) return null
        const w = img.naturalWidth || img.width || 1
        const h = img.naturalHeight || img.height || 1
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) return null
        if (blur > 0) ctx.filter = `blur(${blur}px)`
        ctx.drawImage(img, 0, 0)
        return canvas
    }, [img, blur])

    const ready = !!imageUrl && status !== 'failed' && !!img && !!patternCanvas
    return { patternCanvas, ready }
}
