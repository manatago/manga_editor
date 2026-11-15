import { StateCreator } from 'zustand'
import type { MangaState } from '../useMangaStore'
import type { Page, Panel } from '../types'
import { historyKey, newId, saveHistory } from '../helpers'

export interface SelectPageOptions {
    /** 一括エクスポート等でページを素早く切り替えるとき true（毎回の saveProject を省略） */
    skipAutosave?: boolean
}

export interface PageSlice {
    pages: Page[]
    /** 削除せず保管したページ（完全削除の代わり）。新しい順で保持 */
    archivedPages: Page[]
    currentPageId: string | null
    addPage: (panels?: Omit<Panel, 'id'>[]) => void
    selectPage: (id: string, options?: SelectPageOptions) => void
    removePage: (id: string) => void
    /** 保管ページを本編末尾に復元する */
    restorePage: (id: string) => void
    /** 保管ページを完全に削除する */
    deleteArchivedPage: (id: string) => void
    updatePage: (id: string, updates: Partial<Page>) => void
    movePage: (id: string, direction: 'up' | 'down') => void
    /** ページを丸ごと複製して直後に挿入し、複製したページを表示する */
    duplicatePage: (id: string) => void
}

/**
 * ページを ID を振り直して複製する。吹き出し・素材が持つ所属コマ（panelId）も新しいコマ ID に付け替える。
 * 画像ファイルは複製せず同じパスを参照する（Assets整理では参照中として保護される）。
 *
 * ただし「漫画化PNG」は assets/manga/<panelId>_<kind>.png という panelId 固定名で上書き保存される
 * キャッシュなので、旧 panelId のまま引き継ぐと元コマの再焼き（トグル/強さ変更）で複製側の画像まで
 * 無言で差し替わってしまう。これだけは引き継がず OFF 状態で複製する（必要なら新 ID で焼き直せる。
 * imagePath から再生成可能なキャッシュであり、元画像は失われない）。
 */
export function clonePageWithNewIds(page: Page): Page {
    const panelIdMap = new Map<string, string>()
    const panels = page.panels.map((p) => {
        const id = newId('panel')
        panelIdMap.set(p.id, id)
        const {
            isManga: _isManga,
            mangaImagePath: _mangaImagePath,
            mangaProtrudePath: _mangaProtrudePath,
            mangaLevel: _mangaLevel,
            mangaStamp: _mangaStamp,
            ...panelRest
        } = p
        // novelai は入れ子のオブジェクト・配列なので、参照共有だと将来の in-place 変更で元コマと巻き添えになる。複製時に deep copy する。
        return { ...panelRest, id, ...(p.novelai ? { novelai: structuredClone(p.novelai) } : {}) }
    })
    const remap = (panelId: string | undefined): string | undefined =>
        panelId === undefined ? undefined : (panelIdMap.get(panelId) ?? panelId)
    const { archivedAt: _archivedAt, ...rest } = page
    return {
        ...rest,
        id: newId('page'),
        panels,
        bubbles: page.bubbles.map((b) => ({ ...b, id: newId('bubble'), panelId: remap(b.panelId) })),
        materials: page.materials.map((m) => ({ ...m, id: newId('material'), panelId: remap(m.panelId) })),
        ...(page.mosaics ? { mosaics: page.mosaics.map((m) => ({ ...m, id: newId('mosaic') })) } : {})
    }
}

