import type { Bubble, Panel } from '../../store/useMangaStore'
import { getClippedPoints } from '../utils/geometry'

export const PANEL_MIN_SIZE = 10

/** Electron 旧挙動などで File に生パスが付くことがある */
export type FileWithNativePath = File & { path?: string }

/**
 * ドロップ時の素材サイズ計算用。EXIF Orientation 付き JPEG はピクセルが横長でも「見た目」は縦になる。
 * `Image.width` だけだとアスペクトがずれ、Konva の矩形に引き伸ばされて縦長だけ潰れて見える。
 */
export async function getOrientedImagePixelSize(file: File, fallback = 200): Promise<{ w: number; h: number }> {
    try {
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
        const w = bitmap.width
        const h = bitmap.height
        bitmap.close()
        if (w > 0 && h > 0) {
            return { w, h }
        }
    } catch {
        /* HEIC 等で createImageBitmap が失敗する場合あり */
    }
    try {
        const url = URL.createObjectURL(file)
        const img = new Image()
        img.decoding = 'async'
        img.src = url
        await new Promise<void>((resolve) => {
            img.onload = () => resolve()
            img.onerror = () => resolve()
        })
        const w = img.naturalWidth || img.width || fallback
        const h = img.naturalHeight || img.height || fallback
        URL.revokeObjectURL(url)
        return { w, h }
    } catch {
        return { w: fallback, h: fallback }
    }
}

export type BubbleClusterMember = Bubble & {
    _overrideFontFamily?: string
    _overrideFontSize?: number
    _overrideBorderWidth?: number
    _overrideBackgroundColor?: string
    _overrideBorderColor?: string
    _overrideBackgroundOpacity?: number
    _overrideLineHeight?: number
    clipPoints?: number[]
}

export type BubbleVisualCluster = {
    id: string
    members: BubbleClusterMember[]
}

export function getVisualClusters(bubblesToCluster: Bubble[], panels: Panel[]): BubbleVisualCluster[] {
    const checkOverlap = (b1: Bubble, b2: Bubble): boolean => {
        const r1 = { x: b1.x, y: b1.y, w: b1.width, h: b1.height }
        const r2 = { x: b2.x, y: b2.y, w: b2.width, h: b2.height }
        return !(r2.x >= r1.x + r1.w || r2.x + r2.w <= r1.x || r2.y >= r1.y + r1.h || r2.y + r2.h <= r1.y)
    }
    const clusters: { master: Bubble; members: Bubble[] }[] = []
    bubblesToCluster.forEach((b) => {
        let foundCluster = false
        for (const cluster of clusters) {
            const master = cluster.master
            if (master.type === b.type && master.backgroundColor === b.backgroundColor && master.borderColor === b.borderColor && master.backgroundOpacity === b.backgroundOpacity) {
                if (cluster.members.some((member) => checkOverlap(member, b))) {
                    cluster.members.push(b)
                    foundCluster = true
                    break
                }
            }
        }
        if (!foundCluster) clusters.push({ master: b, members: [b] })
    })
    return clusters.map((c) => ({
        id: c.master.id,
        members: c.members.map((b) => {
            const clipPoints = getClippedPoints({
                isClipped: b.isClipped,
                panelId: b.panelId,
                x: b.x,
                y: b.y,
                rotation: b.rotation || 0
            }, panels)
            return {
                ...b,
                _overrideFontFamily: c.master.fontFamily,
                _overrideFontSize: c.master.fontSize,
                _overrideBorderWidth: c.master.borderWidth,
                _overrideBackgroundColor: c.master.backgroundColor,
                _overrideBorderColor: c.master.borderColor,
                _overrideBackgroundOpacity: c.master.backgroundOpacity,
                _overrideLineHeight: c.master.lineHeight,
                clipPoints
            }
        })
    }))
}
