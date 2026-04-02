import { create } from 'zustand'
import { physicalFileToRelative, toRelativeAssetPath } from '../utils/projectAssets'
import {
    bubbleToLastStyleSlice,
    loadBubbleLastStylesFromStorage,
    saveBubbleLastStylesToStorage,
    type BubbleLastStyleSlice
} from './bubbleLastStyle'
import { confirmMessage, showError, showInfo } from '../utils/dialogs'

export type PanelType = 'rect' | 'slanted' | 'trapezoid-h' | 'trapezoid-v' | 'pentagon' | 'hexagon' | 'circle'
export type FadeDirection =
    | 'none'
    | 'top'
    | 'bottom'
    | 'left'
    | 'right'
    | 'top-left'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-right'
export type GradientType = 'none' | 'linear' | 'radial'

export interface Panel {
    id: string
    type: PanelType
    x: number
    y: number
    width: number
    height: number
    rotation?: number
    strokeWidth: number
    strokeColor: string
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
    isGrayscale?: boolean
    imageFlipX?: boolean
    // Background properties
    backgroundColor?: string
    backgroundOpacity?: number
    bgGradientType?: GradientType
    bgGradientStartColor?: string
    bgGradientEndColor?: string
    bgGradientRotation?: number
    // Manga Filters
    blurRadius?: number
    hasRainEffect?: boolean
    rainDensity?: number
    rainOpacity?: number
}

export type BubbleType = 'rounded' | 'jagged' | 'rect' | 'flash' | 'shout' | 'square-jagged' | 'megaphone' | 'rect-double'

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
    lineHeight: number
    letterSpacing: number
    textStrokeColor?: string
    textStrokeWidth?: number
    textWeightLevel?: 0 | 1 | 2
    textRoughness?: number
    fontColor: string
    fontWeight: string
    isVertical: boolean
    backgroundColor: string
    backgroundOpacity: number
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
    narrowRatio?: number
    tailType?: 'point' | 'thought'
    isClipped: boolean
    panelId?: string
    rotation: number
}
 
export interface Material {
    id: string
    imagePath: string
    x: number
    y: number
    width: number
    height: number
    rotation: number
    opacity: number
    isClipped: boolean
    panelId?: string
    isGrayscale?: boolean
}

interface Page {
    id: string
    name: string
    pageWidth?: number
    pageHeight?: number
    gridEnabled?: boolean
    gridSize?: number
    panels: Panel[]
    bubbles: Bubble[]
    materials: Material[]
    backgroundColor?: string
    backgroundOpacity?: number
    bgGradientType?: GradientType
    bgGradientStartColor?: string
    bgGradientEndColor?: string
    bgGradientRotation?: number
}

export interface PageTemplate {
    id: string
    name: string
    panels: Omit<Panel, 'id'>[]
}

export interface MangaProjectData {
    pages: Page[]
    lastPageId: string | null
}

interface MangaState {
    currentProjectPath: string | null
    pages: Page[]
    templates: PageTemplate[]
    currentPageId: string | null
    selectedPanelId: string | null
    selectedBubbleId: string | null
    selectedMaterialId: string | null
    clipboardBubble: Omit<Bubble, 'id'> | null
    clipboardPanel: Omit<Panel, 'id'> | null
    isSaving: boolean
    lastSavedAt: number | null
    saveError: string | null

    /** 吹き出しタイプごとの「最後に編集したスタイル」（次回そのタイプを追加するときに適用。localStorage に永続化） */
    bubbleLastStyleByType: Partial<Record<BubbleType, BubbleLastStyleSlice>>

