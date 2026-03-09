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

export type BubbleType = 'rounded' | 'jagged' | 'rect' | 'flash'

export interface Bubble {
    id: string
    type: BubbleType
    x: number
    y: number
    width: number
    height: number
    text: string
    fontSize: number
    fontFamily: string
    fontColor: string
    fontWeight: string
    isVertical: boolean
    backgroundColor: string
    borderColor: string
    borderWidth: number
    opacity: number
    textOffsetX: number
    textOffsetY: number
    deformation: number
    tailX?: number
    tailY?: number
    tailControlX?: number
    tailControlY?: number
    tailWidth?: number
    spikeCount?: number
    flashLength?: number
    tailType?: 'point' | 'thought'
}

interface Page {
    id: string
    name: string
    panels: Panel[]
    bubbles: Bubble[]
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
    selectedBubbleId: string | null

    // History for Undo/Redo
    past: { pages: Page[], currentPageId: string | null }[]
    future: { pages: Page[], currentPageId: string | null }[]
    undo: () => void
    redo: () => void
    setCurrentProject: (path: string) => void
    setSelectedPanel: (id: string | null) => void
    setSelectedBubble: (id: string | null) => void
    addPage: (panels?: Omit<Panel, 'id'>[]) => void
    selectPage: (id: string) => void
    updatePage: (id: string, updates: Partial<Page>) => void
    addPanel: (props: Partial<Omit<Panel, 'id'>>) => void
    updatePanel: (id: string, updates: Partial<Panel>, undoable?: boolean) => void
    removePanel: (id: string) => void
    addBubble: (props: Partial<Omit<Bubble, 'id'>>) => void
    updateBubble: (id: string, updates: Partial<Bubble>, undoable?: boolean) => void
    removeBubble: (id: string) => void
    reorderPanel: (id: string, action: 'front' | 'back' | 'up' | 'down') => void
    movePage: (id: string, direction: 'up' | 'down') => void
    setProjectData: (data: { pages: Page[] }) => void
    // Template actions
    loadTemplates: () => Promise<void>;
    saveAsTemplate: (name: string) => Promise<void>;
    saveProject: () => Promise<void>;
    isExporting: boolean;
    setExporting: (val: boolean) => void;
}

