import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useMangaStore } from '../useMangaStore'
import type { Page, Panel } from '../types'

/**
 * ストア操作（追加・更新・削除・コピペ・並べ替え）の特性テスト。
 * リファクタで挙動が変わらないことを保証する。
 */

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

function page(id: string, panels: Panel[] = []): Page {
    return { id, name: id, panels, bubbles: [], materials: [] }
}

const s = () => useMangaStore.getState()
const cur = (): Page => s().pages.find((p) => p.id === s().currentPageId)!

beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    useMangaStore.setState({
        pages: [page('p1', [panel('a'), panel('b'), panel('c')]), page('p2')],
        archivedPages: [],
        currentPageId: 'p1',
        currentProjectPath: null,
        past: [],
        future: [],
        lastHistoryKey: null,
        lastHistoryAt: 0,
        selectedPanelId: null,
        selectedBubbleId: null,
        selectedMaterialId: null,
        clipboardPanel: null,
        clipboardBubble: null
    })
})
afterEach(() => {
    vi.useRealTimers()
})

describe('コマ', () => {
    it('reorderPanel: 最前面・最背面・前へ・後ろへ', () => {
        const order = () => cur().panels.map((p) => p.id).join('')
        s().reorderPanel('a', 'front')
        expect(order()).toBe('bca')
        s().reorderPanel('a', 'back')
        expect(order()).toBe('abc')
        s().reorderPanel('a', 'up')
        expect(order()).toBe('bac')
        s().reorderPanel('a', 'down')
        expect(order()).toBe('abc')
    })

    it('copyPanel → pastePanel: 新しい ID で 20px ずらして貼り、貼ったコマを選択する', () => {
        s().updatePanel('a', { x: 10, y: 30 })
        s().copyPanel('a')
        s().pastePanel()
        const pasted = cur().panels[3]
        expect(pasted.id).not.toBe('a')
        expect([pasted.x, pasted.y]).toEqual([30, 50])
        expect(s().selectedPanelId).toBe(pasted.id)
    })

    it('同じ時刻に連続で貼り付けても ID が重複しない', () => {
        s().copyPanel('a')
        s().pastePanel()
        s().pastePanel()
        const ids = cur().panels.map((p) => p.id)
        expect(new Set(ids).size).toBe(ids.length)
    })

    it('別ページに貼り付けられる', () => {
        s().copyPanel('a')
        useMangaStore.setState({ currentPageId: 'p2' })
        s().pastePanel()
        expect(cur().panels).toHaveLength(1)
        expect(s().pages[0].panels).toHaveLength(3)
    })

    it('updatePanel は現在ページのコマだけを変更する', () => {
        useMangaStore.setState({ pages: [page('p1', [panel('a')]), page('p2', [panel('a')])] })
        s().updatePanel('a', { x: 99 })
        expect(s().pages[0].panels[0].x).toBe(99)
        expect(s().pages[1].panels[0].x).toBe(0)
    })
})

describe('吹き出し', () => {
    it('addBubble → updateBubble → removeBubble', () => {
        s().addBubble({ type: 'rounded', panelId: 'a', x: 5, y: 6 })
        const id = s().selectedBubbleId!
        expect(cur().bubbles.map((b) => b.id)).toEqual([id])
        expect(s().selectedPanelId).toBeNull()

        s().updateBubble(id, { text: 'こんにちは' })
        expect(cur().bubbles[0].text).toBe('こんにちは')

        s().removeBubble(id)
        expect(cur().bubbles).toHaveLength(0)
    })

    it('copyBubble → pasteBubble: 20px ずらし、連続貼り付けでも ID が重複しない', () => {
        s().addBubble({ type: 'rounded', panelId: 'a', x: 5, y: 6 })
        const id = s().selectedBubbleId!
        s().copyBubble(id)
        s().pasteBubble()
        s().pasteBubble()
        const bubbles = cur().bubbles
        expect(bubbles).toHaveLength(3)
        expect([bubbles[1].x, bubbles[1].y]).toEqual([25, 26])
        expect(new Set(bubbles.map((b) => b.id)).size).toBe(3)
    })
})

describe('素材', () => {
    it('addMaterial は既定値を持ち、選択状態にする。連続追加でも ID が重複しない', () => {
        s().addMaterial({ imagePath: 'assets/x.png' })
        s().addMaterial({ imagePath: 'assets/y.png' })
        const mats = cur().materials
        expect(mats).toHaveLength(2)
        expect(mats[0]).toMatchObject({ imagePath: 'assets/x.png', opacity: 1, rotation: 0, isClipped: false })
        expect(new Set(mats.map((m) => m.id)).size).toBe(2)
        expect(s().selectedMaterialId).toBe(mats[1].id)
    })

    it('updateMaterial / removeMaterial', () => {
        s().addMaterial({ imagePath: 'assets/x.png' })
        const id = s().selectedMaterialId!
        s().updateMaterial(id, { opacity: 0.5 })
        expect(cur().materials[0].opacity).toBe(0.5)
        s().removeMaterial(id)
        expect(cur().materials).toHaveLength(0)
    })
})

describe('ページ', () => {
    it('addPage は末尾に追加して表示を切り替え、テンプレのコマには新しい ID を振る', () => {
        s().addPage([{ ...panel('ignored'), x: 7 }].map(({ id: _id, ...rest }) => rest))
        const added = s().pages[2]
        expect(s().currentPageId).toBe(added.id)
        expect(added.name).toBe('003')
        expect(added.panels[0].x).toBe(7)
        expect(added.panels[0].id).toBeTruthy()
    })

    it('同じ時刻に連続で addPage しても ID が重複しない', () => {
        s().addPage()
        s().addPage()
        const ids = s().pages.map((p) => p.id)
        expect(new Set(ids).size).toBe(ids.length)
    })

    it('movePage は入れ替えてページ名を振り直す。端では何もしない', () => {
        s().movePage('p2', 'up')
        expect(s().pages.map((p) => [p.id, p.name])).toEqual([
            ['p2', '001'],
            ['p1', '002']
        ])
        const before = s().pages
        s().movePage('p2', 'up')
        expect(s().pages).toBe(before)
    })

    it('updatePage は指定ページだけを更新する', () => {
        s().updatePage('p2', { backgroundColor: '#000000' })
        expect(s().pages[1].backgroundColor).toBe('#000000')
        expect(s().pages[0].backgroundColor).toBeUndefined()
    })
})

describe('モザイク', () => {
    it('addMosaic → updateMosaicType → removeMosaic（それぞれ undo 可能）', () => {
        s().addMosaic({ x: 0, y: 0, width: 10, height: 10, type: 'pixel-12' })
        const id = cur().mosaics![0].id
        s().updateMosaicType(id, 'frosted')
        expect(cur().mosaics![0].type).toBe('frosted')
        s().removeMosaic(id)
        expect(cur().mosaics).toHaveLength(0)

        s().undo()
        expect(cur().mosaics![0].type).toBe('frosted')
        s().undo()
        expect(cur().mosaics![0].type).toBe('pixel-12')
        s().undo()
        expect(cur().mosaics ?? []).toHaveLength(0)
    })
})
