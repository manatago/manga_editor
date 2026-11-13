import { describe, it, expect } from 'vitest'
import { clampZoom, stepZoom, wheelZoomFactor, fitZoom, MIN_ZOOM, MAX_ZOOM, useCanvasView } from '../canvasView'

describe('canvasView', () => {
    it('clampZoom: 範囲内に収め、不正値は 100%', () => {
        expect(clampZoom(10)).toBe(MAX_ZOOM)
        expect(clampZoom(0.01)).toBe(MIN_ZOOM)
        expect(clampZoom(NaN)).toBe(1)
        expect(clampZoom(1.23456)).toBe(1.235)
    })

    it('stepZoom: 段階を順に進む／戻る。段階の間からは隣の段階へ', () => {
        expect(stepZoom(1, 1)).toBe(1.25)
        expect(stepZoom(1, -1)).toBe(0.75)
        expect(stepZoom(1.1, 1)).toBe(1.25)
        expect(stepZoom(1.1, -1)).toBe(1)
        expect(stepZoom(MAX_ZOOM, 1)).toBe(MAX_ZOOM)
        expect(stepZoom(MIN_ZOOM, -1)).toBe(MIN_ZOOM)
    })

    it('wheelZoomFactor: 上スクロールで拡大、下で縮小。大きなホイール量は抑える', () => {
        expect(wheelZoomFactor(-10)).toBeGreaterThan(1)
        expect(wheelZoomFactor(10)).toBeLessThan(1)
        expect(wheelZoomFactor(1000)).toBe(wheelZoomFactor(30))
    })

    it('fitZoom: 余白込みでページ全体が収まる倍率', () => {
        // 表示 1000x700、余白 48 → 904x604 に 840x1188 を収める → 高さ基準 604/1188
        expect(fitZoom(1000, 700, 840, 1188)).toBeCloseTo(604 / 1188, 2)
        expect(fitZoom(5000, 5000, 840, 1188)).toBe(MAX_ZOOM)
    })

    it('setZoom は範囲に収めて保持する', () => {
        useCanvasView.getState().setZoom(99)
        expect(useCanvasView.getState().zoom).toBe(MAX_ZOOM)
        useCanvasView.getState().setZoom(1)
    })
})
