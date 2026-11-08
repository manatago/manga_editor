import { StateCreator } from 'zustand'
import type { MangaState } from '../useMangaStore'
import { limitHistory, resetHistoryCoalesce, snapshot, type HistoryEntry } from '../helpers'

export interface HistorySlice {
    past: HistoryEntry[]
    future: HistoryEntry[]
    /** 連続した同種の変更を 1 件にまとめるための直前キーと時刻（helpers.saveHistory 参照） */
    lastHistoryKey: string | null
    lastHistoryAt: number
    undo: () => void
    redo: () => void
}

export const createHistorySlice: StateCreator<MangaState, [], [], HistorySlice> = (set) => ({
    past: [],
    future: [],
    lastHistoryKey: null,
    lastHistoryAt: 0,

    undo: () => set((state) => {
        if (state.past.length === 0) return state
        const previous = state.past[state.past.length - 1]
        const newPast = state.past.slice(0, -1)
        return {
            past: newPast,
            future: [snapshot(state), ...state.future],
            pages: previous.pages,
            archivedPages: previous.archivedPages ?? [],
            currentPageId: previous.currentPageId,
            selectedPanelId: null,
            selectedBubbleId: null,
            selectedMaterialId: null,
            ...resetHistoryCoalesce
        }
    }),

    redo: () => set((state) => {
        if (state.future.length === 0) return state
        const next = state.future[0]
        const newFuture = state.future.slice(1)
        return {
            past: limitHistory([...state.past, snapshot(state)]),
            future: limitHistory(newFuture),
            pages: next.pages,
            archivedPages: next.archivedPages ?? [],
            currentPageId: next.currentPageId,
            selectedPanelId: null,
            selectedBubbleId: null,
            selectedMaterialId: null,
            ...resetHistoryCoalesce
        }
    })
})
