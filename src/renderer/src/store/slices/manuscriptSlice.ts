import { StateCreator } from 'zustand'
import type { MangaState } from '../useMangaStore'

export interface ManuscriptSlice {
    /** 作品全体の原稿メモ（manga.json に保存） */
    manuscript: string
    /** 原稿テキストエリアでの現在の選択範囲（永続化しない一時 UI 状態） */
    manuscriptSelection: { start: number; end: number } | null
    setManuscript: (text: string) => void
    setManuscriptSelection: (sel: { start: number; end: number } | null) => void
    /** 指定範囲を原稿から削除（吹き出しへ流し込んだ文字を消す用途） */
    removeManuscriptRange: (start: number, end: number) => void
}

export const createManuscriptSlice: StateCreator<MangaState, [], [], ManuscriptSlice> = (set) => ({
    manuscript: '',
    manuscriptSelection: null,

    setManuscript: (text) => set({ manuscript: text }),

    setManuscriptSelection: (sel) => set({ manuscriptSelection: sel }),

    removeManuscriptRange: (start, end) =>
        set((state) => {
            const s = Math.max(0, Math.min(start, state.manuscript.length))
            const e = Math.max(s, Math.min(end, state.manuscript.length))
            return {
                manuscript: state.manuscript.slice(0, s) + state.manuscript.slice(e),
                manuscriptSelection: null
            }
        })
})
