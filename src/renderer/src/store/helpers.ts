import type { Page } from './types'

export const HISTORY_LIMIT = 100

export interface HistoryEntry {
    pages: Page[]
    archivedPages: Page[]
    currentPageId: string | null
}

export const deepClone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj))

export const limitHistory = <T>(list: T[]): T[] =>
    list.length > HISTORY_LIMIT ? list.slice(-HISTORY_LIMIT) : list

export const snapshot = (state: {
    pages: Page[]
    archivedPages?: Page[]
    currentPageId: string | null
}): HistoryEntry => ({
    pages: deepClone(state.pages),
    archivedPages: deepClone(state.archivedPages ?? []),
    currentPageId: state.currentPageId
})

export const saveHistory = (state: {
    past: HistoryEntry[]
    pages: Page[]
    archivedPages?: Page[]
    currentPageId: string | null
}): { past: HistoryEntry[]; future: HistoryEntry[] } => ({
    past: limitHistory([...state.past, snapshot(state)]),
    future: []
})