export const useMangaStore = create<MangaState>((set, get) => {
    // Helper to push current state to past before mutating
    const saveHistory = (state: MangaState) => {
        return {
            past: [...state.past, { pages: JSON.parse(JSON.stringify(state.pages)), currentPageId: state.currentPageId }],
            future: [] // Clear future when a new action occurs
        }
    }

    return {
        currentProjectPath: null,
        pages: [],
        templates: [],
        currentPageId: null,
        selectedPanelId: null,
        selectedBubbleId: null,
        past: [],
        future: [],
        isExporting: false,

        undo: () => set((state) => {
            if (state.past.length === 0) return state;
            const previous = state.past[state.past.length - 1];
            const newPast = state.past.slice(0, -1);
            return {
                past: newPast,
                future: [{ pages: JSON.parse(JSON.stringify(state.pages)), currentPageId: state.currentPageId }, ...state.future],
                pages: previous.pages,
                currentPageId: previous.currentPageId,
                selectedPanelId: null,
                selectedBubbleId: null
            }
        }),

        redo: () => set((state) => {
            if (state.future.length === 0) return state;
            const next = state.future[0];
            const newFuture = state.future.slice(1);
            return {
                past: [...state.past, { pages: JSON.parse(JSON.stringify(state.pages)), currentPageId: state.currentPageId }],
                future: newFuture,
                pages: next.pages,
                currentPageId: next.currentPageId,
                selectedPanelId: null,
                selectedBubbleId: null
            }
        }),
        setCurrentProject: (path) => set({ currentProjectPath: path }),
        setSelectedPanel: (id) => set({ selectedPanelId: id, selectedBubbleId: null }),
        setSelectedBubble: (id) => set({ selectedBubbleId: id, selectedPanelId: null }),
        addPage: (panels) =>
            set((state) => {
                const history = saveHistory(state);
                const lastIdx = state.pages.length;
                const newPage: Page = {
                    id: Math.random().toString(36).substr(2, 9),
                    name: String(lastIdx + 1).padStart(3, '0'),
                    panels: panels ? panels.map(p => ({ ...p, id: Math.random().toString(36).substr(2, 9) })) : [],
                    bubbles: [],
                    backgroundColor: '#ffffff',
                    backgroundOpacity: 1
                }
                const newPages = [...state.pages, newPage]
                return {
                    ...state,
                    ...history,
                    pages: newPages,
                    currentPageId: newPage.id,
                    selectedPanelId: null
                }
            }),
        selectPage: (id) => set({ currentPageId: id, selectedPanelId: null }),
        updatePage: (id, updates) =>
            set((state) => {
                const history = saveHistory(state);
                return {
                    ...state,
                    ...history,
                    pages: state.pages.map((p) => (p.id === id ? { ...p, ...updates } : p))
                }
            }),
        addPanel: (props) =>
            set((state) => {
                if (!state.currentPageId) return state
                const newPanel: Panel = {
                    id: Math.random().toString(36).substr(2, 9),
                    type: 'rect',
                    x: 100,
                    y: 100,
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
                const history = saveHistory(state);
                return {
                    ...state,
                    ...history,
                    pages: state.pages.map((p) =>
                        p.id === state.currentPageId ? { ...p, panels: [...p.panels, newPanel] } : p
                    ),
                    selectedPanelId: newPanel.id,
                    selectedBubbleId: null
                }
            }),
        updatePanel: (id, updates, undoable = true) =>
            set((state) => {
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
        removePanel: (id) =>
            set((state) => {
                if (!state.currentPageId) return state
                const history = saveHistory(state);
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
        addBubble: (props) =>
            set((state) => {
                if (!state.currentPageId) return state
                const newBubble: Bubble = {
                    id: Math.random().toString(36).substr(2, 9),
                    type: 'rounded',
                    x: 200,
                    y: 200,
                    width: 150,
                    height: 100,
                    text: 'テキストを入力',
                    fontSize: 18,
                    fontFamily: 'sans-serif',
                    fontColor: '#000000',
                    fontWeight: 'bold',
                    isVertical: true,
                    backgroundColor: '#ffffff',
                    borderColor: '#000000',
                    borderWidth: 0.5,
                    opacity: 1,
                    textOffsetX: 0,
                    textOffsetY: 0,
                    deformation: 1,
                    tailX: 0,
                    tailY: 0,
                    tailControlX: 0,
                    tailControlY: 0,
                    tailWidth: 20,
                    spikeCount: 36,
                    flashLength: 1,
                    tailType: 'point',
                    ...props
                }
                const history = saveHistory(state);
                return {
                    ...state,
                    ...history,
                    pages: state.pages.map((p) =>
                        p.id === state.currentPageId ? { ...p, bubbles: [...p.bubbles, newBubble] } : p
                    ),
                    selectedBubbleId: newBubble.id,
                    selectedPanelId: null
                }
            }),
        updateBubble: (id, updates, undoable = true) =>
            set((state) => {
                if (!state.currentPageId) return state
                const history = undoable ? saveHistory(state) : {}
                return {
                    ...state,
                    ...history,
                    pages: state.pages.map((p) =>
                        p.id === state.currentPageId
                            ? { ...p, bubbles: p.bubbles.map((b) => (b.id === id ? { ...b, ...updates } : b)) }
                            : p
                    )
                }
            }),
        removeBubble: (id) =>
            set((state) => {
                if (!state.currentPageId) return state
                const history = saveHistory(state);
                return {
                    ...state,
                    ...history,
                    pages: state.pages.map((p) =>
                        p.id === state.currentPageId
                            ? { ...p, bubbles: p.bubbles.filter((b) => b.id !== id) }
                            : p
                    ),
                    selectedBubbleId: state.selectedBubbleId === id ? null : state.selectedBubbleId
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

                const history = saveHistory(state);
                return {
                    ...state,
                    ...history,
                    pages: state.pages.map((p) =>
                        p.id === state.currentPageId ? { ...p, panels } : p
                    )
                }
            }),
        movePage: (id, direction) =>
            set((state) => {
                const index = state.pages.findIndex((p) => p.id === id)
                if (index === -1) return state

                const newPages = [...state.pages]
                const targetIndex = direction === 'up' ? index - 1 : index + 1

                if (targetIndex < 0 || targetIndex >= newPages.length) return state

                const [movedPage] = newPages.splice(index, 1)
                newPages.splice(targetIndex, 0, movedPage)

                const history = saveHistory(state);
                // Renormalize names after reordering
                const normalizedPages = newPages.map((p, i) => ({
                    ...p,
                    name: String(i + 1).padStart(3, '0')
                }))

                return {
                    ...state,
                    ...history,
                    pages: normalizedPages
                }
            }),
        setProjectData: (data) => {
            console.log('Store: setProjectData called with:', data)
            const sanitizedPages = (data.pages || []).map(page => ({
                ...page,
                backgroundColor: page.backgroundColor || '#ffffff',
                backgroundOpacity: page.backgroundOpacity ?? 1,
                bubbles: (page.bubbles || []).map(bubble => ({
                    ...bubble,
                    fontWeight: bubble.fontWeight || 'bold',
                    spikeCount: bubble.spikeCount || 36,
                    flashLength: bubble.flashLength || 1,
                    tailType: bubble.tailType || 'point'
                })),
                panels: (page.panels || []).map(panel => {
                    // Determine width/height if missing but points exist (legacy data)
                    let width = panel.width
                    let height = panel.height
                    if ((width === undefined || width === null) && (panel as any).points) {
                        const pts = (panel as any).points
                        width = pts[2] - pts[0]
                        height = pts[5] - pts[1]
                    }

                    return {
                        ...panel,
                        type: panel.type || 'rect',
                        width: width || 200,
                        height: height || 150,
                        x: panel.x || 0,
                        y: panel.y || 0,
                        strokeWidth: panel.strokeWidth ?? 4, // use ?? to allow 0
                        slant: panel.slant || 0,
                        offsetB: panel.offsetB || 0,
                        offsetC: panel.offsetC || 0,
                        offsetD: panel.offsetD || 0,
                        imageX: panel.imageX || 0,
                        imageY: panel.imageY || 0,
                        imageScale: panel.imageScale ?? 1,
                        imageRotation: panel.imageRotation ?? 0,
                        fadeDirection: panel.fadeDirection || 'none',
                        hasFocusLines: panel.hasFocusLines || false,
                        focusCenterX: panel.focusCenterX ?? 0.5,
                        focusCenterY: panel.focusCenterY ?? 0.5,
                        focusDensity: panel.focusDensity ?? 100,
                        focusWidth: panel.focusWidth ?? 1,
                        focusRadius: panel.focusRadius ?? 50,
                        fadeStrength: panel.fadeStrength ?? 0.4
                    }
                })
            }))

            // Normalize names of loaded pages
            const normalizedPages = sanitizedPages.map((p, i) => ({
                ...p,
                name: String(i + 1).padStart(3, '0')
            }))

            set({
                pages: normalizedPages,
                currentPageId: normalizedPages[0]?.id || null,
                selectedPanelId: null,
                selectedBubbleId: null,
                currentProjectPath: get().currentProjectPath // Keep existing path if not reset
            })
            console.log('Store: setProjectData done. normalized count:', normalizedPages.length)
        },
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
        },
        saveProject: async () => {
            const state = get()
            if (!state.currentProjectPath || !window.electron) {
                console.warn('Store: cannot save project - no path or electron not found')
                return
            }

            try {
                // Save current state (pages) to project file
                const projectData = {
                    name: state.currentProjectPath.split('/').pop() || 'Untitled',
                    pages: state.pages,
                    updatedAt: new Date().toISOString()
                }

                await window.electron.saveProject(state.currentProjectPath, projectData)
                console.log('Store: project saved successfully to', state.currentProjectPath)
            } catch (error) {
                console.error('Store: failed to save project', error)
                alert('プロジェクトの保存に失敗しました')
            }
        },
        setExporting: (val) => set({ isExporting: val }),
    }
});
