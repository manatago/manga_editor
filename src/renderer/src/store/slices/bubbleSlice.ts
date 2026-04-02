import { StateCreator } from 'zustand'
import type { MangaState } from '../useMangaStore'
import type { Bubble, BubbleType } from '../types'
import { saveHistory } from '../helpers'
import {
    bubbleToLastStyleSlice,
    loadBubbleLastStylesFromStorage,
    saveBubbleLastStylesToStorage,
    type BubbleLastStyleSlice
} from '../bubbleLastStyle'

export interface BubbleSlice {
    selectedBubbleId: string | null
    clipboardBubble: Omit<Bubble, 'id'> | null
    clipboardBubbleCopiedAt: number | null
    bubbleLastStyleByType: Partial<Record<BubbleType, BubbleLastStyleSlice>>
    setSelectedBubble: (id: string | null) => void
    addBubble: (props: Partial<Omit<Bubble, 'id'>>) => void
    updateBubble: (id: string, updates: Partial<Bubble>, undoable?: boolean) => void
    removeBubble: (id: string) => void
    copyBubble: (id: string) => void
    pasteBubble: () => void
}

export const createBubbleSlice: StateCreator<MangaState, [], [], BubbleSlice> = (set) => ({
    selectedBubbleId: null,
    clipboardBubble: null,
    clipboardBubbleCopiedAt: null,
    bubbleLastStyleByType: loadBubbleLastStylesFromStorage(),

    setSelectedBubble: (id) => set({ selectedBubbleId: id, selectedPanelId: null, selectedMaterialId: null }),

    addBubble: (props) => set((state) => {
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
        const history = saveHistory(state)
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

    updateBubble: (id, updates, undoable = true) => set((state) => {
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
                [(nextBubble as Bubble).type]: bubbleToLastStyleSlice(nextBubble as Bubble)
            }
            saveBubbleLastStylesToStorage(bubbleLastStyleByType)
        }
        return { ...state, ...history, pages, bubbleLastStyleByType }
    }),

    removeBubble: (id) => set((state) => {
        if (!state.currentPageId) return state
        const history = saveHistory(state)
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
        const page = state.pages.find((p) => p.id === state.currentPageId)
        if (!page) return state
        const bubble = page.bubbles.find((b) => b.id === id)
        if (!bubble) return state
        const { id: _id, ...bubbleData } = bubble
        return { ...state, clipboardBubble: bubbleData, clipboardBubbleCopiedAt: Date.now() }
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
            pages: state.pages.map((p) =>
                p.id === state.currentPageId
                    ? { ...p, bubbles: [...p.bubbles, newBubble] }
                    : p
            ),
            selectedBubbleId: newBubble.id
        }
    })
})
