import { StateCreator } from 'zustand'
import type { MangaState } from '../useMangaStore'
import { limitHistory, deepClone, type HistoryEntry } from '../helpers'

export interface HistorySlice {
    past: HistoryEntry[]
    future: HistoryEntry[]
    undo: () => void
    redo: () => void
}

export const createHistorySlice: StateCreator<MangaState, [], [], HistorySlice> = (set) => ({
    past: [],
    future: [],

    undo: () => set((state) => {
        if (state.past.length === 0) return state
        const previous = state.past[state.past.length - 1]
        const newPast = state.past.slice(0, -1)
        return {
            past: newPast,
            future: [{ pages: deepClone(state.pages), currentPageId: state.currentPageId }, ...state.future],
            pages: previous.pages,
            currentPageId: previous.currentPageId,
            selectedPanelId: null,
            selectedBubbleId: null
        }
    }),

    redo: () => set((state) => {
        if (state.future.length === 0) return state
        const next = state.future[0]
        const newFuture = state.future.slice(1)
        return {
            past: limitHistory([...state.past, { pages: deepClone(state.pages), currentPageId: state.currentPageId }]),
            future: limitHistory(newFuture),
            pages: next.pages,
            currentPageId: next.currentPageId,
            selectedPanelId: null,
            selectedBubbleId: null,
            selectedMaterialId: null
        }
    })
})
