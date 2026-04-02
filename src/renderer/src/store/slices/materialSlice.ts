import { StateCreator } from 'zustand'
import type { MangaState } from '../useMangaStore'
import type { Material } from '../types'
import { saveHistory } from '../helpers'

export interface MaterialSlice {
    selectedMaterialId: string | null
    setSelectedMaterial: (id: string | null) => void
    addMaterial: (props: Partial<Omit<Material, 'id'>>) => void
    updateMaterial: (id: string, updates: Partial<Material>, undoable?: boolean) => void
    removeMaterial: (id: string) => void
}

export const createMaterialSlice: StateCreator<MangaState, [], [], MaterialSlice> = (set) => ({
    selectedMaterialId: null,

    setSelectedMaterial: (id) => set({ selectedMaterialId: id, selectedPanelId: null, selectedBubbleId: null }),

    addMaterial: (props) => set((state) => {
        if (!state.currentPageId) return state
        const history = saveHistory(state)
        const newMaterial: Material = {
            id: `material_${new Date().getTime()}`,
            imagePath: '',
            x: 100,
            y: 100,
            width: 200,
            height: 200,
            rotation: 0,
            opacity: 1,
            isClipped: false,
            ...props
        }
        return {
            ...state,
            ...history,
            pages: state.pages.map((p) =>
                p.id === state.currentPageId ? { ...p, materials: [...p.materials, newMaterial] } : p
            ),
            selectedMaterialId: newMaterial.id,
            selectedPanelId: null,
            selectedBubbleId: null
        }
    }),

    updateMaterial: (id, updates, undoable = true) => set((state) => {
        const page = state.pages.find((p) => p.id === state.currentPageId)
        if (!page) return state
        const history = undoable ? saveHistory(state) : {}
        return {
            ...state,
            ...history,
            pages: state.pages.map((p) =>
                p.id === state.currentPageId
                    ? { ...p, materials: p.materials.map((m) => (m.id === id ? { ...m, ...updates } : m)) }
                    : p
            )
        }
    }),

    removeMaterial: (id) => set((state) => {
        if (!state.currentPageId) return state
        const history = saveHistory(state)
        return {
            ...state,
            ...history,
            pages: state.pages.map((p) =>
                p.id === state.currentPageId
                    ? { ...p, materials: p.materials.filter((m) => m.id !== id) }
                    : p
            ),
            selectedMaterialId: state.selectedMaterialId === id ? null : state.selectedMaterialId
        }
    })
})
