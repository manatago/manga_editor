import { StateCreator } from 'zustand'
import type { MangaState } from '../useMangaStore'
import type { Bubble, Panel, Page } from '../types'
import { saveHistory } from '../helpers'
import { createPanel } from './panelSlice'
import { createBubble } from './bubbleSlice'
import { resolvePanelRects, placeNewBubbleInPanel } from '../../utils/script/placement'
import { propsForKind, kindOfBubble, isNarrationKind, type LineKind } from '../../utils/script/lineKinds'
import { buildCharacterFontMap } from '../../data/fontFamilies'

export interface AddLineOptions {
    speaker?: string
    text?: string
    kind?: LineKind
    addressee?: string
    note?: string
}

export interface UpdateLinePatch {
    speaker?: string
    text?: string
    kind?: LineKind
    /** 宛先注釈（空文字でクリア） */
    addressee?: string
    /** ニュアンス注釈（空文字でクリア） */
    note?: string
}

export interface StructuredSlice {
    /** 台本（構造化）エディタの開閉 */
    scriptEditorOpen: boolean
    openScriptEditor: () => void
    closeScriptEditor: () => void
    /** 現在ページにレイアウトを適用（コマ数を合わせ・座標を再配置。内容/色は温存） */
    setPageLayout: (layoutName: string) => void
    /** 指定コマに新しいセリフ(吹き出し)を追加 */
    addLine: (panelId: string, opts?: AddLineOptions) => void
    /** セリフ(吹き出し)の本文・話者・種別を更新 */
    updateLine: (bubbleId: string, patch: UpdateLinePatch) => void
    /** セリフ(吹き出し)を削除 */
    removeLine: (bubbleId: string) => void
    /** 現在ページにコマ(パネル)を追加 */
    addPanelToPage: () => void
    /** コマ(パネル)と、その中の吹き出しを削除 */
    removePanelFromPage: (panelId: string) => void
    /** セリフを別のコマへ移す（そのコマ内へ再配置） */
    moveLineToPanel: (bubbleId: string, panelId: string) => void
}

/** currentPage を fn で差し替える（見つからなければ無変更） */
function withCurrentPage(state: MangaState, fn: (page: Page) => Partial<Page>): Partial<MangaState> | null {
    if (!state.currentPageId) return null
    const page = state.pages.find((p) => p.id === state.currentPageId)
    if (!page) return null
    const patch = fn(page)
    return { pages: state.pages.map((p) => (p.id === page.id ? { ...p, ...patch } : p)) }
}

