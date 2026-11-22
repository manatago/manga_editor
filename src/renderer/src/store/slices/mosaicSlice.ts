import { StateCreator } from 'zustand'
import type { MangaState } from '../useMangaStore'
import type { MosaicType, MosaicRegion } from '../types'
import { historyKey, saveHistory } from '../helpers'

export interface MosaicSlice {
    mosaicType: MosaicType
    mosaicVisible: boolean
    isMosaicMode: boolean
    selectedMosaicId: string | null
    addMosaic: (region: Omit<MosaicRegion, 'id'>) => void
    removeMosaic: (mosaicId: string) => void
    updateMosaicType: (mosaicId: string, type: MosaicType) => void
    updateMosaic: (mosaicId: string, updates: Partial<Omit<MosaicRegion, 'id'>>, undoable?: boolean) => void
    setMosaicType: (type: MosaicType) => void
    setMosaicVisible: (visible: boolean) => void
    setIsMosaicMode: (mode: boolean) => void
    setSelectedMosaicId: (id: string | null) => void
}

export const createMosaicSlice: StateCreator<MangaState, [], [], MosaicSlice> = (set, get) => ({
    mosaicType: 'pixel-12',
    mosaicVisible: true,
    isMosaicMode: false,
    selectedMosaicId: null,

    addMosaic: (region) => {
        const state = get()
        if (!state.currentPageId) return
        const newMosaic: MosaicRegion = {
            ...region,
            id: `mosaic-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        }
        set({
            ...saveHistory(state),
            pages: state.pages.map((p) =>
                p.id === state.currentPageId
                    ? { ...p, mosaics: [...(p.mosaics || []), newMosaic] }
                    : p
            )
        })
    },

    removeMosaic: (mosaicId) => {
        const state = get()
        if (!state.currentPageId) return
        set({
            ...saveHistory(state),
            pages: state.pages.map((p) =>
                p.id === state.currentPageId
                    ? { ...p, mosaics: (p.mosaics || []).filter((m) => m.id !== mosaicId) }
                    : p
            )
        })
    },

    updateMosaicType: (mosaicId, type) => {
        const state = get()
        if (!state.currentPageId) return
        set({
            ...saveHistory(state),
            pages: state.pages.map((p) =>
                p.id === state.currentPageId
                    ? { ...p, mosaics: (p.mosaics || []).map((m) => m.id === mosaicId ? { ...m, type } : m) }
                    : p
            )
        })
    },

    updateMosaic: (mosaicId, updates, undoable = true) => {
        const state = get()
        if (!state.currentPageId) return
        // 同じ領域・同じ項目の連続更新（スライダー等）は1エントリにまとめる
        const history = undoable ? saveHistory(state, historyKey('mosaic', mosaicId, updates)) : {}
        set({
            ...history,
            pages: state.pages.map((p) =>
                p.id === state.currentPageId
                    ? { ...p, mosaics: (p.mosaics || []).map((m) => m.id === mosaicId ? { ...m, ...updates } : m) }
                    : p
            )
        })
    },

    setMosaicType: (type) => set({ mosaicType: type }),
    setMosaicVisible: (visible) => set({ mosaicVisible: visible }),
    setIsMosaicMode: (mode) => set({ isMosaicMode: mode, selectedMosaicId: null }),
    setSelectedMosaicId: (id) => set({ selectedMosaicId: id })
})
