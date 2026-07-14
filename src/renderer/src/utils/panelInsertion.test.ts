import { describe, it, expect } from 'vitest'
import type { Page, Panel } from '../store/useMangaStore'
import {
    PANEL_RIGHT_MARGIN,
    PANEL_LEFT_MARGIN,
    PANEL_TOP_MARGIN,
    PANEL_VERTICAL_GAP,
    PANEL_STANDARD_HEIGHT,
    standardPanelWidth,
    computePanelInsertion
} from './panelInsertion'

const PAGE_WIDTH = 840
const PAGE_HEIGHT = 1188

function panel(overrides: Partial<Panel> = {}): Panel {
    return {
        id: Math.random().toString(36).slice(2),
        type: 'rect',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        slant: 0,
        offsetB: 0,
        offsetC: 0,
        offsetD: 0,
        strokeWidth: 1,
        strokeColor: '#000000',
        ...overrides
    }
}

function makePage(panels: Panel[]): Page {
    return {
        id: 'page-1',
        name: '001',
        panels,
        bubbles: [],
        materials: [],
        backgroundColor: '#ffffff',
        backgroundOpacity: 1,
        pageWidth: PAGE_WIDTH,
        pageHeight: PAGE_HEIGHT
    }
}

describe('computePanelInsertion', () => {
    const defaultWidth = standardPanelWidth(PAGE_WIDTH)
    const defaultHeight = PANEL_STANDARD_HEIGHT

    it('空ページではページ右上から PANEL_TOP_MARGIN の位置に置く（過去 y=100 だったバグの回帰防止）', () => {
        const result = computePanelInsertion(makePage([]), 'rect', defaultWidth, defaultHeight)
        expect(result.y).toBe(PANEL_TOP_MARGIN)
        expect(result.x).toBe(PAGE_WIDTH - defaultWidth - PANEL_RIGHT_MARGIN)
        expect(result.width).toBe(defaultWidth)
        expect(result.height).toBe(defaultHeight)
    })

    it('page が undefined の場合も初期配置と同じ結果になる', () => {
        const result = computePanelInsertion(undefined, 'rect', defaultWidth, defaultHeight)
        expect(result.y).toBe(PANEL_TOP_MARGIN)
        expect(result.x).toBe(PAGE_WIDTH - defaultWidth - PANEL_RIGHT_MARGIN)
    })

    it('下端まで余裕があれば、最下段の下に PANEL_STANDARD_HEIGHT のコマを置く', () => {
        const top = panel({ x: 10, y: 10, width: PAGE_WIDTH - 20, height: 200 })
        const result = computePanelInsertion(makePage([top]), 'rect', defaultWidth, defaultHeight)
        expect(result.y).toBe(top.y + top.height + PANEL_VERTICAL_GAP)
        expect(result.height).toBe(PANEL_STANDARD_HEIGHT)
    })

    it('下端の残り高さが PANEL_STANDARD_HEIGHT 未満 PANEL_MIN_HEIGHT 以上なら高さを縮めて入れる', () => {
        // 残り高さ 200px（MIN=100 ≤ 200 < STANDARD=300）になるように最下段を配置
        const bottom = panel({
            x: 10,
            y: 10,
            width: PAGE_WIDTH - 20,
            height: PAGE_HEIGHT - 10 - PANEL_VERTICAL_GAP - 200
        })
        const result = computePanelInsertion(makePage([bottom]), 'rect', defaultWidth, defaultHeight)
        expect(result.y).toBe(bottom.y + bottom.height + PANEL_VERTICAL_GAP)
        expect(result.height).toBe(200)
    })

    it('下端の残り高さが PANEL_MIN_HEIGHT 未満ならページ中央に配置する（過去：右上に戻ってしまっていた回帰防止）', () => {
        // 残り高さ 50px（< MIN=100）になるように最下段を配置
        const bottom = panel({
            x: 10,
            y: 10,
            width: PAGE_WIDTH - 20,
            height: PAGE_HEIGHT - 10 - PANEL_VERTICAL_GAP - 50
        })
        const result = computePanelInsertion(makePage([bottom]), 'rect', defaultWidth, defaultHeight)
        const expectedW = standardPanelWidth(PAGE_WIDTH)
        expect(result.width).toBe(expectedW)
        expect(result.height).toBe(PANEL_STANDARD_HEIGHT)
        expect(result.x).toBe(Math.round((PAGE_WIDTH - expectedW) / 2))
        expect(result.y).toBe(Math.round((PAGE_HEIGHT - PANEL_STANDARD_HEIGHT) / 2))
        // 右上に戻っていないこと
        expect(result.y).not.toBe(PANEL_TOP_MARGIN)
    })

    it('最下段の左端パネルが幅 80% 以下かつ左に余白があれば、その左隣に並べる', () => {
        // 右寄せの幅 400 のコマ（80% = 672 以下）。左端 x=300 → 280px の余白
        const right = panel({ x: 300, y: 100, width: 400, height: 200 })
        const result = computePanelInsertion(makePage([right]), 'rect', defaultWidth, defaultHeight)
        expect(result.x).toBe(PANEL_LEFT_MARGIN)
        expect(result.y).toBeLessThanOrEqual(right.y + right.height) // 同じ行に並ぶ
        expect(result.width).toBeGreaterThanOrEqual(80) // newWidth ≥ 80 の条件
    })

    it('左カラム上部に縮めたコマがある時、その下に積み下端を右の縦長コマにそろえる', () => {
        // 1番目: 右の縦長コマ、2番目: 左上に縮めたコマ
        const tallRight = panel({ x: 430, y: PANEL_TOP_MARGIN, width: 390, height: 800 })
        const shortLeft = panel({ x: PANEL_LEFT_MARGIN, y: PANEL_TOP_MARGIN, width: 390, height: 300 })
        const result = computePanelInsertion(
            makePage([tallRight, shortLeft]),
            'rect',
            defaultWidth,
            defaultHeight
        )
        // 2番目の下に積む
        expect(result.x).toBe(PANEL_LEFT_MARGIN)
        expect(result.y).toBe(shortLeft.y + shortLeft.height + PANEL_VERTICAL_GAP)
        // 下端が右の縦長コマ(1番目)の下端にそろう
        expect(result.y + result.height).toBe(tallRight.y + tallRight.height)
    })

    it('左カラムの残りが狭すぎる場合は最下段（右の縦長コマ）の下へ回す', () => {
        const tallRight = panel({ x: 430, y: PANEL_TOP_MARGIN, width: 390, height: 800 })
        // 左上のコマがほぼ下端まで占め、残りが PANEL_MIN_HEIGHT 未満
        const almostFullLeft = panel({ x: PANEL_LEFT_MARGIN, y: PANEL_TOP_MARGIN, width: 390, height: 760 })
        const result = computePanelInsertion(
            makePage([tallRight, almostFullLeft]),
            'rect',
            defaultWidth,
            defaultHeight
        )
        const maxBottomEdge = tallRight.y + tallRight.height
        // 左カラムに積まず、最下段の下（1番目の下）に置く
        expect(result.y).toBe(maxBottomEdge + PANEL_VERTICAL_GAP)
    })

    it('circle タイプは正方形に丸められる', () => {
        // 下に標準サイズで入る空のページ + 余裕あり
        const top = panel({ x: 10, y: 10, width: PAGE_WIDTH - 20, height: 200 })
        const result = computePanelInsertion(makePage([top]), 'circle', defaultWidth, defaultHeight)
        expect(result.width).toBe(result.height)
    })
})
