import { getPanelPoints } from './drawPaths'
import { Panel } from '../../store/useMangaStore'

export interface ClipItem {
    isClipped: boolean;
    panelId?: string;
    x: number;
    y: number;
    rotation?: number;
}

/**
 * Calculates the clipping points for an item relative to a panel.
 * Transforms panel vertices into the item's local coordinate system.
 */
export const getClippedPoints = (
    item: ClipItem,
    panels: Panel[]
): number[] | undefined => {
    if (item.isClipped && item.panelId) {
        const panel = panels.find(p => p.id === item.panelId)
        if (panel) {
            const pts = getPanelPoints(panel)
            const clipPoints = []
            const rad = ((item.rotation || 0) * Math.PI) / 180
            const cos = Math.cos(-rad)
            const sin = Math.sin(-rad)

            for (let i = 0; i < pts.length; i += 2) {
                const dx = pts[i] + panel.x - item.x
                const dy = pts[i + 1] + panel.y - item.y
                
                // Rotate point back into item's local coordinate system
                const lx = dx * cos - dy * sin
                const ly = dx * sin + dy * cos
                
                clipPoints.push(lx, ly)
            }
            return clipPoints
        }
    }
    return undefined
}
