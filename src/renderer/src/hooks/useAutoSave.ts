import { useEffect } from 'react'
import { useMangaStore, type MangaState } from '../store/useMangaStore'

export const AUTO_SAVE_DEBOUNCE_MS = 1000

/** これらのいずれかが変わったら自動保存する（参照比較） */
const watched = (s: MangaState) =>
    [s.pages, s.archivedPages, s.currentProjectPath, s.referenceCharacters, s.backgroundLibrary, s.manuscript] as const

/**
 * 自動保存（編集から 1 秒デバウンス）と、終了直前の同期 flush。
 * React の再描画を介さず store.subscribe で監視する（App が pages を購読しないで済むように）。
 */
export const useAutoSave = (): void => {
    useEffect(() => {
        let timer: number | null = null
        const clear = (): void => {
            if (timer !== null) {
                window.clearTimeout(timer)
                timer = null
            }
        }

        let prev = watched(useMangaStore.getState())
        const unsubscribe = useMangaStore.subscribe((state) => {
            const next = watched(state)
            if (next.every((v, i) => v === prev[i])) return
            prev = next
            clear()
            if (state.currentProjectPath && (state.pages.length > 0 || state.archivedPages.length > 0)) {
                timer = window.setTimeout(() => {
                    timer = null
                    useMangaStore.getState().saveProject()
                }, AUTO_SAVE_DEBOUNCE_MS)
            }
        })

        // アプリ終了時に、デバウンス待ちの変更が失われないよう同期保存する
        const flushOnUnload = (): void => {
            const { currentProjectPath, getProjectData } = useMangaStore.getState()
            if (!currentProjectPath || !window.electron?.saveProjectSync) return
            clear()
            try {
                window.electron.saveProjectSync(currentProjectPath, getProjectData())
            } catch (error) {
                console.error('useAutoSave: failed to flush save on unload', error)
            }
        }
        window.addEventListener('beforeunload', flushOnUnload)

        return () => {
            unsubscribe()
            clear()
            window.removeEventListener('beforeunload', flushOnUnload)
        }
    }, [])
}