export const createPageSlice: StateCreator<MangaState, [], [], PageSlice> = (set, get) => ({
    pages: [],
    archivedPages: [],
    currentPageId: null,

    addPage: (panels = []) => set((state) => {
        const history = saveHistory(state)
        const newPage: Page = {
            id: newId('page'),
            name: String(state.pages.length + 1).padStart(3, '0'),
            pageWidth: 840,
            pageHeight: 1188,
            gridEnabled: false,
            gridSize: 24,
            panels: panels.map(p => ({
                id: newId('panel'),
                ...p
            })) as Panel[],
            bubbles: [],
            materials: [],
            backgroundColor: '#ffffff',
            backgroundOpacity: 1
        }
        return {
            ...state,
            ...history,
            pages: [...state.pages, newPage],
            currentPageId: newPage.id,
            selectedPanelId: null,
            selectedBubbleId: null,
            selectedMaterialId: null
        }
    }),

    selectPage: (id, options) => {
        set({ currentPageId: id, selectedPanelId: null, selectedBubbleId: null, selectedMaterialId: null })
        const state = get()
        if (!options?.skipAutosave && state.currentProjectPath) {
            state.saveProject()
        }
    },

    removePage: (id) => set((state) => {
        const index = state.pages.findIndex((p) => p.id === id)
        if (index === -1) return state

        const history = saveHistory(state)
        const removed = state.pages[index]
        const newPages = state.pages.filter((p) => p.id !== id)
        const normalizedPages = newPages.map((p, i) => ({
            ...p,
            name: String(i + 1).padStart(3, '0')
        }))

        let newCurrentPageId = state.currentPageId
        if (state.currentPageId === id) {
            const nextIdx = Math.min(index, normalizedPages.length - 1)
            newCurrentPageId = normalizedPages[nextIdx]?.id || null
        }

        // 完全削除せず保管（アーカイブ）へ。あとで復元できる。
        const archived: Page = { ...removed, archivedAt: new Date().getTime() }

        return {
            ...state,
            ...history,
            pages: normalizedPages,
            archivedPages: [archived, ...state.archivedPages],
            currentPageId: newCurrentPageId,
            selectedPanelId: null,
            selectedBubbleId: null,
            selectedMaterialId: null
        }
    }),

    restorePage: (id) => set((state) => {
        const archived = state.archivedPages.find((p) => p.id === id)
        if (!archived) return state

        const history = saveHistory(state)
        // id の衝突を避けて末尾へ復元（Date.now() 採番は同一ミリ秒で衝突しうるため newId を使う）
        const existingIds = new Set(state.pages.map((p) => p.id))
        const restoredId = existingIds.has(archived.id) ? newId('page') : archived.id
        const { archivedAt: _archivedAt, ...rest } = archived
        const restored: Page = { ...rest, id: restoredId }

        const newPages = [...state.pages, restored].map((p, i) => ({
            ...p,
            name: String(i + 1).padStart(3, '0')
        }))

        return {
            ...state,
            ...history,
            pages: newPages,
            archivedPages: state.archivedPages.filter((p) => p.id !== id),
            currentPageId: restoredId,
            selectedPanelId: null,
            selectedBubbleId: null,
            selectedMaterialId: null
        }
    }),

    deleteArchivedPage: (id) => set((state) => {
        if (!state.archivedPages.some((p) => p.id === id)) return state
        const history = saveHistory(state)
        return {
            ...state,
            ...history,
            archivedPages: state.archivedPages.filter((p) => p.id !== id)
        }
    }),

    updatePage: (id, updates) => set((state) => {
        const history = saveHistory(state, historyKey('page', id, updates))
        return {
            ...state,
            ...history,
            pages: state.pages.map((p) => (p.id === id ? { ...p, ...updates } : p))
        }
    }),

    duplicatePage: (id) => set((state) => {
        const index = state.pages.findIndex((p) => p.id === id)
        if (index === -1) return state
        const copy = clonePageWithNewIds(state.pages[index])
        const pages = [...state.pages.slice(0, index + 1), copy, ...state.pages.slice(index + 1)].map((p, i) => ({
            ...p,
            name: String(i + 1).padStart(3, '0')
        }))
        return {
            ...state,
            ...saveHistory(state),
            pages,
            currentPageId: copy.id,
            selectedPanelId: null,
            selectedBubbleId: null,
            selectedMaterialId: null
        }
    }),

    movePage: (id, direction) => set((state) => {
        const index = state.pages.findIndex((p) => p.id === id)
        if (index === -1) return state

        const newPages = [...state.pages]
        const targetIndex = direction === 'up' ? index - 1 : index + 1
        if (targetIndex < 0 || targetIndex >= newPages.length) return state

        const [movedPage] = newPages.splice(index, 1)
        newPages.splice(targetIndex, 0, movedPage)

        const history = saveHistory(state)
        const normalizedPages = newPages.map((p, i) => ({
            ...p,
            name: String(i + 1).padStart(3, '0')
        }))

        return { ...state, ...history, pages: normalizedPages }
    })
})
