import { StateCreator } from 'zustand'
import type { MangaState } from '../useMangaStore'
import type { Page, Panel } from '../types'
import { saveHistory } from '../helpers'

export interface SelectPageOptions {
    /** 一括エクスポート等でページを素早く切り替えるとき true（毎回の saveProject を省略） */
    skipAutosave?: boolean
}

export interface PageSlice {
    pages: Page[]
    currentPageId: string | null
    addPage: (panels?: Omit<Panel, 'id'>[]) => void
    selectPage: (id: string, options?: SelectPageOptions) => void
    removePage: (id: string) => void
    updatePage: (id: string, updates: Partial<Page>) => void
    movePage: (id: string, direction: 'up' | 'down') => void
}

export const createPageSlice: StateCreator<MangaState, [], [], PageSlice> = (set, get) => ({
    pages: [],
    currentPageId: null,

    addPage: (panels = []) => set((state) => {
        const history = saveHistory(state)
        const newPage: Page = {
            id: `page_${new Date().getTime()}`,
            name: String(state.pages.length + 1).padStart(3, '0'),
            pageWidth: 840,
            pageHeight: 1188,
            gridEnabled: false,
            gridSize: 24,
            panels: panels.map(p => ({
                id: `panel_${Math.random().toString(36).substr(2, 9)}`,
                ...p
            })) as Panel[],
            bubbles: [],
            materials: [],
            backgroundColor: '#ffffff',
            backgroundOpacity: 1
        }
        return {
            ...state,
            ...history,
            pages: [...state.pages, newPage],
            currentPageId: newPage.id,
            selectedPanelId: null,
            selectedBubbleId: null,
            selectedMaterialId: null
        }
    }),

    selectPage: (id, options) => {
        set({ currentPageId: id, selectedPanelId: null, selectedBubbleId: null, selectedMaterialId: null })
        const state = get()
        if (!options?.skipAutosave && state.currentProjectPath) {
            state.saveProject()
        }
    },

    removePage: (id) => set((state) => {
        const index = state.pages.findIndex((p) => p.id === id)
        if (index === -1) return state

        const history = saveHistory(state)
        const newPages = state.pages.filter((p) => p.id !== id)
        const normalizedPages = newPages.map((p, i) => ({
            ...p,
            name: String(i + 1).padStart(3, '0')
        }))

        let newCurrentPageId = state.currentPageId
        if (state.currentPageId === id) {
            const nextIdx = Math.min(index, normalizedPages.length - 1)
            newCurrentPageId = normalizedPages[nextIdx]?.id || null
        }

        return {
            ...state,
            ...history,
            pages: normalizedPages,
            currentPageId: newCurrentPageId,
            selectedPanelId: null,
            selectedBubbleId: null,
            selectedMaterialId: null
        }
    }),

    updatePage: (id, updates) => set((state) => {
        const history = saveHistory(state)
        return {
            ...state,
            ...history,
            pages: state.pages.map((p) => (p.id === id ? { ...p, ...updates } : p))
        }
    }),

    movePage: (id, direction) => set((state) => {
        const index = state.pages.findIndex((p) => p.id === id)
        if (index === -1) return state

        const newPages = [...state.pages]
        const targetIndex = direction === 'up' ? index - 1 : index + 1
        if (targetIndex < 0 || targetIndex >= newPages.length) return state

        const [movedPage] = newPages.splice(index, 1)
        newPages.splice(targetIndex, 0, movedPage)

        const history = saveHistory(state)
        const normalizedPages = newPages.map((p, i) => ({
            ...p,
            name: String(i + 1).padStart(3, '0')
        }))

        return { ...state, ...history, pages: normalizedPages }
    })
})
