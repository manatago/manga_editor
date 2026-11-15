import { StateCreator } from 'zustand'
import type { MangaState } from '../useMangaStore'
import type { Bubble, BubbleType } from '../types'
import { historyKey, newId, saveHistory } from '../helpers'
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
    /** クリップボードを使わずに、少しずらした複製を作って選択する */
    duplicateBubble: (id: string) => void
}

/** デフォルト値（＋任意の直近スタイル）を埋めた Bubble を id 付きで生成する（addBubble / 台本生成で共有） */
export function createBubble(
    props: Partial<Omit<Bubble, 'id'>>,
    lastStyle: Partial<Bubble> = {}
): Bubble {
    return {
        type: 'rounded',
        x: 200,
        y: 200,
        width: 150,
        height: 100,
        fontSize: 18,
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
        autoFitMode: 'expand-bubble',
        ...lastStyle,
        ...props,
        id: newId('bubble'),
        text: props.text ?? 'テキストを入力'
    }
}

export const createBubbleSlice: StateCreator<MangaState, [], [], BubbleSlice> = (set, get) => ({
    selectedBubbleId: null,
    clipboardBubble: null,
    clipboardBubbleCopiedAt: null,
    bubbleLastStyleByType: loadBubbleLastStylesFromStorage(),

    setSelectedBubble: (id) => set({ selectedBubbleId: id, selectedPanelId: null, selectedMaterialId: null }),

    addBubble: (props) => set((state) => {
        if (!state.currentPageId) return state
        const kind = (props.type ?? 'rounded') as BubbleType
        const lastStyle = state.bubbleLastStyleByType[kind] ?? {}
        const newBubble: Bubble = createBubble(props, lastStyle)
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

    updateBubble: (id, updates, undoable = true) => {
        let changed = false
        set((state) => {
            if (!state.currentPageId) return state
            const history = undoable ? saveHistory(state, historyKey('bubble', id, updates)) : {}
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
                changed = true
                bubbleLastStyleByType = {
                    ...state.bubbleLastStyleByType,
                    [(nextBubble as Bubble).type]: bubbleToLastStyleSlice(nextBubble as Bubble)
                }
            }
            return { ...state, ...history, pages, bubbleLastStyleByType }
        })
        // 永続化は set updater の外（副作用を純粋な updater に入れない）かつコミット時だけ。
        // ドラッグ/スライダーの連続更新（undoable=false）では毎フレーム同期 localStorage 書き込みをしない。
        if (changed && undoable) {
            saveBubbleLastStylesToStorage(get().bubbleLastStyleByType)
        }
    },

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

    duplicateBubble: (id) => set((state) => {
        const page = state.pages.find((p) => p.id === state.currentPageId)
        const src = page?.bubbles.find((b) => b.id === id)
        if (!page || !src) return state
        const dup: Bubble = { ...src, id: newId('bubble'), x: src.x + 20, y: src.y + 20 }
        return {
            ...state,
            ...saveHistory(state),
            pages: state.pages.map((p) => (p.id === page.id ? { ...p, bubbles: [...p.bubbles, dup] } : p)),
            selectedBubbleId: dup.id,
            selectedPanelId: null,
            selectedMaterialId: null
        }
    }),

    pasteBubble: () => set((state) => {
        if (!state.currentPageId || !state.clipboardBubble) return state
        const history = saveHistory(state)
        const newBubble: Bubble = {
            ...state.clipboardBubble,
            id: newId('bubble'),
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
