import { describe, expect, it } from 'vitest'
import { edgeSide, protrudeRegions } from './protrudeClip'

/** 点が多角形の中か（偶奇） */
const inside = (pts: number[], x: number, y: number): boolean => {
    let c = false
    for (let i = 0, j = pts.length / 2 - 1; i < pts.length / 2; j = i++) {
        const xi = pts[i * 2], yi = pts[i * 2 + 1], xj = pts[j * 2], yj = pts[j * 2 + 1]
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
    }
    return c
}
const inAny = (regions: number[][], x: number, y: number) => regions.some(r => inside(r, x, y))
const RECT = [0, 0, 100, 0, 100, 60, 0, 60]

describe('はみ出しを許す範囲', () => {
    it('上の辺だけ許すと、上の外は描け、下・横の外とコマの中は描かない', () => {
        const r = protrudeRegions(RECT, { top: true })
        expect(inAny(r, 50, -10)).toBe(true)
        expect(inAny(r, 50, 70)).toBe(false)
        expect(inAny(r, 110, 30)).toBe(false)
        expect(inAny(r, 50, 30)).toBe(false)
    })
    it('隣り合う 2 辺を許すと、角の外も描ける', () => {
        const r = protrudeRegions(RECT, { top: true, right: true })
        expect(inAny(r, 120, -20)).toBe(true)
        expect(inAny(r, -20, -20)).toBe(false)
    })
    it('線の太さの半分だけ内側から描ける（枠線の上にも重なる）', () => {
        const r = protrudeRegions(RECT, { top: true }, 2)
        expect(inAny(r, 50, 1)).toBe(true)
        expect(inAny(r, 50, 3)).toBe(false)
    })
    it('点の並びの向き（時計回り・反時計回り）によらない', () => {
        const ccw = [0, 0, 0, 60, 100, 60, 100, 0]
        const r = protrudeRegions(ccw, { bottom: true })
        expect(inAny(r, 50, 70)).toBe(true)
        expect(inAny(r, 50, -10)).toBe(false)
    })
    it('辺の向きで上下左右を決める', () => {
        expect(edgeSide(0, -1)).toBe('top')
        expect(edgeSide(1, 0.2)).toBe('right')
        expect(edgeSide(-0.1, 1)).toBe('bottom')
        expect(edgeSide(-1, 0)).toBe('left')
    })
})
