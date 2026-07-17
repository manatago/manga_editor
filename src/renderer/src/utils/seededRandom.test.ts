import { describe, it, expect } from 'vitest'
import { hashStringSeed, sinRandom } from './seededRandom'

describe('seededRandom', () => {
    it('hashStringSeed は文字コードの総和で決定的', () => {
        expect(hashStringSeed('abc')).toBe(97 + 98 + 99)
        expect(hashStringSeed('')).toBe(0)
        expect(hashStringSeed('panel-42')).toBe(hashStringSeed('panel-42'))
    })

    it('sinRandom は 0..1 を返し決定的', () => {
        for (let i = 0; i < 100; i++) {
            const v = sinRandom(i * 1.37)
            expect(v).toBeGreaterThanOrEqual(0)
            expect(v).toBeLessThan(1)
        }
        expect(sinRandom(42)).toBe(sinRandom(42))
    })

    it('従来のインライン式と同値（挙動保持の保証）', () => {
        const inline = (s: number): number => {
            const x = Math.sin(s) * 10000
            return x - Math.floor(x)
        }
        for (const s of [0, 1, 2.5, 100, 1234.56, -7, 999999]) {
            expect(sinRandom(s)).toBe(inline(s))
        }
    })
})
