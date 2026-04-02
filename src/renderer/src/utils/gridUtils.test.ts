import { describe, expect, it } from 'vitest'
import { snapToGrid } from './gridUtils'

describe('snapToGrid', () => {
    it('returns original value when grid is disabled', () => {
        expect(snapToGrid(37, { gridEnabled: false, gridSize: 24 })).toBe(37)
        expect(snapToGrid(37, null)).toBe(37)
    })

    it('snaps to nearest grid interval when enabled', () => {
        expect(snapToGrid(37, { gridEnabled: true, gridSize: 24 })).toBe(48)
        expect(snapToGrid(11, { gridEnabled: true, gridSize: 24 })).toBe(0)
    })

    it('uses minimum grid size 8', () => {
        expect(snapToGrid(13, { gridEnabled: true, gridSize: 2 })).toBe(16)
    })
})
