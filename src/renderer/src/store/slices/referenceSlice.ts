import { StateCreator } from 'zustand'
import type { MangaState } from '../useMangaStore'
import type { ReferenceCharacter } from '../types'
import { newReferenceCharacterId, newReferenceImageId } from '../../utils/referenceCharacters'
import { confirmMessage, showError } from '../../utils/dialogs'

export interface ReferenceSlice {
    referenceCharacters: ReferenceCharacter[]
    addReferenceCharacter: () => string
    removeReferenceCharacter: (id: string) => Promise<void>
    updateReferenceCharacter: (
        id: string,
        patch: Partial<Pick<ReferenceCharacter, 'name' | 'positivePrompt' | 'negativePrompt'>>
    ) => void
    /** 取り込み済みの相対パスをキャラに追加 */
    registerReferenceCharacterImage: (characterId: string, relativePath: string) => void
    removeReferenceCharacterImage: (characterId: string, imageId: string) => Promise<void>
}

export const createReferenceSlice: StateCreator<MangaState, [], [], ReferenceSlice> = (set, get) => ({
    referenceCharacters: [],

    addReferenceCharacter: () => {
        const id = newReferenceCharacterId()
        set((s) => ({
            referenceCharacters: [
                ...s.referenceCharacters,
                {
                    id,
                    name: '新規キャラ',
                    positivePrompt: '',
                    negativePrompt: '',
                    images: []
                }
            ]
        }))
        return id
    },

    removeReferenceCharacter: async (id) => {
        const ch = get().referenceCharacters.find((c) => c.id === id)
        if (!ch) return
        const ok = await confirmMessage(`「${ch.name}」とその画像を削除しますか？`)
        if (!ok) return
        const pp = get().currentProjectPath
        if (pp && window.electron) {
            for (const im of ch.images) {
                const abs = window.electron.resolveAssetPath(pp, im.relativePath)
                if (abs) {
                    try {
                        await window.electron.deleteFile(abs)
                    } catch (e) {
                        console.warn('referenceSlice: deleteFile skipped', im.relativePath, e)
                    }
                }
            }
        }
        set((s) => ({
            referenceCharacters: s.referenceCharacters.filter((c) => c.id !== id)
        }))
    },

    updateReferenceCharacter: (id, patch) => {
        set((s) => ({
            referenceCharacters: s.referenceCharacters.map((c) =>
                c.id === id ? { ...c, ...patch } : c
            )
        }))
    },

    registerReferenceCharacterImage: (characterId, relativePath) => {
        const norm = relativePath.replace(/\\/g, '/')
        set((s) => ({
            referenceCharacters: s.referenceCharacters.map((c) => {
                if (c.id !== characterId) return c
                if (c.images.some((i) => i.relativePath === norm)) return c
                return {
                    ...c,
                    images: [
                        ...c.images,
                        {
                            id: newReferenceImageId(),
                            relativePath: norm,
                            addedAt: new Date().toISOString()
                        }
                    ]
                }
            })
        }))
    },

    removeReferenceCharacterImage: async (characterId, imageId) => {
        const ch = get().referenceCharacters.find((c) => c.id === characterId)
        const im = ch?.images.find((i) => i.id === imageId)
        if (!im) return
        const pp = get().currentProjectPath
        if (pp && window.electron) {
            const abs = window.electron.resolveAssetPath(pp, im.relativePath)
            if (abs) {
                try {
                    await window.electron.deleteFile(abs)
                } catch (e) {
                    console.error('referenceSlice: deleteFile', e)
                    await showError('画像ファイルの削除に失敗しました')
                    return
                }
            }
        }
        set((s) => ({
            referenceCharacters: s.referenceCharacters.map((c) => {
                if (c.id !== characterId) return c
                return { ...c, images: c.images.filter((i) => i.id !== imageId) }
            })
        }))
    }
})
