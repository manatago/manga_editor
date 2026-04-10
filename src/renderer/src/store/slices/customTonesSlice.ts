import { StateCreator } from 'zustand'
import type { MangaState } from '../useMangaStore'
import type { CustomToneEntry } from '../types'

export interface CustomTonesSlice {
    customTones: CustomToneEntry[]
    /** id → 絶対パス。URL 解決に使う */
    customTonePaths: Record<string, string>
    loadCustomTones: () => Promise<void>
    addCustomTone: (sourcePath: string, name: string) => Promise<void>
    removeCustomTone: (id: string) => Promise<void>
}

export const createCustomTonesSlice: StateCreator<MangaState, [], [], CustomTonesSlice> = (set) => ({
    customTones: [],
    customTonePaths: {},

    loadCustomTones: async () => {
        if (!window.electron) return
        const entries = await window.electron.getCustomTones()
        const paths: Record<string, string> = {}
        for (const e of entries) {
            paths[e.id] = e.absolutePath
        }
        set({ customTones: entries.map(({ id, name }) => ({ id, name })), customTonePaths: paths })
    },

    addCustomTone: async (sourcePath, name) => {
        if (!window.electron) return
        const entry = await window.electron.addCustomTone(sourcePath, name)
        set((s) => ({
            customTones: [...s.customTones, { id: entry.id, name: entry.name }],
            customTonePaths: { ...s.customTonePaths, [entry.id]: entry.absolutePath }
        }))
    },

    removeCustomTone: async (id) => {
        if (!window.electron) return
        await window.electron.deleteCustomTone(id)
        set((s) => {
            const paths = { ...s.customTonePaths }
            delete paths[id]
            return {
                customTones: s.customTones.filter((t) => t.id !== id),
                customTonePaths: paths
            }
        })
    }
})
