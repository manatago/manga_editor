import { describe, expect, it } from 'vitest'
import { computePanelAlignment, computePanelAlignmentForResize, PANEL_SNAP_THRESHOLD } from './panelAlignment'
import type { Panel } from '../store/types'

const makePanel = (id: string, x: number, y: number, w: number, h: number): Panel => ({
    id,
    type: 'rect',
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    strokeWidth: 1,
    strokeColor: '#000',
    slant: 0,
    offsetB: 0,
    offsetC: 0,
    offsetD: 0
})

describe('computePanelAlignment (drag)', () => {
    it('snaps left edge to neighbor right edge within threshold', () => {
        const others = [makePanel('A', 100, 100, 200, 100)] // A.right = 300
        // Active: at x=303 (3px past A.right). Should snap to x=300.
        const r = computePanelAlignment({ x: 303, y: 200, width: 100, height: 100 }, others)
        expect(r.snappedX).toBe(300)
        expect(r.snappedY).toBeUndefined()
        const v = r.guides.find((g) => g.orientation === 'vertical' && g.position === 300)
        expect(v).toBeDefined()
        expect(v!.matched).toBe(true)
    })

    it('does not snap when outside threshold', () => {
        // A: 100..300 horizontally, 100..200 vertically.
        const others = [makePanel('A', 100, 100, 200, 100)]
        // Active is far away both axes (no edges/centers near A).
        const r = computePanelAlignment({ x: 500, y: 500, width: 100, height: 100 }, others)
        expect(r.snappedX).toBeUndefined()
        expect(r.snappedY).toBeUndefined()
        expect(r.guides.length).toBe(0)
    })

    it('snaps both axes independently', () => {
        const others = [makePanel('A', 100, 100, 200, 100)] // A: left=100 top=100 right=300 bottom=200
        // Active near A's bottom-right corner: top=205 (5 from bottom), left=295 (5 from right)
        const r = computePanelAlignment({ x: 295, y: 205, width: 100, height: 100 }, others)
        // Both edges should snap.
        expect(r.snappedX).toBeDefined()
        expect(r.snappedY).toBeDefined()
    })

    it('picks the closest candidate when multiple are in range', () => {
        const others = [
            makePanel('A', 100, 0, 200, 50), // A.right = 300
            makePanel('B', 305, 0, 100, 50)  // B.left = 305
        ]
        // Active.left = 302: A.right=300 (delta=-2), B.left=305 (delta=+3). Should pick A.right (closer).
        const r = computePanelAlignment({ x: 302, y: 100, width: 50, height: 50 }, others)
        expect(r.snappedX).toBe(300)
    })

    it('emits no guide when no others', () => {
        const r = computePanelAlignment({ x: 100, y: 100, width: 50, height: 50 }, [])
        expect(r.guides.length).toBe(0)
        expect(r.snappedX).toBeUndefined()
    })

    it('center-line snap works', () => {
        const others = [makePanel('A', 100, 100, 200, 100)] // A.centerX = 200
        // Active centered at x=203 → centerX = 203+50 = 253... no wait.
        // For centerX of active = 200, active.x = 200 - width/2.
        const r = computePanelAlignment({ x: 148, y: 100, width: 100, height: 100 }, others)
        // active.centerX = 198 → A.centerX=200, delta=+2. Snap.
        expect(r.snappedX).toBe(150) // 148 + 2
    })
})

describe('computePanelAlignmentForResize', () => {
    it('snaps the moved edge only', () => {
        const others = [makePanel('A', 100, 0, 200, 50)] // A.right = 300
        // Resize: prev (right=320, left=400 width=80), new (right=302, width=98)... no let me do simpler:
        // prev: x=200 width=100 (right=300, left=200), new: x=200 width=103 (right=303). Right edge moved.
        const r = computePanelAlignmentForResize(
            { x: 200, y: 100, width: 103, height: 50 },
            others,
            { x: 200, y: 100, width: 100, height: 50 }
        )
        // Right edge 303 should snap to 300 (A.right). New width = 100.
        expect(r.snappedWidth).toBe(100)
        expect(r.snappedX).toBeUndefined() // Left didn't move
    })

    it('does not snap edges that were not moved', () => {
        const others = [makePanel('A', 100, 0, 200, 50)] // A.left = 100, right = 300
        // Resize: only left edge moved. New left = 102 (within threshold of 100). Right unchanged at 250.
        const r = computePanelAlignmentForResize(
            { x: 102, y: 50, width: 148, height: 50 },
            others,
            { x: 100, y: 50, width: 150, height: 50 }
        )
        // Left moved (100→102). Should snap to 100.
        expect(r.snappedX).toBe(100)
        // Width should compensate so right stays the same: 250 - 100 = 150.
        expect(r.snappedWidth).toBe(150)
    })
})

describe('PANEL_SNAP_THRESHOLD', () => {
    it('is exposed as 10', () => {
        expect(PANEL_SNAP_THRESHOLD).toBe(10)
    })
})
