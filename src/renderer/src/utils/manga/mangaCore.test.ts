import { describe, it, expect } from 'vitest'
import { quantize, dotInk, lineInk, mangaPixels, adjustBrightnessContrast, luma } from './mangaCore'

describe('quantize', () => {
    it('levels<2 は素通し', () => {
        expect(quantize(123, 1)).toBe(123)
        expect(quantize(123, 0)).toBe(123)
    })
    it('いちばん暗い段は黒・いちばん明るい段は白', () => {
        expect(quantize(0, 4)).toBe(0)
        expect(quantize(255, 4)).toBe(255)
    })
    it('中間は 12〜50% の濃さ（純黒・純白にはしない）', () => {
        const mid = quantize(128, 4)
        expect(mid).toBeGreaterThan(0)
        expect(mid).toBeLessThan(255)
    })
})

describe('dotInk', () => {
    it('真っ白は塗らない・真っ黒は塗る', () => {
        expect(dotInk(0, 0, 0, 6)).toBe(0)
        expect(dotInk(0, 0, 1, 6)).toBe(1)
    })
    it('中間の濃さは 0〜1 に収まる', () => {
        const v = dotInk(3, 5, 0.5, 6)
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(1)
    })
})

describe('lineInk', () => {
    it('strength<=0 なら線なし', () => {
        expect(lineInk(0, 255, 0)).toBe(0)
    })
    it('周りより暗い（far>near）ほど濃い', () => {
        const weak = lineInk(100, 120, 60)
        const strong = lineInk(50, 200, 60)
        expect(strong).toBeGreaterThan(weak)
    })
})

describe('adjustBrightnessContrast', () => {
    it('明るさを上げると各画素が明るくなる・α はそのまま', () => {
        const src = new Uint8ClampedArray([100, 100, 100, 200])
        const out = new Uint8ClampedArray(4)
        adjustBrightnessContrast(src, out, 50, 0)
        expect(out[0]).toBeGreaterThan(100)
        expect(out[3]).toBe(200)
    })
})

describe('mangaPixels', () => {
    it('白黒（R=G=B）になり α は保持される', () => {
        const w = 2,
            h = 2
        const src = new Uint8ClampedArray(w * h * 4)
        for (let i = 0; i < src.length; i += 4) {
            src[i] = 200
            src[i + 1] = 50
            src[i + 2] = 10
            src[i + 3] = 128
        }
        const out = new Uint8ClampedArray(src.length)
        mangaPixels(src, out, w, { levels: 4, dots: 0, lines: 0 })
        for (let i = 0; i < out.length; i += 4) {
            expect(out[i]).toBe(out[i + 1])
            expect(out[i + 1]).toBe(out[i + 2])
            expect(out[i + 3]).toBe(128)
        }
    })
    it('灰色の値は元画像の輝度に対応する', () => {
        const src = new Uint8ClampedArray([255, 255, 255, 255])
        const out = new Uint8ClampedArray(4)
        mangaPixels(src, out, 1, { levels: 4, dots: 0, lines: 0 })
        // 真っ白 → quantize で白のまま
        expect(out[0]).toBe(Math.round(quantize(luma(255, 255, 255), 4)))
    })
})
