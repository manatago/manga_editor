import { StateCreator } from 'zustand'
import type { MangaState } from '../useMangaStore'
import type { Panel } from '../types'
import { saveHistory } from '../helpers'

export interface PanelSlice {
    selectedPanelId: string | null
    clipboardPanel: Omit<Panel, 'id'> | null
    setSelectedPanel: (id: string | null) => void
    addPanel: (props: Partial<Omit<Panel, 'id'>>) => void
    updatePanel: (id: string, updates: Partial<Panel>, undoable?: boolean) => void
    removePanel: (id: string) => void
    reorderPanel: (id: string, action: 'front' | 'back' | 'up' | 'down') => void
    copyPanel: (id: string) => void
    pastePanel: () => void
}

export const createPanelSlice: StateCreator<MangaState, [], [], PanelSlice> = (set) => ({
    selectedPanelId: null,
    clipboardPanel: null,

    setSelectedPanel: (id) => set({ selectedPanelId: id, selectedBubbleId: null, selectedMaterialId: null }),

    addPanel: (props) => set((state) => {
        if (!state.currentPageId) return state
        const newPanel: Panel = {
            id: Math.random().toString(36).substr(2, 9),
            type: 'rect',
            x: 100,
            y: 100,
            width: 200,
            height: 150,
            rotation: 0,
            strokeWidth: 1,
            strokeColor: '#000000',
            slant: 0,
            offsetB: 0,
            offsetC: 0,
            offsetD: 0,
            imageX: 0,
            imageY: 0,
            imageScale: 1,
            imageRotation: 0,
            imageFlipX: false,
            fadeDirection: 'none',
            hasFocusLines: false,
            focusCenterX: 0.5,
            focusCenterY: 0.5,
            focusDensity: 100,
            focusWidth: 1,
            focusRadius: 50,
            fadeStrength: 0.4,
            blurRadius: 0,
            hasRainEffect: false,
            rainDensity: 100,
            rainOpacity: 0.3,
            ...props
        }
        const history = saveHistory(state)
        return {
            ...state,
            ...history,
            pages: state.pages.map((p) =>
                p.id === state.currentPageId ? { ...p, panels: [...p.panels, newPanel] } : p
            ),
            selectedPanelId: newPanel.id,
            selectedBubbleId: null,
            selectedMaterialId: null
        }
    }),

    updatePanel: (id, updates, undoable = true) => set((state) => {
        if (!state.currentPageId) return state
        const history = undoable ? saveHistory(state) : {}
        return {
            ...state,
            ...history,
            pages: state.pages.map((p) =>
                p.id === state.currentPageId
                    ? { ...p, panels: p.panels.map((panel) => (panel.id === id ? { ...panel, ...updates } : panel)) }
                    : p
            )
        }
    }),

    removePanel: (id) => set((state) => {
        if (!state.currentPageId) return state
        const history = saveHistory(state)
        return {
            ...state,
            ...history,
            pages: state.pages.map((p) =>
                p.id === state.currentPageId
                    ? { ...p, panels: p.panels.filter((panel) => panel.id !== id) }
                    : p
            ),
            selectedPanelId: state.selectedPanelId === id ? null : state.selectedPanelId
        }
    }),

    reorderPanel: (id, action) => set((state) => {
        if (!state.currentPageId) return state
        const page = state.pages.find((p) => p.id === state.currentPageId)
        if (!page) return state

        const panels = [...page.panels]
        const index = panels.findIndex((p) => p.id === id)
        if (index === -1) return state

        const panel = panels.splice(index, 1)[0]
        if (action === 'front') panels.push(panel)
        else if (action === 'back') panels.unshift(panel)
        else if (action === 'up') panels.splice(Math.min(index + 1, panels.length), 0, panel)
        else if (action === 'down') panels.splice(Math.max(index - 1, 0), 0, panel)

        const history = saveHistory(state)
        return {
            ...state,
            ...history,
            pages: state.pages.map((p) =>
                p.id === state.currentPageId ? { ...p, panels } : p
            )
        }
    }),

    copyPanel: (id) => set((state) => {
        const page = state.pages.find((p) => p.id === state.currentPageId)
        if (!page) return state
        const panel = page.panels.find((p) => p.id === id)
        if (!panel) return state
        const { id: _id, ...panelData } = panel
        return { ...state, clipboardPanel: panelData }
    }),

    pastePanel: () => set((state) => {
        if (!state.currentPageId || !state.clipboardPanel) return state
        const history = saveHistory(state)
        const newPanel: Panel = {
            ...state.clipboardPanel,
            id: `panel_${new Date().getTime()}`,
            x: (state.clipboardPanel.x ?? 0) + 20,
            y: (state.clipboardPanel.y ?? 0) + 20
        }
        return {
            ...state,
            ...history,
            pages: state.pages.map((p) =>
                p.id === state.currentPageId ? { ...p, panels: [...p.panels, newPanel] } : p
            ),
            selectedPanelId: newPanel.id,
            selectedBubbleId: null,
            selectedMaterialId: null
        }
    })
})
