import { describe, it, expect } from 'vitest'
import {
    LAYOUT_PRESETS,
    resolveLayout,
    autoGrid,
    instantiate,
    findPresetByName
} from '../../../data/layoutPresets'

const W = 840
const H = 1188

describe('layoutPresets', () => {
    it('全プリセットの矩形は 0..1 の範囲に収まる', () => {
        for (const preset of LAYOUT_PRESETS) {
            for (const rc of preset.rects) {
                expect(rc.x).toBeGreaterThanOrEqual(0)
                expect(rc.y).toBeGreaterThanOrEqual(0)
                expect(rc.x + rc.w).toBeLessThanOrEqual(1.0001)
                expect(rc.y + rc.h).toBeLessThanOrEqual(1.0001)
            }
        }
    })

    it('resolveLayout: 名前で解決できる', () => {
        expect(resolveLayout('4コマ・格子', 4).id).toBe('grid4')
        expect(resolveLayout('grid4', 4).id).toBe('grid4')
    })

    it('resolveLayout: 名前省略時はコマ数から既定を選ぶ', () => {
        expect(resolveLayout(undefined, 1).id).toBe('full-1')
        expect(resolveLayout(undefined, 3).id).toBe('rows3')
        expect(resolveLayout('自動', 6).id).toBe('grid6')
    })

    it('resolveLayout: プリセットに無いコマ数は autoGrid', () => {
        const preset = resolveLayout(undefined, 7)
        expect(preset.id).toBe('auto')
        expect(preset.rects).toHaveLength(7)
    })

    it('autoGrid は指定コマ数ぶんの矩形を作る', () => {
        expect(autoGrid(5).rects).toHaveLength(5)
        expect(autoGrid(9).rects).toHaveLength(9)
    })

    it('instantiate は矩形数を保ち、ページ内に収める', () => {
        const preset = findPresetByName('6コマ・格子')!
        const rects = instantiate(preset, W, H)
        expect(rects).toHaveLength(6)
        for (const rc of rects) {
            expect(rc.x).toBeGreaterThanOrEqual(0)
            expect(rc.y).toBeGreaterThanOrEqual(0)
            expect(rc.x + rc.width).toBeLessThanOrEqual(W)
            expect(rc.y + rc.height).toBeLessThanOrEqual(H)
        }
    })

    it('左右2コマは読み順が右→左（先頭の方が右にある）', () => {
        const preset = findPresetByName('2コマ・左右')!
        const [right, left] = instantiate(preset, W, H)
        expect(right.x).toBeGreaterThan(left.x)
    })
})
