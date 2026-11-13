import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useKeyboardShortcuts } from '../useKeyboardShortcuts'
import { useMangaStore } from '../../store/useMangaStore'
import { useShortcutHelp } from '../../components/ShortcutHelp'
import type { Bubble, Material, Page, Panel } from '../../store/types'

const panel = (id: string, x = 10, y = 10): Panel => ({
    id, type: 'rect', x, y, width: 50, height: 50,
    slant: 0, offsetB: 0, offsetC: 0, offsetD: 0, strokeWidth: 1, strokeColor: '#000'
})
const bubble = (id: string): Bubble => ({ id, type: 'rounded', x: 100, y: 100, width: 80, height: 60, text: 'a' }) as Bubble
const material = (id: string): Material => ({ id, imagePath: 'assets/m.png', x: 200, y: 200, width: 10, height: 10 }) as Material
const page = (id: string, extra: Partial<Page> = {}): Page => ({ id, name: id, panels: [], bubbles: [], materials: [], ...extra })

const s = () => useMangaStore.getState()
const cur = () => s().pages.find((p) => p.id === s().currentPageId)!
const press = (key: string, opts: KeyboardEventInit = {}, target: EventTarget = window) =>
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...opts }))

beforeEach(() => {
    useMangaStore.setState({
        pages: [
            page('p1', { panels: [panel('a')], bubbles: [bubble('q')], materials: [material('m')] }),
            page('p2'),
            page('p3')
        ],
        currentPageId: 'p1',
        currentProjectPath: null,
        selectedPanelId: null,
        selectedBubbleId: null,
        selectedMaterialId: null,
        selectedMosaicId: null,
        isMosaicMode: false,
        scriptEditorOpen: false,
        past: [],
        future: []
    })
    useShortcutHelp.getState().setOpen(false)
    renderHook(() => useKeyboardShortcuts())
})
afterEach(() => {
    document.body.innerHTML = ''
})

describe('矢印キーで移動', () => {
    it('コマ: 矢印で 1px、Shift+矢印で 10px', () => {
        useMangaStore.setState({ selectedPanelId: 'a' })
        press('ArrowRight')
        press('ArrowDown', { shiftKey: true })
        expect([cur().panels[0].x, cur().panels[0].y]).toEqual([11, 20])
    })

    it('吹き出しと素材も動かせる', () => {
        useMangaStore.setState({ selectedBubbleId: 'q' })
        press('ArrowLeft', { shiftKey: true })
        expect(cur().bubbles[0].x).toBe(90)

        useMangaStore.setState({ selectedBubbleId: null, selectedMaterialId: 'm' })
        press('ArrowUp')
        expect(cur().materials[0].y).toBe(199)
    })

    it('連続した移動は 1 回の Cmd+Z でまとめて戻る', () => {
        useMangaStore.setState({ selectedPanelId: 'a' })
        for (let i = 0; i < 5; i++) press('ArrowRight')
        press('z', { metaKey: true })
        expect(cur().panels[0].x).toBe(10)
    })

    it('入力欄にフォーカスがあるときは動かさない', () => {
        useMangaStore.setState({ selectedPanelId: 'a' })
        const input = document.createElement('input')
        document.body.appendChild(input)
        press('ArrowRight', {}, input)
        expect(cur().panels[0].x).toBe(10)
    })
})

describe('Cmd+D で複製', () => {
    it('選択中の吹き出しを 20px ずらして複製し、複製を選択する（クリップボードは変えない）', () => {
        useMangaStore.setState({ selectedBubbleId: 'q', clipboardBubble: null })
        press('d', { metaKey: true })
        const bs = cur().bubbles
        expect(bs).toHaveLength(2)
        expect([bs[1].x, bs[1].y]).toEqual([120, 120])
        expect(bs[1].id).not.toBe('q')
        expect(s().selectedBubbleId).toBe(bs[1].id)
        expect(s().clipboardBubble).toBeNull()
    })

    it('コマ・素材も複製できる', () => {
        useMangaStore.setState({ selectedPanelId: 'a' })
        press('d', { ctrlKey: true })
        expect(cur().panels).toHaveLength(2)
        useMangaStore.setState({ selectedPanelId: null, selectedMaterialId: 'm' })
        press('d', { metaKey: true })
        expect(cur().materials).toHaveLength(2)
    })
})

describe('Esc', () => {
    it('選択を解除する', () => {
        useMangaStore.setState({ selectedPanelId: 'a' })
        press('Escape')
        expect(s().selectedPanelId).toBeNull()
    })

    it('モザイク描画モード中はまずモードを抜ける', () => {
        useMangaStore.setState({ isMosaicMode: true, selectedPanelId: 'a' })
        press('Escape')
        expect(s().isMosaicMode).toBe(false)
    })
})

describe('PageUp / PageDown', () => {
    it('前後のページへ移動し、端では止まる', () => {
        press('PageDown')
        expect(s().currentPageId).toBe('p2')
        press('PageDown')
        press('PageDown')
        expect(s().currentPageId).toBe('p3')
        press('PageUp')
        expect(s().currentPageId).toBe('p2')
    })
})

describe('Undo / Redo', () => {
    it('Cmd+Shift+Z は key が大文字 Z で届いてもやり直しになる', () => {
        useMangaStore.setState({ selectedPanelId: 'a' })
        press('Delete')
        press('z', { metaKey: true })
        expect(cur().panels).toHaveLength(1)
        press('Z', { metaKey: true, shiftKey: true })
        expect(cur().panels).toHaveLength(0)
    })
})

describe('モーダル表示中', () => {
    it('画像合成などのモーダルが開いている間は、裏のキャンバスを操作しない（削除・Undo・移動）', () => {
        const overlay = document.createElement('div')
        overlay.className = 'fixed inset-0'
        document.body.appendChild(overlay)
        useMangaStore.setState({ selectedPanelId: 'a' })
        press('ArrowRight')
        press('Delete')
        expect(cur().panels).toHaveLength(1)
        expect(cur().panels[0].x).toBe(10)
    })

    it('台本エディタは例外で、Delete で吹き出しを消せる', () => {
        const overlay = document.createElement('div')
        overlay.className = 'fixed inset-0'
        document.body.appendChild(overlay)
        useMangaStore.setState({ scriptEditorOpen: true, selectedBubbleId: 'q' })
        press('Delete')
        expect(cur().bubbles).toHaveLength(0)
    })
})

describe('? で一覧', () => {
    it('ショートカット一覧を開く', () => {
        press('?')
        expect(useShortcutHelp.getState().open).toBe(true)
    })
})
