import type { Page } from './types'

export const HISTORY_LIMIT = 100

export interface HistoryEntry {
    pages: Page[]
    currentPageId: string | null
}

export const deepClone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj))

export const limitHistory = <T>(list: T[]): T[] =>
    list.length > HISTORY_LIMIT ? list.slice(-HISTORY_LIMIT) : list

export const saveHistory = (state: {
    past: HistoryEntry[]
    pages: Page[]
    currentPageId: string | null
}): { past: HistoryEntry[]; future: HistoryEntry[] } => ({
    past: limitHistory([...state.past, { pages: deepClone(state.pages), currentPageId: state.currentPageId }]),
    future: []
})
