import { describe, it, expect, beforeEach } from 'vitest'
import { useMangaStore } from '../useMangaStore'

describe('manuscriptSlice', () => {
    beforeEach(() => {
        useMangaStore.setState({
            manuscript: '',
            manuscriptSelection: null
        })
    })

    it('初期値は空文字 + 選択なし', () => {
        const state = useMangaStore.getState()
        expect(state.manuscript).toBe('')
        expect(state.manuscriptSelection).toBeNull()
    })

    it('setManuscript で本文を更新できる', () => {
        useMangaStore.getState().setManuscript('こんにちは世界')
        expect(useMangaStore.getState().manuscript).toBe('こんにちは世界')
    })

    it('setManuscriptSelection で選択範囲を保存できる / null でクリアできる', () => {
        useMangaStore.getState().setManuscriptSelection({ start: 2, end: 5 })
        expect(useMangaStore.getState().manuscriptSelection).toEqual({ start: 2, end: 5 })

        useMangaStore.getState().setManuscriptSelection(null)
        expect(useMangaStore.getState().manuscriptSelection).toBeNull()
    })

    it('removeManuscriptRange は指定範囲を削除して selection をクリアする', () => {
        useMangaStore.setState({
            manuscript: 'abcdefg',
            manuscriptSelection: { start: 2, end: 5 }
        })
        useMangaStore.getState().removeManuscriptRange(2, 5)
        const state = useMangaStore.getState()
        expect(state.manuscript).toBe('abfg')
        expect(state.manuscriptSelection).toBeNull()
    })

    it('removeManuscriptRange は範囲外の値を本文長にクランプする', () => {
        useMangaStore.setState({ manuscript: 'abcd', manuscriptSelection: null })
        // end が長さを超える
        useMangaStore.getState().removeManuscriptRange(2, 999)
        expect(useMangaStore.getState().manuscript).toBe('ab')
    })

    it('removeManuscriptRange は負の start を 0 に正規化する', () => {
        useMangaStore.setState({ manuscript: 'abcd', manuscriptSelection: null })
        useMangaStore.getState().removeManuscriptRange(-5, 2)
        expect(useMangaStore.getState().manuscript).toBe('cd')
    })

    it('removeManuscriptRange は start > end になっていても何も削除しない', () => {
        useMangaStore.setState({ manuscript: 'abcd', manuscriptSelection: null })
        // 内部で end = max(s, min(end, len)) で正規化されるので、start=3, end=1 は (3,3) として扱われる
        useMangaStore.getState().removeManuscriptRange(3, 1)
        expect(useMangaStore.getState().manuscript).toBe('abcd')
    })
})

describe('manuscript persistence (project round-trip)', () => {
    beforeEach(() => {
        useMangaStore.setState({
            pages: [],
            currentPageId: null,
            currentProjectPath: null,
            referenceCharacters: [],
            backgroundLibrary: [],
            manuscript: '',
            manuscriptSelection: null
        })
    })

    it('getProjectData は manuscript を含める', () => {
        useMangaStore.getState().setManuscript('保存対象の原稿')
        const data = useMangaStore.getState().getProjectData()
        expect(data.manuscript).toBe('保存対象の原稿')
    })

    it('setProjectData で manuscript フィールドを復元できる', () => {
        useMangaStore.getState().setProjectData({
            pages: [],
            lastPageId: null,
            manuscript: '読み込まれた原稿'
        })
        expect(useMangaStore.getState().manuscript).toBe('読み込まれた原稿')
    })

    it('manuscript を持たない古いプロジェクトを読み込んだ場合は空文字になる（互換性）', () => {
        useMangaStore.setState({ manuscript: '前の値' })
        useMangaStore.getState().setProjectData({
            pages: [],
            lastPageId: null
            // manuscript なし
        })
        expect(useMangaStore.getState().manuscript).toBe('')
    })

    it('setProjectData は manuscriptSelection をリセットする（プロジェクト切替で stale な選択が残らない）', () => {
        useMangaStore.setState({ manuscriptSelection: { start: 0, end: 3 } })
        useMangaStore.getState().setProjectData({
            pages: [],
            lastPageId: null,
            manuscript: 'reset'
        })
        expect(useMangaStore.getState().manuscriptSelection).toBeNull()
    })
})
