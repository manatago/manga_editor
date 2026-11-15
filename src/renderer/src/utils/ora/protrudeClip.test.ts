import { describe, expect, it } from 'vitest'
import { clockwise, edgeSide, protrudeInset, protrudeRegions, signedArea2, PROTRUDE_SEAM_MARGIN } from './protrudeClip'

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

/**
 * Canvas の clip と同じ nonzero ルールで「複数の多角形を 1 つのパスに足した範囲」に入るか。
 * 多角形ごとの判定（inAny）では、向きの違う図形が打ち消し合う不具合を見逃すため、こちらで検証する。
 */
const windingOf = (poly: number[], x: number, y: number): number => {
    let w = 0
    const n = poly.length / 2
    for (let i = 0; i < n; i++) {
        const x1 = poly[i * 2], y1 = poly[i * 2 + 1], x2 = poly[((i + 1) % n) * 2], y2 = poly[((i + 1) % n) * 2 + 1]
        const c = (x2 - x1) * (y - y1) - (x - x1) * (y2 - y1)
        if (y1 <= y) { if (y2 > y && c > 0) w++ } else if (y2 <= y && c < 0) w--
    }
    return w
}
const inClipNonzero = (polys: number[][], x: number, y: number): boolean =>
    polys.reduce((sum, p) => sum + windingOf(p, x, y), 0) !== 0

describe('clip パス（nonzero）として重ねたとき', () => {
    const SW = 4
    for (const [label, pts] of [
        ['時計回りのコマ', RECT],
        ['反時計回りのコマ', [0, 0, 0, 60, 100, 60, 100, 0]]
    ] as const) {
        it(`${label}: 辺を絞って「中も描く」とき、枠線の内側半分にも人物が描かれる（線が透けない）`, () => {
            const clip = [...protrudeRegions([...pts], { top: true }, SW / 2), clockwise([...pts])]
            expect(inClipNonzero(clip, 50, -1)).toBe(true) // 線の外側半分
            expect(inClipNonzero(clip, 50, 1)).toBe(true) // 線の内側半分（以前は打ち消されて穴になっていた）
            expect(inClipNonzero(clip, 50, 30)).toBe(true) // コマの中
            expect(inClipNonzero(clip, 50, 70)).toBe(false) // 下の外（許していない辺）
        })

        it(`${label}: 隣り合う辺と角の埋めが重なっても穴にならない`, () => {
            const clip = protrudeRegions([...pts], { top: true, right: true }, SW / 2)
            for (const [x, y] of [[99, -1], [101, 1], [101, -1], [150, -50], [99, 1]]) {
                expect(inClipNonzero(clip, x, y), `${x},${y}`).toBe(true)
            }
        })
    }

    it('返す多角形はすべて時計回り', () => {
        for (const r of protrudeRegions([0, 0, 0, 60, 100, 60, 100, 0], { top: true, left: true, bottom: true }, 2)) {
            expect(signedArea2(r)).toBeGreaterThan(0)
        }
    })
})

describe('protrudeInset', () => {
    it('枠線の内側の縁より少し内側から人物を描く（境界のにじみで線が透けないように）', () => {
        expect(protrudeInset(4)).toBe(2 + PROTRUDE_SEAM_MARGIN)
        expect(protrudeInset(undefined)).toBe(0.5 + PROTRUDE_SEAM_MARGIN)
        const r = protrudeRegions(RECT, { top: true }, protrudeInset(4))
        // 線（y=-2..2）の内側の縁 y=2 より内側の y=3 まで人物の範囲に入る
        expect(inAny(r, 50, 3)).toBe(true)
        expect(inAny(r, 50, 2 + PROTRUDE_SEAM_MARGIN + 1)).toBe(false)
    })
})
