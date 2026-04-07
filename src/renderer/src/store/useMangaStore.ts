import { create } from 'zustand'
import { createHistorySlice, type HistorySlice } from './slices/historySlice'
import { createPageSlice, type PageSlice } from './slices/pageSlice'
import { createPanelSlice, type PanelSlice } from './slices/panelSlice'
import { createBubbleSlice, type BubbleSlice } from './slices/bubbleSlice'
import { createMaterialSlice, type MaterialSlice } from './slices/materialSlice'
import { createProjectSlice, type ProjectSlice } from './slices/projectSlice'
import { createReferenceSlice, type ReferenceSlice } from './slices/referenceSlice'
import {
    createBackgroundLibrarySlice,
    type BackgroundLibrarySlice
} from './slices/backgroundLibrarySlice'
import { createMosaicSlice, type MosaicSlice } from './slices/mosaicSlice'

// Re-export all domain types so existing imports from this file continue to work
export type {
    PanelType,
    FadeDirection,
    GradientType,
    BubbleType,
    MosaicType,
    MosaicRegion,
    Panel,
    Bubble,
    Material,
    Page,
    PageTemplate,
    MangaProjectData,
    ReferenceCharacter,
    ReferenceCharacterImage,
    BackgroundLibraryImage,
    PageBackgroundImageFit
} from './types'

export type MangaState =
    HistorySlice &
    PageSlice &
    PanelSlice &
    BubbleSlice &
    MaterialSlice &
    ProjectSlice &
    ReferenceSlice &
    BackgroundLibrarySlice &
    MosaicSlice

export const useMangaStore = create<MangaState>()((...a) => ({
    ...createHistorySlice(...a),
    ...createPageSlice(...a),
    ...createPanelSlice(...a),
    ...createBubbleSlice(...a),
    ...createMaterialSlice(...a),
    ...createProjectSlice(...a),
    ...createReferenceSlice(...a),
    ...createBackgroundLibrarySlice(...a),
    ...createMosaicSlice(...a)
}))