export const createStructuredSlice: StateCreator<MangaState, [], [], StructuredSlice> = (set) => ({
    scriptEditorOpen: false,
    openScriptEditor: () => set({ scriptEditorOpen: true }),
    closeScriptEditor: () => set({ scriptEditorOpen: false }),

    setPageLayout: (layoutName) =>
        set((state) => {
            if (!state.currentPageId) return state
            const page = state.pages.find((p) => p.id === state.currentPageId)
            if (!page) return state
            const pw = page.pageWidth ?? 840
            const ph = page.pageHeight ?? 1188
            const rects = resolvePanelRects(layoutName, page.panels.length || 1, pw, ph, state.templates)
            const targetCount = rects.length

            let panels: Panel[] = page.panels.map((p) => ({ ...p }))
            let bubbles: Bubble[] = page.bubbles.map((b) => ({ ...b }))

            // 余ったコマは削除し、その中の吹き出しは最後に残るコマへ移す
            if (panels.length > targetCount) {
                const kept = panels.slice(0, targetCount)
                const keptIds = new Set(kept.map((p) => p.id))
                const lastKeptId = kept[kept.length - 1]?.id
                bubbles = bubbles.map((b) =>
                    b.panelId && !keptIds.has(b.panelId) ? { ...b, panelId: lastKeptId } : b
                )
                panels = kept
            }
            while (panels.length < targetCount) panels.push(createPanel({}))

            // コマの形状を矩形へ更新
            panels = panels.map((p, i) => ({
                ...p,
                type: rects[i].type ?? 'rect',
                x: rects[i].x,
                y: rects[i].y,
                width: rects[i].width,
                height: rects[i].height,
                slant: rects[i].slant ?? 0,
                offsetB: rects[i].offsetB ?? 0,
                offsetC: rects[i].offsetC ?? 0,
                offsetD: rects[i].offsetD ?? 0
            }))

            // 各コマ内の吹き出しを再配置（内容・色・フォントは温存、座標/サイズのみ更新）
            const panelIds = new Set(panels.map((p) => p.id))
            const placed: Bubble[] = []
            panels.forEach((panel, i) => {
                const inPanel = bubbles.filter((b) => b.panelId === panel.id)
                inPanel.forEach((b, idx) => {
                    const pos = placeNewBubbleInPanel(rects[i], idx, kindOfBubble(b) === 'narration')
                    placed.push({ ...b, ...pos })
                })
            })
            const orphans = bubbles.filter((b) => !b.panelId || !panelIds.has(b.panelId))

            const history = saveHistory(state)
            return {
                ...state,
                ...history,
                pages: state.pages.map((p) =>
                    p.id === page.id ? { ...p, layoutName, panels, bubbles: [...placed, ...orphans] } : p
                ),
                selectedPanelId: null,
                selectedBubbleId: null
            }
        }),

    addLine: (panelId, opts) =>
        set((state) => {
            if (!state.currentPageId) return state
            const page = state.pages.find((p) => p.id === state.currentPageId)
            if (!page) return state
            const panel = page.panels.find((p) => p.id === panelId)
            if (!panel) return state
            const kind = opts?.kind ?? 'speech'
            const narration = isNarrationKind(kind)
            const existing = page.bubbles.filter((b) => b.panelId === panelId).length
            const pos = placeNewBubbleInPanel(panel, existing, narration)
            const speaker = narration ? undefined : opts?.speaker
            const font = speaker ? buildCharacterFontMap(state.referenceCharacters)[speaker.trim()] : undefined
            const newBubble = createBubble({
                ...propsForKind(kind),
                ...pos,
                panelId,
                isClipped: false,
                text: opts?.text ?? '',
                scriptSpeaker: speaker,
                ...(opts?.addressee?.trim() ? { scriptAddressee: opts.addressee.trim() } : {}),
                ...(opts?.note?.trim() ? { scriptNote: opts.note.trim() } : {}),
                ...(font ? { fontFamily: font } : {})
            })
            const history = saveHistory(state)
            return {
                ...state,
                ...history,
                pages: state.pages.map((p) => (p.id === page.id ? { ...p, bubbles: [...p.bubbles, newBubble] } : p)),
                selectedBubbleId: newBubble.id,
                selectedPanelId: null,
                selectedMaterialId: null
            }
        }),

    updateLine: (bubbleId, patch) =>
        set((state) => {
            const history = saveHistory(state)
            const result = withCurrentPage(state, (page) => ({
                bubbles: page.bubbles.map((b) => {
                    if (b.id !== bubbleId) return b
                    const updates: Partial<Bubble> = {}
                    if (patch.text !== undefined) updates.text = patch.text
                    if (patch.kind !== undefined) Object.assign(updates, propsForKind(patch.kind))
                    if (patch.speaker !== undefined) {
                        const sp = patch.speaker.trim()
                        updates.scriptSpeaker = sp || undefined
                        const font = sp ? buildCharacterFontMap(state.referenceCharacters)[sp] : undefined
                        if (font) updates.fontFamily = font
                    }
                    if (patch.kind === 'narration') updates.scriptSpeaker = undefined
                    if (patch.addressee !== undefined) updates.scriptAddressee = patch.addressee.trim() || undefined
                    if (patch.note !== undefined) updates.scriptNote = patch.note.trim() || undefined
                    return { ...b, ...updates }
                })
            }))
            if (!result) return state
            return { ...state, ...history, ...result }
        }),

    removeLine: (bubbleId) =>
        set((state) => {
            const history = saveHistory(state)
            const result = withCurrentPage(state, (page) => ({
                bubbles: page.bubbles.filter((b) => b.id !== bubbleId)
            }))
            if (!result) return state
            return {
                ...state,
                ...history,
                ...result,
                selectedBubbleId: state.selectedBubbleId === bubbleId ? null : state.selectedBubbleId
            }
        }),

    addPanelToPage: () =>
        set((state) => {
            if (!state.currentPageId) return state
            const page = state.pages.find((p) => p.id === state.currentPageId)
            if (!page) return state
            const pw = page.pageWidth ?? 840
            const ph = page.pageHeight ?? 1188
            const newPanel = createPanel({
                x: Math.round(pw * 0.28),
                y: Math.round(ph * 0.3),
                width: Math.round(pw * 0.44),
                height: Math.round(ph * 0.28)
            })
            const history = saveHistory(state)
            return {
                ...state,
                ...history,
                pages: state.pages.map((p) => (p.id === page.id ? { ...p, panels: [...p.panels, newPanel] } : p)),
                selectedPanelId: newPanel.id,
                selectedBubbleId: null
            }
        }),

    removePanelFromPage: (panelId) =>
        set((state) => {
            const history = saveHistory(state)
            const result = withCurrentPage(state, (page) => ({
                panels: page.panels.filter((p) => p.id !== panelId),
                bubbles: page.bubbles.filter((b) => b.panelId !== panelId)
            }))
            if (!result) return state
            return {
                ...state,
                ...history,
                ...result,
                selectedPanelId: state.selectedPanelId === panelId ? null : state.selectedPanelId
            }
        }),

    moveLineToPanel: (bubbleId, panelId) =>
        set((state) => {
            if (!state.currentPageId) return state
            const page = state.pages.find((p) => p.id === state.currentPageId)
            if (!page) return state
            const panel = page.panels.find((p) => p.id === panelId)
            const bubble = page.bubbles.find((b) => b.id === bubbleId)
            if (!panel || !bubble) return state
            const existing = page.bubbles.filter((b) => b.panelId === panelId && b.id !== bubbleId).length
            const pos = placeNewBubbleInPanel(panel, existing, kindOfBubble(bubble) === 'narration')
            const history = saveHistory(state)
            return {
                ...state,
                ...history,
                pages: state.pages.map((p) =>
                    p.id === page.id
                        ? { ...p, bubbles: p.bubbles.map((b) => (b.id === bubbleId ? { ...b, panelId, ...pos } : b)) }
                        : p
                )
            }
        })
})
