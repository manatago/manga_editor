import type { PanelType, Page } from '../store/useMangaStore'

export const PANEL_RIGHT_MARGIN = 10
export const PANEL_LEFT_MARGIN = 10
export const PANEL_TOP_MARGIN = 10
export const PANEL_SIDE_GAP = 10
export const PANEL_VERTICAL_GAP = 10
export const PANEL_STANDARD_HEIGHT = 300
export const PANEL_MIN_HEIGHT = 100

export function standardPanelWidth(pageWidth: number): number {
    return Math.round(pageWidth / 2 - 15)
}

export function computePanelInsertion(
    page: Page | undefined,
    type: PanelType,
    defaultWidth: number,
    defaultHeight: number
): { x: number; y: number; width: number; height: number } {
    const pageWidth = page?.pageWidth ?? 840
    const pageHeight = page?.pageHeight ?? 1188
    const initialPlacement = {
        x: Math.max(0, pageWidth - defaultWidth - PANEL_RIGHT_MARGIN),
        y: PANEL_TOP_MARGIN,
        width: defaultWidth,
        height: defaultHeight
    }
    if (!page || page.panels.length === 0) return initialPlacement

    const fitShape = (w: number, h: number): { width: number; height: number } => {
        if (type === 'circle') {
            const s = Math.min(w, h)
            return { width: s, height: s }
        }
        if (type === 'hexagon') {
            const ratio = Math.sqrt(3) / 2
            let hh = h
            let ww = Math.round(h / ratio)
            if (ww > w) {
                ww = w
                hh = Math.round(w * ratio)
            }
            return { width: ww, height: hh }
        }
        return { width: w, height: h }
    }

    const maxBottomEdge = Math.max(...page.panels.map((p) => p.y + p.height))
    const bottomRow = page.panels.filter((p) => Math.abs(p.y + p.height - maxBottomEdge) < 1)
    const leftmostBottom = bottomRow.reduce((acc, p) => (p.x < acc.x ? p : acc))

    if (leftmostBottom.width <= pageWidth * 0.8) {
        const newWidth = leftmostBottom.x - PANEL_LEFT_MARGIN - PANEL_SIDE_GAP
        if (newWidth >= 80) {
            const fitted = fitShape(newWidth, leftmostBottom.height)
            const x = PANEL_LEFT_MARGIN
            const y = leftmostBottom.y + Math.round((leftmostBottom.height - fitted.height) / 2)
            return { x, y, ...fitted }
        }
    }

    const remaining = pageHeight - maxBottomEdge - PANEL_VERTICAL_GAP
    if (remaining >= PANEL_MIN_HEIGHT) {
        const targetH = Math.min(PANEL_STANDARD_HEIGHT, remaining)
        const fitted = fitShape(standardPanelWidth(pageWidth), targetH)
        const x = Math.max(0, pageWidth - fitted.width - PANEL_RIGHT_MARGIN)
        const y = maxBottomEdge + PANEL_VERTICAL_GAP
        return { x, y, ...fitted }
    }

    // ページ下端に収まらないので中央に置く
    const centered = fitShape(standardPanelWidth(pageWidth), PANEL_STANDARD_HEIGHT)
    return {
        x: Math.max(0, Math.round((pageWidth - centered.width) / 2)),
        y: Math.max(0, Math.round((pageHeight - centered.height) / 2)),
        ...centered
    }
}
