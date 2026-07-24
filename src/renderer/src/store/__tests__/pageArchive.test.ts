import { describe, it, expect, beforeEach } from 'vitest'
import { useMangaStore } from '../useMangaStore'
import type { Page } from '../types'

/** テスト用の最小ページ */
function makePage(id: string, name: string): Page {
    return {
        id,
        name,
        panels: [],
        bubbles: [],
        materials: []
    }
}

describe('pageSlice アーカイブ（保管）機能', () => {
    beforeEach(() => {
        useMangaStore.setState({
            pages: [makePage('p1', '001'), makePage('p2', '002'), makePage('p3', '003')],
            archivedPages: [],
            currentPageId: 'p2',
            past: [],
            future: []
        })
    })

    it('removePage は完全削除せず archivedPages へ移す（本編からは消え、ページ番号は振り直す）', () => {
        useMangaStore.getState().removePage('p2')
        const s = useMangaStore.getState()
        expect(s.pages.map((p) => p.id)).toEqual(['p1', 'p3'])
        expect(s.pages.map((p) => p.name)).toEqual(['001', '002'])
        expect(s.archivedPages.map((p) => p.id)).toEqual(['p2'])
        expect(s.archivedPages[0].archivedAt).toBeTypeOf('number')
    })

    it('新しく削除したページほど archivedPages の先頭に来る', () => {
        useMangaStore.getState().removePage('p1')
        useMangaStore.getState().removePage('p3')
        expect(useMangaStore.getState().archivedPages.map((p) => p.id)).toEqual(['p3', 'p1'])
    })

    it('restorePage は保管ページを本編末尾に戻し、番号を振り直す', () => {
        useMangaStore.getState().removePage('p1')
        useMangaStore.getState().restorePage('p1')
        const s = useMangaStore.getState()
        expect(s.pages.map((p) => p.id)).toEqual(['p2', 'p3', 'p1'])
        expect(s.pages.map((p) => p.name)).toEqual(['001', '002', '003'])
        expect(s.archivedPages).toHaveLength(0)
        expect(s.currentPageId).toBe('p1')
        // 復元後は archivedAt を持たない
        expect(s.pages.find((p) => p.id === 'p1')?.archivedAt).toBeUndefined()
    })

    it('復元時に id が本編と衝突する場合は新しい id を振る', () => {
        useMangaStore.getState().removePage('p1')
        // 保管中に同じ id のページが本編へ復活しているケースを再現
        useMangaStore.setState({ pages: [...useMangaStore.getState().pages, makePage('p1', '003')] })
        useMangaStore.getState().restorePage('p1')
        const s = useMangaStore.getState()
        const ids = s.pages.map((p) => p.id)
        expect(new Set(ids).size).toBe(ids.length) // 重複なし
        expect(s.archivedPages).toHaveLength(0)
    })

    it('deleteArchivedPage は保管ページを完全に削除する（本編は不変）', () => {
        useMangaStore.getState().removePage('p2')
        useMangaStore.getState().deleteArchivedPage('p2')
        const s = useMangaStore.getState()
        expect(s.archivedPages).toHaveLength(0)
        expect(s.pages.map((p) => p.id)).toEqual(['p1', 'p3'])
    })

    it('削除→undo で本編もアーカイブも元の状態に戻る（重複が生じない）', () => {
        useMangaStore.getState().removePage('p2')
        useMangaStore.getState().undo()
        const s = useMangaStore.getState()
        expect(s.pages.map((p) => p.id)).toEqual(['p1', 'p2', 'p3'])
        expect(s.archivedPages).toHaveLength(0)
    })
})
