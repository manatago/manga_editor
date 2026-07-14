import { StateCreator } from 'zustand'
import type { MangaState } from '../useMangaStore'

export type NovelAIConnectionStatus =
    | { state: 'idle' }
    | { state: 'testing' }
    | { state: 'ok'; anlas: number | null; fixedAnlas: number | null; purchasedAnlas: number | null; tier: number | null; balanceUnavailable?: boolean; checkedAt: number }
    | { state: 'error'; message: string; checkedAt: number }

const LAST_SUPPLEMENTARY_KEY = 'manga-yarou-novelai-last-supplementary'

function readLastSupplementary(): string {
    try {
        return localStorage.getItem(LAST_SUPPLEMENTARY_KEY) ?? ''
    } catch {
        return ''
    }
}

function writeLastSupplementary(v: string): void {
    try {
        if (v) localStorage.setItem(LAST_SUPPLEMENTARY_KEY, v)
        else localStorage.removeItem(LAST_SUPPLEMENTARY_KEY)
    } catch { /* ignore */ }
}

export interface NovelAISlice {
    novelaiToken: string
    novelaiTokenLoaded: boolean
    novelaiConnection: NovelAIConnectionStatus
    /** NovelAI 生成モーダルの対象コマ ID（null の時は閉じた状態） */
    novelaiTargetPanelId: string | null
    /** 直近生成で使った補助プロンプト（新規コマを開いた時の初期値として再利用） */
    novelaiLastSupplementary: string
    loadNovelAIToken: () => Promise<void>
    saveNovelAIToken: (token: string) => Promise<void>
    clearNovelAIToken: () => Promise<void>
    testNovelAIConnection: (tokenOverride?: string) => Promise<NovelAIConnectionStatus>
    openNovelAIForPanel: (panelId: string) => void
    closeNovelAIModal: () => void
    setNovelAILastSupplementary: (v: string) => void
}

export const createNovelAISlice: StateCreator<MangaState, [], [], NovelAISlice> = (set, get) => ({
    novelaiToken: '',
    novelaiTokenLoaded: false,
    novelaiConnection: { state: 'idle' },
    novelaiTargetPanelId: null,
    novelaiLastSupplementary: readLastSupplementary(),

    openNovelAIForPanel: (panelId: string) => set({ novelaiTargetPanelId: panelId }),
    closeNovelAIModal: () => set({ novelaiTargetPanelId: null }),
    setNovelAILastSupplementary: (v: string) => {
        writeLastSupplementary(v)
        set({ novelaiLastSupplementary: v })
    },

    loadNovelAIToken: async () => {
        if (!window.electron?.novelaiLoadToken) {
            set({ novelaiTokenLoaded: true })
            return
        }
        try {
            const { token } = await window.electron.novelaiLoadToken()
            set({ novelaiToken: token, novelaiTokenLoaded: true })
            if (token) {
                await get().testNovelAIConnection()
            }
        } catch (e) {
            console.error('novelai: loadToken failed', e)
            set({ novelaiTokenLoaded: true })
        }
    },

    saveNovelAIToken: async (token: string) => {
        if (!window.electron?.novelaiSaveToken) return
        await window.electron.novelaiSaveToken(token)
        set({ novelaiToken: token })
        if (!token) set({ novelaiConnection: { state: 'idle' } })
    },

    clearNovelAIToken: async () => {
        if (!window.electron?.novelaiClearToken) return
        await window.electron.novelaiClearToken()
        set({ novelaiToken: '', novelaiConnection: { state: 'idle' } })
    },

    testNovelAIConnection: async (tokenOverride?: string) => {
        if (!window.electron?.novelaiTestConnection) {
            const status: NovelAIConnectionStatus = { state: 'error', message: 'electron unavailable', checkedAt: Date.now() }
            set({ novelaiConnection: status })
            return status
        }
        set({ novelaiConnection: { state: 'testing' } })
        const resp = await window.electron.novelaiTestConnection(tokenOverride)
        if (resp.ok) {
            const status: NovelAIConnectionStatus = {
                state: 'ok',
                anlas: resp.anlas,
                fixedAnlas: resp.fixedAnlas,
                purchasedAnlas: resp.purchasedAnlas,
                tier: resp.tier,
                balanceUnavailable: resp.balanceUnavailable,
                checkedAt: Date.now()
            }
            set({ novelaiConnection: status })
            return status
        }
        const message =
            resp.error === 'token-missing' ? 'トークンが保存されていません' :
            resp.error === 'token-invalid' ? 'トークンが無効です（生成ホストでも認証されませんでした）。永続 API トークンを再確認してください' :
            resp.error === 'network' ? `ネットワークエラー: ${resp.message ?? ''}` :
            `HTTP ${resp.status ?? resp.error}`
        const status: NovelAIConnectionStatus = { state: 'error', message, checkedAt: Date.now() }
        set({ novelaiConnection: status })
        return status
    }
})