    // History for Undo/Redo
    past: { pages: Page[], currentPageId: string | null }[]
    future: { pages: Page[], currentPageId: string | null }[]
    undo: () => void
    redo: () => void
    setCurrentProject: (path: string) => void
    setSelectedPanel: (id: string | null) => void
    setSelectedBubble: (id: string | null) => void
    setSelectedMaterial: (id: string | null) => void
    addPage: (panels?: Omit<Panel, 'id'>[]) => void
    selectPage: (id: string) => void
    removePage: (id: string) => void
    updatePage: (id: string, updates: Partial<Page>) => void
    addPanel: (props: Partial<Omit<Panel, 'id'>>) => void
    updatePanel: (id: string, updates: Partial<Panel>, undoable?: boolean) => void
    removePanel: (id: string) => void
    addBubble: (props: Partial<Omit<Bubble, 'id'>>) => void
    updateBubble: (id: string, updates: Partial<Bubble>, undoable?: boolean) => void
    removeBubble: (id: string) => void
    copyBubble: (id: string) => void
    pasteBubble: () => void
    copyPanel: (id: string) => void
    pastePanel: () => void
    addMaterial: (props: Partial<Omit<Material, 'id'>>) => void
    updateMaterial: (id: string, updates: Partial<Material>, undoable?: boolean) => void
    removeMaterial: (id: string) => void
    reorderPanel: (id: string, action: 'front' | 'back' | 'up' | 'down') => void
    movePage: (id: string, direction: 'up' | 'down') => void
    setProjectData: (data: { pages: Page[], lastPageId?: string | null }) => void
    getProjectData: () => MangaProjectData
    // Template actions
    loadTemplates: () => Promise<void>;
    saveAsTemplate: (name: string) => Promise<void>;
    removeTemplate: (id: string) => Promise<void>;
    saveProject: () => Promise<void>;
    isExporting: boolean;
    setExporting: (val: boolean) => void;
    cleanupAssets: () => Promise<void>;
}

