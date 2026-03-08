import { create } from 'zustand'

export type PanelType = 'rect' | 'slanted' | 'trapezoid-h' | 'trapezoid-v'
export type FadeDirection = 'none' | 'top' | 'bottom' | 'left' | 'right'

export interface Panel {
    id: string
    type: PanelType
    x: number
    y: number
    width: number
    height: number
    strokeWidth: number
    slant: number
    offsetB: number
    offsetC: number
    offsetD: number
    // Image properties
    imagePath?: string
    imageX?: number
    imageY?: number
    imageScale?: number
    imageRotation?: number
    // Effects
    fadeDirection?: FadeDirection
    hasFocusLines?: boolean
    focusCenterX?: number
    focusCenterY?: number
    focusDensity?: number
    focusWidth?: number
    isAdjustingFocus?: boolean
    focusRadius?: number
    fadeStrength?: number
}

interface Page {
    id: string
    name: string
    panels: Panel[]
    backgroundColor?: string
    backgroundOpacity?: number
}

export interface PageTemplate {
    id: string
    name: string
    panels: Omit<Panel, 'id'>[]
}

interface MangaState {
    currentProjectPath: string | null
    pages: Page[]
    templates: PageTemplate[]
    currentPageId: string | null
    selectedPanelId: string | null
    setCurrentProject: (path: string) => void
    setSelectedPanel: (id: string | null) => void
    addPage: (panels?: Omit<Panel, 'id'>[]) => void
    selectPage: (id: string) => void
    updatePage: (id: string, updates: Partial<Page>) => void
    addPanel: (props: { x: number; y: number } & Partial<Omit<Panel, 'id' | 'x' | 'y'>>) => void
    updatePanel: (id: string, updates: Partial<Panel>) => void
    removePanel: (id: string) => void
    reorderPanel: (id: string, action: 'front' | 'back' | 'up' | 'down') => void
    setProjectData: (data: { pages: Page[] }) => void
    // Template actions
    loadTemplates: () => Promise<void>
    saveAsTemplate: (name: string) => Promise<void>
}

export const useMangaStore = create<MangaState>((set, get) => ({
    currentProjectPath: null,
    pages: [],
    templates: [],
    currentPageId: null,
    selectedPanelId: null,
    setCurrentProject: (path) => set({ currentProjectPath: path }),
    setSelectedPanel: (id) => set({ selectedPanelId: id }),
    addPage: (panels) =>
        set((state) => {
            const newPage: Page = {
                id: Math.random().toString(36).substr(2, 9),
                name: `Page ${state.pages.length + 1}`,
                panels: panels ? panels.map(p => ({ ...p, id: Math.random().toString(36).substr(2, 9) })) : [],
                backgroundColor: '#ffffff',
                backgroundOpacity: 1
            }
            return {
                pages: [...state.pages, newPage],
                currentPageId: newPage.id,
                selectedPanelId: null
            }
        }),
    selectPage: (id) => set({ currentPageId: id, selectedPanelId: null }),
    updatePage: (id, updates) =>
        set((state) => ({
            pages: state.pages.map((p) => (p.id === id ? { ...p, ...updates } : p))
        })),
    addPanel: (props) =>
        set((state) => {
            if (!state.currentPageId) return state
            const newPanel: Panel = {
                id: Math.random().toString(36).substr(2, 9),
                type: 'rect',
                width: 200,
                height: 150,
                strokeWidth: 4,
                slant: 0,
                offsetB: 0,
                offsetC: 0,
                offsetD: 0,
                imageX: 0,
                imageY: 0,
                imageScale: 1,
                imageRotation: 0,
                fadeDirection: 'none',
                hasFocusLines: false,
                focusCenterX: 0.5,
                focusCenterY: 0.5,
                focusDensity: 100,
                focusWidth: 1,
                focusRadius: 50,
                fadeStrength: 0.4,
                ...props
            }
            return {
                pages: state.pages.map((p) =>
                    p.id === state.currentPageId ? { ...p, panels: [...p.panels, newPanel] } : p
                ),
                selectedPanelId: newPanel.id
            }
        }),
    updatePanel: (id, updates) =>
        set((state) => {
            if (!state.currentPageId) return state
            return {
                pages: state.pages.map((p) =>
                    p.id === state.currentPageId
                        ? { ...p, panels: p.panels.map((panel) => (panel.id === id ? { ...panel, ...updates } : panel)) }
                        : p
                )
            }
        }),
    removePanel: (id) =>
        set((state) => {
            if (!state.currentPageId) return state
            return {
                pages: state.pages.map((p) =>
                    p.id === state.currentPageId
                        ? { ...p, panels: p.panels.filter((panel) => panel.id !== id) }
                        : p
                ),
                selectedPanelId: state.selectedPanelId === id ? null : state.selectedPanelId
            }
        }),
    reorderPanel: (id, action) =>
        set((state) => {
            if (!state.currentPageId) return state
            const page = state.pages.find((p) => p.id === state.currentPageId)
            if (!page) return state

            const panels = [...page.panels]
            const index = panels.findIndex((p) => p.id === id)
            if (index === -1) return state

            const panel = panels.splice(index, 1)[0]

            if (action === 'front') {
                panels.push(panel)
            } else if (action === 'back') {
                panels.unshift(panel)
            } else if (action === 'up') {
                const newIndex = Math.min(index + 1, panels.length)
                panels.splice(newIndex, 0, panel)
            } else if (action === 'down') {
                const newIndex = Math.max(index - 1, 0)
                panels.splice(newIndex, 0, panel)
            }

            return {
                pages: state.pages.map((p) =>
                    p.id === state.currentPageId ? { ...p, panels } : p
                )
            }
        }),
    setProjectData: (data) => set({
        pages: data.pages || [],
        currentPageId: data.pages?.[0]?.id || null,
        selectedPanelId: null
    }),
    loadTemplates: async () => {
        if (!window.electron) return
        const templates = await window.electron.getTemplates()
        set({ templates })
    },
    saveAsTemplate: async (name) => {
        const state = get()
        const page = state.pages.find(p => p.id === state.currentPageId)
        console.log('Store: saving as template', { name, pageId: state.currentPageId })

        if (!page || !window.electron) {
            console.error('Store: cannot save template - page or electron not found', { hasPage: !!page, hasElectron: !!window.electron })
            return
        }

        try {
            const template = {
                name,
                panels: page.panels.map(({ id, ...rest }) => ({ ...rest }))
            }
            console.log('Store: sending template to main', template)
            const templates = await window.electron.saveTemplate(template)
            console.log('Store: templates updated', templates)
            set({ templates })
            alert(`テンプレート "${name}" を保存しました`)
        } catch (error) {
            console.error('Store: failed to save template', error)
            alert('テンプレートの保存に失敗しました')
        }
    }
}))
