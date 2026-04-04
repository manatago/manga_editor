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
 * Checks if a point (x, y) is inside a polygon defined by points [x1, y1, x2, y2, ...]
 * Ray casting algorithm
 */
export const isPointInPolygon = (x: number, y: number, points: number[]): boolean => {
    let inside = false
    for (let i = 0, j = points.length - 2; i < points.length; i += 2) {
        const xi = points[i], yi = points[i + 1]
        const xj = points[j], yj = points[j + 1]
        
        const intersect = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
        if (intersect) inside = !inside
        j = i
    }
    return inside
}

/**
 * Finds the topmost panel that contains the given point (x, y) in stage coordinates.
 */
export const findTargetPanel = (x: number, y: number, panels: Panel[]): Panel | undefined => {
    // Reverse panels to check from topmost to bottommost
    const reversedPanels = [...panels].reverse()
    for (const panel of reversedPanels) {
        const points = getPanelPoints(panel)
        const panelRad = ((panel.rotation || 0) * Math.PI) / 180
        const cosPR = Math.cos(panelRad)
        const sinPR = Math.sin(panelRad)
        // Transform local panel points to stage coordinates (with panel rotation)
        const stagePoints = []
        for (let i = 0; i < points.length; i += 2) {
            stagePoints.push(
                panel.x + points[i] * cosPR - points[i + 1] * sinPR,
                panel.y + points[i] * sinPR + points[i + 1] * cosPR
            )
        }

        if (isPointInPolygon(x, y, stagePoints)) {
            return panel
        }
    }
    return undefined
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
            // Panel rotation: local → stage
            const panelRad = ((panel.rotation || 0) * Math.PI) / 180
            const cosPR = Math.cos(panelRad)
            const sinPR = Math.sin(panelRad)
            // Item rotation: stage → item local (inverse rotation)
            const itemRad = ((item.rotation || 0) * Math.PI) / 180
            const cosIR = Math.cos(-itemRad)
            const sinIR = Math.sin(-itemRad)

            for (let i = 0; i < pts.length; i += 2) {
                // 1. Panel-local → stage (apply panel rotation)
                const stageX = panel.x + pts[i] * cosPR - pts[i + 1] * sinPR
                const stageY = panel.y + pts[i] * sinPR + pts[i + 1] * cosPR
                // 2. Stage → item-relative
                const dx = stageX - item.x
                const dy = stageY - item.y
                // 3. Item-relative → item local (undo item rotation)
                clipPoints.push(dx * cosIR - dy * sinIR, dx * sinIR + dy * cosIR)
            }
            return clipPoints
        }
    }
    return undefined
}
