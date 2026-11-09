import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAutoSave, AUTO_SAVE_DEBOUNCE_MS } from '../useAutoSave'
import { useKeyboardShortcuts } from '../useKeyboardShortcuts'
import { useMangaStore } from '../../store/useMangaStore'
import type { Page } from '../../store/types'

const page = (id: string): Page => ({ id, name: id, panels: [], bubbles: [], materials: [] })

describe('useAutoSave', () => {
    const saveProject = vi.fn()
    const realSave = useMangaStore.getState().saveProject

    beforeEach(() => {
        vi.useFakeTimers()
        saveProject.mockReset()
        useMangaStore.setState({
            pages: [page('p1')],
            archivedPages: [],
            currentPageId: 'p1',
            currentProjectPath: '/proj',
            manuscript: '',
            saveProject
        })
    })
    afterEach(() => {
        useMangaStore.setState({ saveProject: realSave })
        vi.useRealTimers()
    })

    it('ページが変わると 1 秒後に 1 回だけ保存する（連続変更はデバウンス）', () => {
        renderHook(() => useAutoSave())
        useMangaStore.setState({ pages: [page('p1'), page('p2')] })
        vi.advanceTimersByTime(500)
        useMangaStore.setState({ pages: [page('p1'), page('p2'), page('p3')] })
        vi.advanceTimersByTime(AUTO_SAVE_DEBOUNCE_MS - 1)
        expect(saveProject).not.toHaveBeenCalled()
        vi.advanceTimersByTime(1)
        expect(saveProject).toHaveBeenCalledTimes(1)
    })

    it('原稿メモの変更でも保存する', () => {
        renderHook(() => useAutoSave())
        useMangaStore.setState({ manuscript: 'セリフ' })
        vi.advanceTimersByTime(AUTO_SAVE_DEBOUNCE_MS)
        expect(saveProject).toHaveBeenCalledTimes(1)
    })

    it('選択の変更など、保存対象外の変更では保存しない', () => {
        renderHook(() => useAutoSave())
        useMangaStore.setState({ selectedPanelId: 'x', isSaving: true })
        vi.advanceTimersByTime(AUTO_SAVE_DEBOUNCE_MS * 2)
        expect(saveProject).not.toHaveBeenCalled()
    })

    it('プロジェクト未オープンなら保存しない', () => {
        useMangaStore.setState({ currentProjectPath: null })
        renderHook(() => useAutoSave())
        useMangaStore.setState({ pages: [page('p9')] })
        vi.advanceTimersByTime(AUTO_SAVE_DEBOUNCE_MS * 2)
        expect(saveProject).not.toHaveBeenCalled()
    })

    it('アンマウント後は保存しない', () => {
        const { unmount } = renderHook(() => useAutoSave())
        useMangaStore.setState({ pages: [page('p2')] })
        unmount()
        vi.advanceTimersByTime(AUTO_SAVE_DEBOUNCE_MS * 2)
        expect(saveProject).not.toHaveBeenCalled()
    })
})

describe('useKeyboardShortcuts', () => {
    beforeEach(() => {
        useMangaStore.setState({
            pages: [
                {
                    ...page('p1'),
                    panels: [
                        {
                            id: 'a', type: 'rect', x: 10, y: 10, width: 50, height: 50,
                            slant: 0, offsetB: 0, offsetC: 0, offsetD: 0, strokeWidth: 1, strokeColor: '#000'
                        }
                    ]
                }
            ],
            currentPageId: 'p1',
            selectedPanelId: 'a',
            selectedBubbleId: null,
            selectedMaterialId: null,
            past: [],
            future: []
        })
    })

    const press = (key: string, opts: KeyboardEventInit = {}) =>
        window.dispatchEvent(new KeyboardEvent('keydown', { key, ...opts }))

    it('登録後に変わった状態（選択・位置）をキー押下時点で読む', () => {
        renderHook(() => useKeyboardShortcuts())
        press('ArrowRight', { shiftKey: true })
        press('ArrowRight', { shiftKey: true })
        expect(useMangaStore.getState().pages[0].panels[0].x).toBe(12)

        useMangaStore.setState({ selectedPanelId: null })
        press('ArrowRight', { shiftKey: true })
        expect(useMangaStore.getState().pages[0].panels[0].x).toBe(12)
    })

    it('Cmd+Z で undo する', () => {
        renderHook(() => useKeyboardShortcuts())
        press('Delete')
        expect(useMangaStore.getState().pages[0].panels).toHaveLength(0)
        press('z', { metaKey: true })
        expect(useMangaStore.getState().pages[0].panels).toHaveLength(1)
    })
})
