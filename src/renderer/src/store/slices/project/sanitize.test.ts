import { describe, it, expect } from 'vitest'
import type { Page, Panel } from '../../types'
import { sanitizePage } from './sanitize'

/**
 * sanitizePage → sanitizePanel の特性テスト。
 * 保存時の既定値付与とラウンドトリップ（設定値の保持）を固定し、
 * 今後のリファクタで挙動が変わらないことを保証する。
 */

function panel(overrides: Partial<Panel> = {}): Panel {
    return {
        id: 'p1',
        type: 'rect',
        x: 10,
        y: 20,
        width: 200,
        height: 150,
        rotation: 0,
        slant: 0,
        offsetB: 0,
        offsetC: 0,
        offsetD: 0,
        strokeWidth: 1,
        strokeColor: '#000000',
        ...overrides
    }
}

function pageWith(p: Panel): Page {
    return {
        id: 'page-1',
        name: '001',
        panels: [p],
        bubbles: [],
        materials: [],
        backgroundColor: '#ffffff',
        backgroundOpacity: 1,
        pageWidth: 840,
        pageHeight: 1188
    } as Page
}

const firstPanel = (p: Panel): Panel => sanitizePage(pageWith(p), null).panels[0]

describe('sanitizePanel（sanitizePage 経由）', () => {
    it('エフェクト系フィールドは未指定なら既定値が入る', () => {
        const r = firstPanel(panel())
        expect(r.effectsBehindImage).toBe(false)
        expect(r.hasSpeedLines).toBe(false)
        expect(r.speedLineDensity).toBe(120)
        expect(r.speedLineOpacity).toBe(0.85)
        expect(r.speedLineDirection).toBe('horizontal')
        expect(r.hasBubbleEffect).toBe(false)
        expect(r.bubbleEffectDensity).toBe(20)
        expect(r.bubbleEffectOpacity).toBe(0.5)
    })

    it('点描サークルの既定値', () => {
        const r = firstPanel(panel())
        expect(r.hasDotCircles).toBe(false)
        expect(r.dotCircleCount).toBe(8)
        expect(r.dotCircleOpacity).toBe(0.85)
        expect(r.dotCircleSeed).toBe(0)
        expect(r.dotCircleSize).toBe(0.5)
        expect(r.dotCircleDensity).toBe(1)
        expect(r.dotCircleColor).toBe('black')
    })

    it('砂嵐・はみ出し背景の既定値', () => {
        const r = firstPanel(panel())
        expect(r.hasSandStorm).toBe(false)
        expect(r.sandStormDensity).toBe(0.5)
        expect(r.sandStormOpacity).toBe(0.6)
        expect(r.imageProtrude).toBe(false)
        expect(r.protrudeBgOpacity).toBe(1)
        expect(r.protrudeBgBlur).toBe(0)
    })

    it('設定した値はそのまま保持される（ラウンドトリップ）', () => {
        const r = firstPanel(
            panel({
                imageProtrude: true,
                protrudeBgOpacity: 0.4,
                protrudeBgBlur: 12,
                effectsBehindImage: true,
                hasSpeedLines: true,
                speedLineDirection: 'vertical',
                speedLineDensity: 300,
                hasDotCircles: true,
                dotCircleColor: 'white',
                dotCircleSize: 1.2,
                dotCircleDensity: 2.5,
                dotCircleSeed: 4242
            })
        )
        expect(r.imageProtrude).toBe(true)
        expect(r.protrudeBgOpacity).toBe(0.4)
        expect(r.protrudeBgBlur).toBe(12)
        expect(r.effectsBehindImage).toBe(true)
        expect(r.hasSpeedLines).toBe(true)
        expect(r.speedLineDirection).toBe('vertical')
        expect(r.speedLineDensity).toBe(300)
        expect(r.hasDotCircles).toBe(true)
        expect(r.dotCircleColor).toBe('white')
        expect(r.dotCircleSize).toBe(1.2)
        expect(r.dotCircleDensity).toBe(2.5)
        expect(r.dotCircleSeed).toBe(4242)
    })
})
