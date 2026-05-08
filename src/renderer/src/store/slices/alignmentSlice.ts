import type { StateCreator } from 'zustand'
import type { MangaState } from '../useMangaStore'
import type { AlignmentGuide } from '../../utils/panelAlignment'
import type { ParallelGuide } from '../../utils/edgeAlignment'

export interface AlignmentSlice {
    /** 現在ドラッグ／リサイズ中のパネルが整列している補助線（一時状態、永続化しない） */
    activeAlignmentGuides: AlignmentGuide[]
    /** 斜辺の平行整列ガイド（台形コマの角ハンドル操作中） */
    activeParallelGuides: ParallelGuide[]
    setActiveAlignmentGuides: (guides: AlignmentGuide[]) => void
    setActiveParallelGuides: (guides: ParallelGuide[]) => void
    clearActiveAlignmentGuides: () => void
}

export const createAlignmentSlice: StateCreator<MangaState, [], [], AlignmentSlice> = (set) => ({
    activeAlignmentGuides: [],
    activeParallelGuides: [],
    setActiveAlignmentGuides: (guides) => set({ activeAlignmentGuides: guides }),
    setActiveParallelGuides: (guides) => set({ activeParallelGuides: guides }),
    clearActiveAlignmentGuides: () => set({ activeAlignmentGuides: [], activeParallelGuides: [] })
})
