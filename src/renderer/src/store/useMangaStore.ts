import { create } from 'zustand'
import { createHistorySlice, type HistorySlice } from './slices/historySlice'
import { createPageSlice, type PageSlice } from './slices/pageSlice'
import { createPanelSlice, type PanelSlice } from './slices/panelSlice'
import { createBubbleSlice, type BubbleSlice } from './slices/bubbleSlice'
import { createMaterialSlice, type MaterialSlice } from './slices/materialSlice'
import { createProjectSlice, type ProjectSlice } from './slices/projectSlice'

// Re-export all domain types so existing imports from this file continue to work
export type {
    PanelType,
    FadeDirection,
    GradientType,
    BubbleType,
    Panel,
    Bubble,
    Material,
    Page,
    PageTemplate,
    MangaProjectData
} from './types'

export type MangaState =
    HistorySlice &
    PageSlice &
    PanelSlice &
    BubbleSlice &
    MaterialSlice &
    ProjectSlice

export const useMangaStore = create<MangaState>()((...a) => ({
    ...createHistorySlice(...a),
    ...createPageSlice(...a),
    ...createPanelSlice(...a),
    ...createBubbleSlice(...a),
    ...createMaterialSlice(...a),
    ...createProjectSlice(...a)
}))
