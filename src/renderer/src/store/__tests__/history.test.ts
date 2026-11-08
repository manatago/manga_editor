import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useMangaStore } from '../useMangaStore'
import { HISTORY_COALESCE_MS } from '../helpers'
import type { Bubble, Page, Panel } from '../types'

function panel(id: string, overrides: Partial<Panel> = {}): Panel {
    return {
        id,
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

function page(id: string, panels: Panel[] = [], bubbles: Bubble[] = []): Page {
    return { id, name: id, panels, bubbles, materials: [] }
}

const s = () => useMangaStore.getState()
const panelX = () => s().pages[0].panels[0].x

describe('Undo 履歴', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
        useMangaStore.setState({
            pages: [page('p1', [panel('a'), panel('b')])],
            archivedPages: [],
            currentPageId: 'p1',
            past: [],
            future: [],
            lastHistoryKey: null,
            lastHistoryAt: 0,
            selectedPanelId: null,
            selectedBubbleId: null,
            selectedMaterialId: null
        })
    })
    afterEach(() => {
        vi.useRealTimers()
    })

    it('同じコマの同じ項目への連続変更（スライダー操作）は 1 件にまとまる', () => {
        for (let x = 1; x <= 30; x++) {
            s().updatePanel('a', { x })
            vi.advanceTimersByTime(16)
        }
        expect(s().past).toHaveLength(1)
        expect(panelX()).toBe(30)

        s().undo()
        expect(panelX()).toBe(0)
    })

    it('間隔が空いた変更は別の履歴になる', () => {
        s().updatePanel('a', { x: 10 })
        vi.advanceTimersByTime(HISTORY_COALESCE_MS + 1)
        s().updatePanel('a', { x: 20 })
        expect(s().past).toHaveLength(2)

        s().undo()
        expect(panelX()).toBe(10)
    })

    it('違うコマ・違う項目への変更はまとめない', () => {
        s().updatePanel('a', { x: 10 })
        s().updatePanel('b', { x: 10 })
        s().updatePanel('b', { y: 10 })
        expect(s().past).toHaveLength(3)
    })

    it('間に別の操作を挟んだらまとめない', () => {
        s().updatePanel('a', { x: 10 })
        s().addPanel({ x: 0, y: 0, width: 10, height: 10, type: 'rect' })
        s().updatePanel('a', { x: 20 })
        expect(s().past).toHaveLength(3)
    })

    it('undo 直後の変更は前の操作とまとめない', () => {
        s().updatePanel('a', { x: 10 })
        s().updatePanel('a', { x: 20 })
        s().undo()
        s().updatePanel('a', { x: 30 })
        expect(s().past).toHaveLength(1)
        s().undo()
        expect(panelX()).toBe(0)
    })

    it('まとめた変更でも redo 履歴は破棄される', () => {
        s().updatePanel('a', { x: 10 })
        vi.advanceTimersByTime(HISTORY_COALESCE_MS + 1)
        s().updatePanel('a', { x: 20 })
        s().undo()
        expect(s().future).toHaveLength(1)
        s().updatePanel('a', { x: 15 })
        expect(s().future).toHaveLength(0)
    })

    it('履歴は参照を保持し、以後の編集で過去の状態が変わらない', () => {
        const before = s().pages
        s().updatePanel('a', { x: 10 })
        expect(s().past[0].pages).toBe(before)
        expect(before[0].panels[0].x).toBe(0)
    })

    it('undo で素材の選択も解除される', () => {
        s().updatePanel('a', { x: 10 })
        useMangaStore.setState({ selectedMaterialId: 'm1' })
        s().undo()
        expect(s().selectedMaterialId).toBeNull()
    })

    it('吹き出しのドラッグ中の更新もまとめて 1 回の undo で元に戻る', () => {
        const bubble = { id: 'q', x: 0, y: 0, tailX: 0, tailY: 0 } as Bubble
        useMangaStore.setState({ pages: [page('p1', [panel('a')], [bubble])] })
        for (let i = 1; i <= 10; i++) {
            s().updateBubble('q', { tailX: i * 5, tailY: i })
            vi.advanceTimersByTime(16)
        }
        expect(s().past).toHaveLength(1)
        s().undo()
        expect(s().pages[0].bubbles[0].tailX).toBe(0)
    })

    it('プロジェクトを読み込むと履歴が消え、前のプロジェクトへ undo できない', () => {
        s().updatePanel('a', { x: 10 })
        s().setProjectData({ pages: [page('other', [panel('z')])] })
        expect(s().past).toHaveLength(0)
        expect(s().future).toHaveLength(0)

        s().undo()
        expect(s().pages[0].id).toBe('other')
    })
})
