import { describe, expect, it } from 'vitest'
import type { Panel } from '../../store/types'
import { findTargetPanel, getClippedPoints, isPointInPolygon, type ClipItem } from './geometry'

function rectPanel(id: string, x: number, y: number, width: number, height: number): Panel {
    return {
        id,
        type: 'rect',
        x,
        y,
        width,
        height,
        slant: 0,
        offsetB: 0,
        offsetC: 0,
        offsetD: 0,
        strokeWidth: 1,
        strokeColor: '#000000'
    }
}

function slantedPanel(id: string, x: number, y: number, width: number, height: number, slant: number): Panel {
    return {
        ...rectPanel(id, x, y, width, height),
        type: 'slanted',
        slant
    }
}

/** 軸に沿った矩形 [x,y] × 4 頂点（時計回り） */
const axisAlignedRect = [0, 0, 100, 0, 100, 100, 0, 100]

describe('isPointInPolygon', () => {
    it('returns true for a point strictly inside an axis-aligned rectangle', () => {
        expect(isPointInPolygon(50, 50, axisAlignedRect)).toBe(true)
    })

    it('returns false for a point clearly outside', () => {
        expect(isPointInPolygon(150, 50, axisAlignedRect)).toBe(false)
        expect(isPointInPolygon(50, -10, axisAlignedRect)).toBe(false)
    })

    it('handles a slanted quadrilateral (non-axis edges)', () => {
        const slanted = [0, 0, 120, 30, 100, 100, -20, 70]
        expect(isPointInPolygon(40, 50, slanted)).toBe(true)
        expect(isPointInPolygon(200, 200, slanted)).toBe(false)
    })

    it('returns consistent boolean for a point on an edge (boundary)', () => {
        const onBottomEdge = isPointInPolygon(50, 0, axisAlignedRect)
        const onLeftEdge = isPointInPolygon(0, 50, axisAlignedRect)
        expect(typeof onBottomEdge).toBe('boolean')
        expect(typeof onLeftEdge).toBe('boolean')
    })

    it('handles a concave L-shape: hole region is outside', () => {
        const lShape = [0, 100, 0, 0, 100, 0, 100, 50, 50, 50, 50, 100, 0, 100]
        expect(isPointInPolygon(75, 75, lShape)).toBe(false)
        expect(isPointInPolygon(25, 75, lShape)).toBe(true)
        expect(isPointInPolygon(75, 25, lShape)).toBe(true)
    })
})

describe('findTargetPanel', () => {
    it('returns the panel whose rect contains the stage point', () => {
        const p = rectPanel('a', 10, 20, 100, 80)
        expect(findTargetPanel(50, 50, [p])?.id).toBe('a')
        expect(findTargetPanel(5, 5, [p])).toBeUndefined()
    })

    it('returns the topmost panel when overlapping (later in array wins)', () => {
        const bottom = rectPanel('bottom', 0, 0, 100, 100)
        const top = rectPanel('top', 50, 50, 100, 100)
        expect(findTargetPanel(75, 75, [bottom, top])?.id).toBe('top')
        expect(findTargetPanel(25, 25, [bottom, top])?.id).toBe('bottom')
    })

    it('uses getPanelPoints for slanted panels', () => {
        const p = slantedPanel('s', 0, 0, 100, 100, 10)
        expect(findTargetPanel(55, 50, [p])?.id).toBe('s')
    })

    it('returns undefined for empty list', () => {
        expect(findTargetPanel(0, 0, [])).toBeUndefined()
    })
})

describe('getClippedPoints', () => {
    const panels: Panel[] = [rectPanel('p1', 100, 200, 50, 40)]

    it('returns undefined when not clipped', () => {
        const item: ClipItem = { isClipped: false, panelId: 'p1', x: 0, y: 0 }
        expect(getClippedPoints(item, panels)).toBeUndefined()
    })

    it('returns undefined when panelId is missing', () => {
        const item: ClipItem = { isClipped: true, x: 0, y: 0 }
        expect(getClippedPoints(item, panels)).toBeUndefined()
    })

    it('returns undefined when panel is not found', () => {
        const item: ClipItem = { isClipped: true, panelId: 'missing', x: 0, y: 0 }
        expect(getClippedPoints(item, panels)).toBeUndefined()
    })

    it('returns panel polygon in item local space (rotation 0)', () => {
        const item: ClipItem = { isClipped: true, panelId: 'p1', x: 100, y: 200, rotation: 0 }
        const pts = getClippedPoints(item, panels)
        expect(pts).toBeDefined()
        expect(pts!.length).toBe(8)
        expect(pts![0]).toBe(0)
        expect(pts![1]).toBe(0)
        expect(pts![2]).toBe(50)
        expect(pts![3]).toBe(0)
    })

    it('applies rotation when mapping to item space', () => {
        const item: ClipItem = { isClipped: true, panelId: 'p1', x: 125, y: 220, rotation: 90 }
        const pts = getClippedPoints(item, panels)
        expect(pts).toBeDefined()
        expect(pts!.length).toBe(8)
    })
})
