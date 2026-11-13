import type { Page } from './types'

export const HISTORY_LIMIT = 100

/**
 * 同じ coalesceKey の変更がこの間隔（ms）以内に続いた場合は 1 件の履歴にまとめる。
 * スライダーのドラッグ・連続入力・ハンドルのドラッグなどで履歴が埋まるのを防ぐ。
 * 間隔は「最初の変更から」ではなく「直前の変更から」測る（長いドラッグも 1 件になる）。
 */
export const HISTORY_COALESCE_MS = 800

export interface HistoryEntry {
    pages: Page[]
    archivedPages: Page[]
    currentPageId: string | null
}

export const limitHistory = <T>(list: T[]): T[] =>
    list.length > HISTORY_LIMIT ? list.slice(-HISTORY_LIMIT) : list

/**
 * 現在の状態を履歴エントリにする。
 * ストアは常にイミュータブルに更新される（既存オブジェクトを書き換えない）ため、
 * ディープコピーせず参照をそのまま保持してよい（構造共有でメモリも節約できる）。
 */
export const snapshot = (state: {
    pages: Page[]
    archivedPages?: Page[]
    currentPageId: string | null
}): HistoryEntry => ({
    pages: state.pages,
    archivedPages: state.archivedPages ?? [],
    currentPageId: state.currentPageId
})

/** 「まとめ」判定用に、対象 ID と変更フィールド名から履歴キーを作る */
export const historyKey = (kind: string, id: string, updates: object): string =>
    `${kind}:${id}:${Object.keys(updates).sort().join(',')}`

export interface HistoryCoalesceState {
    lastHistoryKey: string | null
    lastHistoryAt: number
}

/** 履歴を使わない状態更新（undo/redo/プロジェクト読込）で「まとめ」を打ち切るための値 */
export const resetHistoryCoalesce: HistoryCoalesceState = { lastHistoryKey: null, lastHistoryAt: 0 }

export const saveHistory = (
    state: {
        past: HistoryEntry[]
        pages: Page[]
        archivedPages?: Page[]
        currentPageId: string | null
        lastHistoryKey?: string | null
        lastHistoryAt?: number
    },
    coalesceKey?: string
): { past?: HistoryEntry[]; future: HistoryEntry[] } & HistoryCoalesceState => {
    const now = Date.now()
    if (
        coalesceKey &&
        state.past.length > 0 &&
        state.lastHistoryKey === coalesceKey &&
        now - (state.lastHistoryAt ?? 0) < HISTORY_COALESCE_MS
    ) {
        // 直前と同じ操作の続き: 新しい履歴は積まず、まとめの期限だけ延長する
        return { future: [], lastHistoryKey: coalesceKey, lastHistoryAt: now }
    }
    return {
        past: limitHistory([...state.past, snapshot(state)]),
        future: [],
        lastHistoryKey: coalesceKey ?? null,
        lastHistoryAt: now
    }
}

/**
 * 衝突しない ID を作る（接頭辞は既存データと見分けやすくするため残す）。
 * 以前の `${prefix}_${Date.now()}` は同一ミリ秒に複数作ると重複していた。
 */
export const newId = (prefix: string): string => {
    const rand =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID().replace(/-/g, '').slice(0, 20)
            : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
    // 英数字のみ・短め（NovelAI の保存フォルダ名などに使われ、メイン側で 40 文字に切り詰められるため）
    return `${prefix}_${rand}`
}
