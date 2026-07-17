import { describe, it, expect } from 'vitest'
import { contiguousMask, globalMask, applyMask, boxBlur1ch } from './wandMask'

/** [r,g,b,a] の並びから RGBA バッファを作る */
function img(pixels: number[][]): Uint8ClampedArray {
    const d = new Uint8ClampedArray(pixels.length * 4)
    pixels.forEach((p, i) => {
        d[i * 4] = p[0]
        d[i * 4 + 1] = p[1]
        d[i * 4 + 2] = p[2]
        d[i * 4 + 3] = p[3]
    })
    return d
}

const W = [255, 255, 255, 255]
const B = [0, 0, 0, 255]
const CLEAR = [255, 255, 255, 0]

describe('globalMask', () => {
    it('色が近い画素をすべて選ぶ（連結性を無視）', () => {
        // 白・黒・白 の 3x1。開始は白。
        const data = img([W, B, W])
        const mask = globalMask(data, 3, 1, 0, 0, 30)
        expect(Array.from(mask)).toEqual([1, 0, 1])
    })

    it('開始画素がすでに透明なら空マスク', () => {
        const data = img([CLEAR, W])
        const mask = globalMask(data, 2, 1, 0, 0, 30)
        expect(Array.from(mask)).toEqual([0, 0])
    })
})

describe('contiguousMask', () => {
    it('繋がった同色だけを選び、異色の壁は越えない', () => {
        // 白・黒・白。開始は左の白。黒で分断され、右の白は選ばれない。
        const data = img([W, B, W])
        const mask = contiguousMask(data, 3, 1, 0, 0, 30)
        expect(Array.from(mask)).toEqual([1, 0, 0])
    })

    it('透明画素は跨がない', () => {
        const data = img([W, CLEAR, W])
        const mask = contiguousMask(data, 3, 1, 0, 0, 30)
        expect(Array.from(mask)).toEqual([1, 0, 0])
    })
})

describe('boxBlur1ch', () => {
    it('radius<1 は入力をそのまま返す', () => {
        const src = new Float32Array([1, 0, 1])
        expect(boxBlur1ch(src, 3, 1, 0)).toBe(src)
    })
})

describe('applyMask', () => {
    it('feather 0 はマスク部分を二値で透明化', () => {
        const data = img([W, W])
        applyMask(data, new Uint8Array([1, 0]), 2, 1, 0)
        expect(data[3]).toBe(0) // p0 alpha
        expect(data[7]).toBe(255) // p1 alpha
    })

    it('feather>0 は境界のアルファを段階的に下げる（挙動固定）', () => {
        const data = img([W, W, W, W, W])
        applyMask(data, new Uint8Array([1, 1, 1, 0, 0]), 5, 1, 1)
        const alphas = [data[3], data[7], data[11], data[15], data[19]]
        expect(alphas).toEqual([0, 0, 85, 170, 255])
    })
})
