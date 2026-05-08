import { describe, expect, it } from 'vitest'
import {
    computeParallelAlignment,
    getDiagonalEdges,
    snapCornerXForAngle,
    snapCornerYForAngle,
    PARALLEL_SNAP_DEG
} from './edgeAlignment'
import type { Panel } from '../store/types'

const makePanel = (overrides: Partial<Panel>): Panel => ({
    id: 'p',
    type: 'rect',
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    rotation: 0,
    strokeWidth: 1,
    strokeColor: '#000',
    slant: 0,
    offsetB: 0,
    offsetC: 0,
    offsetD: 0,
    ...overrides
})

describe('getDiagonalEdges', () => {
    it('returns no diagonals for a rect panel', () => {
        const p = makePanel({ type: 'rect' })
        expect(getDiagonalEdges(p)).toEqual([])
    })

    it('returns 2 diagonals for a slanted panel', () => {
        const p = makePanel({ type: 'slanted', slant: 30 })
        const edges = getDiagonalEdges(p)
        // top and bottom are horizontal; left and right are diagonal
        expect(edges.length).toBe(2)
    })

    it('returns 2 diagonals for trapezoid-h', () => {
        const p = makePanel({ type: 'trapezoid-h', slant: 30, offsetB: -30, offsetC: 0, offsetD: 0 })
        const edges = getDiagonalEdges(p)
        expect(edges.length).toBe(2)
    })
})

describe('computeParallelAlignment', () => {
    it('snaps to a parallel neighbor edge within threshold', () => {
        // Neighbor: 30° diagonal
        const neighborEdge = {
            panelId: 'A',
            edgeIndex: 0,
            start: { x: 0, y: 0 },
            end: { x: 100, y: 57.7 }, // tan(30°) ≈ 0.577
            angle: Math.atan2(57.7, 100)
        }
        // Moving edge: ~31° (within 1.5° threshold)
        const movingStart = { x: 200, y: 0 }
        const movingEnd = { x: 300, y: 60 }
        const r = computeParallelAlignment({ start: movingStart, end: movingEnd }, [neighborEdge])
        expect(r.snapDelta).toBeDefined()
        expect(r.matchedEdge).toBeDefined()
        expect(r.guides.length).toBeGreaterThan(0)
    })

    it('does not snap when angle is too different', () => {
        const neighborEdge = {
            panelId: 'A',
            edgeIndex: 0,
            start: { x: 0, y: 0 },
            end: { x: 100, y: 57.7 },
            angle: Math.atan2(57.7, 100)
        }
        // Moving edge at ~60°
        const movingStart = { x: 200, y: 0 }
        const movingEnd = { x: 250, y: 86.6 }
        const r = computeParallelAlignment({ start: movingStart, end: movingEnd }, [neighborEdge])
        expect(r.snapDelta).toBeUndefined()
        expect(r.guides.length).toBe(0)
    })

    it('skips horizontal/vertical moving edges', () => {
        const neighborEdge = {
            panelId: 'A',
            edgeIndex: 0,
            start: { x: 0, y: 0 },
            end: { x: 100, y: 50 },
            angle: Math.atan2(50, 100)
        }
        // Horizontal moving edge
        const r = computeParallelAlignment(
            { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } },
            [neighborEdge]
        )
        expect(r.snapDelta).toBeUndefined()
        expect(r.guides.length).toBe(0)
    })
})

describe('snapCornerXForAngle', () => {
    it('returns the X position that creates the target angle', () => {
        // Counter at (100, 100). Corner at y=0. Want angle 45° from corner to counter.
        // tan(45°) = 1 = (100-0)/(100-cornerX) → cornerX = 0.
        const r = snapCornerXForAngle(0, { x: 100, y: 100 }, Math.PI / 4)
        // dy = cornerY - counter.y = 0 - 100 = -100
        // dx = -100 / tan(π/4) = -100. New X = counter.x + dx = 0.
        expect(r).toBeCloseTo(0, 1)
    })

    it('returns null for nearly-horizontal target angle', () => {
        const r = snapCornerXForAngle(0, { x: 100, y: 100 }, 0.01)
        expect(r).toBeNull()
    })
})

describe('snapCornerYForAngle', () => {
    it('returns the Y position that creates the target angle', () => {
        const r = snapCornerYForAngle(0, { x: 100, y: 100 }, Math.PI / 4)
        // dx = 0 - 100 = -100. dy = -100 * tan(π/4) = -100. New Y = 100 + (-100) = 0.
        expect(r).toBeCloseTo(0, 1)
    })
})

describe('PARALLEL_SNAP_DEG', () => {
    it('exposes the expected threshold', () => {
        expect(PARALLEL_SNAP_DEG).toBe(1.5)
    })
})
