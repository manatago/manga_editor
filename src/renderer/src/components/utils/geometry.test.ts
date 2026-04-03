import { describe, expect, it } from 'vitest'
import { isPointInPolygon } from './geometry'

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