export const useMangaStore = create<MangaState>((set, get) => {
    const HISTORY_LIMIT = 100
    const limitHistory = <T,>(list: T[]) => (list.length > HISTORY_LIMIT ? list.slice(-HISTORY_LIMIT) : list)

    // Helper to push current state to past before mutating
    const saveHistory = (state: MangaState) => {
        return {
            past: limitHistory([...state.past, { pages: JSON.parse(JSON.stringify(state.pages)), currentPageId: state.currentPageId }]),
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
        selectedMaterialId: null,
        clipboardBubble: null,
        clipboardPanel: null,
        bubbleLastStyleByType: loadBubbleLastStylesFromStorage(),
        past: [],
        future: [],
        isSaving: false,
        lastSavedAt: null,
        saveError: null,
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
                past: limitHistory([...state.past, { pages: JSON.parse(JSON.stringify(state.pages)), currentPageId: state.currentPageId }]),
                future: limitHistory(newFuture),
                pages: next.pages,
                currentPageId: next.currentPageId,
                selectedPanelId: null,
                selectedBubbleId: null,
                selectedMaterialId: null
            }
        }),
        setCurrentProject: (path) => set({ currentProjectPath: path }),
        setSelectedPanel: (id) => set({ selectedPanelId: id, selectedBubbleId: null, selectedMaterialId: null }),
        setSelectedBubble: (id) => set({ selectedBubbleId: id, selectedPanelId: null, selectedMaterialId: null }),
        setSelectedMaterial: (id) => set({ selectedMaterialId: id, selectedPanelId: null, selectedBubbleId: null }),
        addPage: (panels = []) => set((state) => {
            const history = saveHistory(state);
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
                const newPages = [...state.pages, newPage]
                return {
                    ...state,
                    ...history,
                    pages: newPages,
                    currentPageId: newPage.id,
                    selectedPanelId: null,
                    selectedBubbleId: null,
                    selectedMaterialId: null
                }
            }),
        selectPage: (id) => {
            set({ currentPageId: id, selectedPanelId: null, selectedBubbleId: null, selectedMaterialId: null })
            // Auto-save on page selection to persist lastPageId
            const state = get()
            if (state.currentProjectPath) {
                state.saveProject()
            }
        },
        removePage: (id) =>
            set((state) => {
                const index = state.pages.findIndex((p) => p.id === id)
                if (index === -1) return state

                const history = saveHistory(state)
                const newPages = state.pages.filter((p) => p.id !== id)

                // Renormalize names (renumbering)
                const normalizedPages = newPages.map((p, i) => ({
                    ...p,
                    name: String(i + 1).padStart(3, '0')
                }))

                let newCurrentPageId = state.currentPageId
                if (state.currentPageId === id) {
                    // Try to select the page at the same index, or the new last page
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
                const history = saveHistory(state);
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
                const kind = (props.type ?? 'rounded') as BubbleType
                const lastStyle = state.bubbleLastStyleByType[kind] ?? {}
                const newBubble: Bubble = {
                    type: 'rounded',
                    x: 200,
                    y: 200,
                    width: 150,
                    height: 100,
                    fontSize: 22,
                    fontFamily: "'Hiragino Mincho ProN', 'MS PMincho', serif",
                    lineHeight: 1.0,
                    letterSpacing: 0,
                    textStrokeColor: '#ffffff',
                    textStrokeWidth: 0,
                    textWeightLevel: 1,
                    textRoughness: 0,
                    fontColor: '#000000',
                    fontWeight: 'bold',
                    isVertical: true,
                    backgroundColor: '#ffffff',
                    backgroundOpacity: 1,
                    borderColor: '#000000',
                    borderWidth: 0.5,
                    opacity: 1,
                    textOffsetX: 0,
                    textOffsetY: 0,
                    deformation: 1,
                    isClipped: false,
                    panelId: undefined,
                    tailX: 0,
                    tailY: 0,
                    tailControlX: 0,
                    tailControlY: 0,
                    tailWidth: 20,
                    spikeCount: 36,
                    flashLength: 1,
                    tailType: 'point',
                    rotation: 0,
                    ...lastStyle,
                    ...props,
                    id: Math.random().toString(36).substr(2, 9),
                    text: props.text ?? 'テキストを入力'
                }
                const history = saveHistory(state);
                return {
                    ...state,
                    ...history,
                    pages: state.pages.map((p) =>
                        p.id === state.currentPageId ? { ...p, bubbles: [...p.bubbles, newBubble] } : p
                    ),
                    selectedBubbleId: newBubble.id,
                    selectedPanelId: null,
                    selectedMaterialId: null
                }
            }),
        updateBubble: (id, updates, undoable = true) =>
            set((state) => {
                if (!state.currentPageId) return state
                const history = undoable ? saveHistory(state) : {}
                let nextBubble: Bubble | null = null
                const pages = state.pages.map((p) =>
                    p.id === state.currentPageId
                        ? {
                              ...p,
                              bubbles: p.bubbles.map((b) => {
                                  if (b.id !== id) return b
                                  const merged = { ...b, ...updates }
                                  nextBubble = merged
                                  return merged
                              })
                          }
                        : p
                )
                let bubbleLastStyleByType = state.bubbleLastStyleByType
                if (nextBubble) {
                    bubbleLastStyleByType = {
                        ...state.bubbleLastStyleByType,
                        [nextBubble.type]: bubbleToLastStyleSlice(nextBubble)
                    }
                    saveBubbleLastStylesToStorage(bubbleLastStyleByType)
                }
                return {
                    ...state,
                    ...history,
                    pages,
                    bubbleLastStyleByType
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
        copyBubble: (id) => set((state) => {
            const page = state.pages.find(p => p.id === state.currentPageId)
            if (!page) return state
            const bubble = page.bubbles.find(b => b.id === id)
            if (!bubble) return state
            const { id: _id, ...bubbleData } = bubble
            return { ...state, clipboardBubble: bubbleData }
        }),
        copyPanel: (id) => set((state) => {
            const page = state.pages.find((p) => p.id === state.currentPageId)
            if (!page) return state
            const panel = page.panels.find((p) => p.id === id)
            if (!panel) return state
            const { id: _id, ...panelData } = panel
            return { ...state, clipboardPanel: panelData }
        }),
        pasteBubble: () => set((state) => {
            if (!state.currentPageId || !state.clipboardBubble) return state
            const history = saveHistory(state)
            const newBubble: Bubble = {
                ...state.clipboardBubble,
                id: `bubble_${new Date().getTime()}`,
                x: state.clipboardBubble.x + 20,
                y: state.clipboardBubble.y + 20
            }
            return {
                ...state,
                ...history,
                pages: state.pages.map(p =>
                    p.id === state.currentPageId
                        ? { ...p, bubbles: [...p.bubbles, newBubble] }
                        : p
                ),
                selectedBubbleId: newBubble.id
            }
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
        }),
        addMaterial: (props) => set((state) => {
            if (!state.currentPageId) return state
            const history = saveHistory(state);
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
                    p.id === state.currentPageId ? {
                        ...p,
                        materials: p.materials.map((m) => m.id === id ? { ...m, ...updates } : m)
                    } : p
                )
            }
        }),
        removeMaterial: (id) => set((state) => {
            if (!state.currentPageId) return state
            const history = saveHistory(state);
            return {
                ...state,
                ...history,
                pages: state.pages.map((p) =>
                    p.id === state.currentPageId ? { ...p, materials: p.materials.filter((m) => m.id !== id) } : p
                ),
                selectedMaterialId: state.selectedMaterialId === id ? null : state.selectedMaterialId
            }
        }),
        reorderPanel: (id: string, action: 'front' | 'back' | 'up' | 'down') =>
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
            const projectPathForAssets = get().currentProjectPath
            const sanitizedPages = (data.pages || []).map(page => ({
                ...page,
                pageWidth: Math.max(400, Math.round(page.pageWidth ?? 840)),
                pageHeight: Math.max(400, Math.round(page.pageHeight ?? 1188)),
                gridEnabled: !!page.gridEnabled,
                gridSize: Math.max(8, Math.min(200, Math.round(page.gridSize ?? 24))),
                backgroundColor: page.backgroundColor || '#ffffff',
                backgroundOpacity: page.backgroundOpacity ?? 1,
                bubbles: (page.bubbles || []).map(bubble => ({
                    ...bubble,
                    fontSize: bubble.fontSize || 22,
                    backgroundOpacity: bubble.backgroundOpacity ?? 1,
                    lineHeight: bubble.lineHeight ?? 1.0,
                    fontWeight: bubble.fontWeight || 'bold',
                    spikeCount: bubble.spikeCount || 36,
                    narrowRatio: bubble.narrowRatio ?? 0.3,
                    flashLength: bubble.flashLength || 1,
                    tailType: bubble.tailType || 'point',
                    rotation: bubble.rotation ?? 0
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
                        rotation: panel.rotation ?? 0,
                        x: panel.x || 0,
                        y: panel.y || 0,
                        strokeWidth: panel.strokeWidth ?? 1, // use ?? to allow 0
                        strokeColor: (panel as any).strokeColor || '#000000',
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
                        fadeStrength: panel.fadeStrength ?? 0.4,
                        isGrayscale: panel.isGrayscale ?? false,
                        imageFlipX: panel.imageFlipX ?? false,
                        blurRadius: panel.blurRadius ?? 0,
                        hasRainEffect: panel.hasRainEffect ?? false,
                        rainDensity: panel.rainDensity ?? 100,
                        rainOpacity: panel.rainOpacity ?? 0.3,
                        imagePath:
                            projectPathForAssets && panel.imagePath
                                ? toRelativeAssetPath(projectPathForAssets, panel.imagePath) ?? panel.imagePath
                                : panel.imagePath
                    }
                }),
                materials: (page.materials || []).map(mat => ({
                    ...mat,
                    opacity: mat.opacity ?? 1,
                    isClipped: mat.isClipped ?? false,
                    isGrayscale: mat.isGrayscale ?? false,
                    imagePath:
                        projectPathForAssets && mat.imagePath
                            ? toRelativeAssetPath(projectPathForAssets, mat.imagePath) ?? mat.imagePath
                            : mat.imagePath
                }))
            }))

            // Normalize names of loaded pages
            const normalizedPages = sanitizedPages.map((p, i) => ({
                ...p,
                name: String(i + 1).padStart(3, '0')
            }))

            set({
                pages: normalizedPages,
                currentPageId: data.lastPageId || normalizedPages[0]?.id || null,
                selectedPanelId: null,
                selectedBubbleId: null,
                currentProjectPath: get().currentProjectPath // Keep existing path if not reset
            })
            console.log('Store: setProjectData done. normalized count:', normalizedPages.length)
        },
        getProjectData: () => {
            const state = get()
            const pp = state.currentProjectPath
            if (!pp) {
                return {
                    pages: state.pages,
                    lastPageId: state.currentPageId
                }
            }
            const pages = state.pages.map((page) => ({
                ...page,
                panels: page.panels.map((p) => ({
                    ...p,
                    imagePath: toRelativeAssetPath(pp, p.imagePath) ?? p.imagePath
                })),
                materials: (page.materials || []).map((m) => ({
                    ...m,
                    imagePath: toRelativeAssetPath(pp, m.imagePath) ?? m.imagePath
                }))
            }))
            return {
                pages,
                lastPageId: state.currentPageId
            }
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
                // Filter out image-related properties for templates
                const template = {
                    name,
                    panels: page.panels.map(({
                        id,
                        imagePath,
                        imageX,
                        imageY,
                        imageScale,
                        imageRotation,
                        imageFlipX,
                        isGrayscale,
                        ...rest
                    }) => ({ ...rest }))
                }
                console.log('Store: sending template to main', template)
                const templates = await window.electron.saveTemplate(template)
                console.log('Store: templates updated', templates)
                set({ templates })
                await showInfo(`テンプレート "${name}" を保存しました`)
            } catch (error) {
                console.error('Store: failed to save template', error)
                await showError('テンプレートの保存に失敗しました')
            }
        },
        removeTemplate: async (id) => {
            if (!window.electron) return
            try {
                const ok = await confirmMessage('このテンプレートを削除してもよろしいですか？')
                if (ok) {
                    const templates = await window.electron.deleteTemplate(id)
                    set({ templates })
                }
            } catch (error) {
                console.error('Store: failed to delete template', error)
                await showError('テンプレートの削除に失敗しました')
            }
        },
        saveProject: async () => {
            const state = get()
            if (!state.currentProjectPath || !window.electron) {
                console.warn('Store: cannot save project - no path or electron not found')
                return
            }

            try {
                set({ isSaving: true, saveError: null })
                const projectData = state.getProjectData()
                await window.electron.saveProject(state.currentProjectPath, projectData)
                console.log('Store: project saved successfully to', state.currentProjectPath)
                set({ isSaving: false, saveError: null, lastSavedAt: Date.now() })
            } catch (error) {
                console.error('Store: failed to save project', error)
                set({ isSaving: false, saveError: 'プロジェクトの保存に失敗しました' })
                await showError('プロジェクトの保存に失敗しました')
            }
        },
        setExporting: (val) => set({ isExporting: val }),
        cleanupAssets: async () => {
            const state = get()
            if (!state.currentProjectPath || !window.electron) {
                console.warn('Store: cannot cleanup assets - no project path or electron not found')
                return
            }

            try {
                // 1. Collect referenced paths（manga.json と同じく相対パスで比較）
                const referencedPaths = new Set<string>()
                const pp = state.currentProjectPath
                state.pages.forEach((page) => {
                    page.panels.forEach((panel) => {
                        if (panel.imagePath) {
                            const rel = toRelativeAssetPath(pp, panel.imagePath) ?? panel.imagePath
                            referencedPaths.add(rel)
                        }
                    })
                    page.materials.forEach((material) => {
                        if (material.imagePath) {
                            const rel = toRelativeAssetPath(pp, material.imagePath) ?? material.imagePath
                            referencedPaths.add(rel)
                        }
                    })
                })

                // 2. Get all physical assets
                const physicalAssets = await window.electron.getAssets(state.currentProjectPath)

                // 3. Find unreferenced files
                const unusedAssets = physicalAssets.filter((fullPath) => {
                    const rel = physicalFileToRelative(pp, fullPath)
                    return !referencedPaths.has(rel)
                })

                if (unusedAssets.length === 0) {
                    await showInfo('未使用のアセットは見つかりませんでした。')
                    return
                }

                const ok = await confirmMessage(`${unusedAssets.length}個の未使用アセットを削除しますか？`)
                if (ok) {
                    for (const path of unusedAssets) {
                        await window.electron.deleteFile(path)
                    }
                    await showInfo(`${unusedAssets.length}個のアセットを削除しました。`)
                }
            } catch (error) {
                console.error('Store: failed to cleanup assets', error)
                await showError('アセットの整理に失敗しました。')
            }
        },
    }
});
