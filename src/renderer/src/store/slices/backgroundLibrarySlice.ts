import { StateCreator } from 'zustand'
import type { MangaState } from '../useMangaStore'
import type { BackgroundLibraryImage } from '../types'
import { newBackgroundLibraryImageId } from '../../utils/backgroundLibrary'
import { confirmMessage, showError } from '../../utils/dialogs'

export interface BackgroundLibrarySlice {
    backgroundLibrary: BackgroundLibraryImage[]
    addBackgroundLibraryImage: (name: string, relativePath: string) => void
    removeBackgroundLibraryImage: (id: string) => Promise<void>
    updateBackgroundLibraryImage: (id: string, patch: Partial<Pick<BackgroundLibraryImage, 'name'>>) => void
}

export const createBackgroundLibrarySlice: StateCreator<
    MangaState,
    [],
    [],
    BackgroundLibrarySlice
> = (set, get) => ({
    backgroundLibrary: [],

    addBackgroundLibraryImage: (name, relativePath) => {
        const norm = relativePath.replace(/\\/g, '/')
        set((s) => {
            if (s.backgroundLibrary.some((x) => x.relativePath === norm)) return s
            return {
                backgroundLibrary: [
                    ...s.backgroundLibrary,
                    {
                        id: newBackgroundLibraryImageId(),
                        name: name.trim() || '背景',
                        relativePath: norm,
                        addedAt: new Date().toISOString()
                    }
                ]
            }
        })
    },

    removeBackgroundLibraryImage: async (id) => {
        const item = get().backgroundLibrary.find((x) => x.id === id)
        if (!item) return
        const ok = await confirmMessage(`「${item.name}」をライブラリから削除しますか？（ファイルも削除します）`)
        if (!ok) return
        const pp = get().currentProjectPath
        if (pp && window.electron) {
            const abs = window.electron.resolveAssetPath(pp, item.relativePath)
            if (abs) {
                try {
                    await window.electron.deleteFile(abs)
                } catch (e) {
                    console.error('backgroundLibrarySlice: deleteFile', e)
                    await showError('ファイルの削除に失敗しました')
                    return
                }
            }
        }
        set((s) => ({
            backgroundLibrary: s.backgroundLibrary.filter((x) => x.id !== id)
        }))
    },

    updateBackgroundLibraryImage: (id, patch) => {
        set((s) => ({
            backgroundLibrary: s.backgroundLibrary.map((x) => (x.id === id ? { ...x, ...patch } : x))
        }))
    }
})
