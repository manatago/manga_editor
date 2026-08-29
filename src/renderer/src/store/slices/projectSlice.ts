import { StateCreator } from 'zustand'
import type { MangaState } from '../useMangaStore'
import type { PageTemplate, MangaProjectData, Page } from '../types'
import { toRelativeAssetPath, physicalFileToRelative, isAssetTrashRelativePath } from '../../utils/projectAssets'
import { normalizeReferenceCharacters } from '../../utils/referenceCharacters'
import { normalizeBackgroundLibrary } from '../../utils/backgroundLibrary'
import { confirmMessage, showError, showInfo } from '../../utils/dialogs'
import { sanitizePage } from './project/sanitize'

/** 「最後に見ていたページ」を端末ローカルに保持するための localStorage キー（プロジェクト単位） */
export const lastPageKey = (projectPath: string): string => `mango:lastPage:${projectPath}`

export interface ProjectSlice {
    currentProjectPath: string | null
    templates: PageTemplate[]
    isSaving: boolean
    lastSavedAt: number | null
    saveError: string | null
    isExporting: boolean
    setCurrentProject: (path: string) => void
    setProjectData: (data: {
        pages: Page[]
        archivedPages?: Page[]
        lastPageId?: string | null
        referenceCharacters?: MangaProjectData['referenceCharacters']
        backgroundLibrary?: MangaProjectData['backgroundLibrary']
        manuscript?: string
    }) => void
    getProjectData: () => MangaProjectData
    saveProject: () => Promise<void>
    loadTemplates: () => Promise<void>
    saveAsTemplate: (name: string) => Promise<void>
    removeTemplate: (id: string) => Promise<void>
    setExporting: (val: boolean) => void
    cleanupAssets: () => Promise<void>
}

/** ページ内のアセットパスを保存用に相対パスへ変換する（pages / archivedPages 共通） */
function relativizePageAssets(pp: string, page: Page): Page {
    return {
        ...page,
        panels: page.panels.map((p) => ({
            ...p,
            imagePath: toRelativeAssetPath(pp, p.imagePath) ?? p.imagePath,
            backgroundImagePath: p.backgroundImagePath?.startsWith('builtin://')
                ? p.backgroundImagePath
                : p.backgroundImagePath
                  ? toRelativeAssetPath(pp, p.backgroundImagePath) ?? p.backgroundImagePath
                  : undefined
        })),
        materials: (page.materials || []).map((m) => ({
            ...m,
            imagePath: toRelativeAssetPath(pp, m.imagePath) ?? m.imagePath
        })),
        backgroundImagePath: page.backgroundImagePath?.startsWith('builtin://')
            ? page.backgroundImagePath
            : page.backgroundImagePath
              ? toRelativeAssetPath(pp, page.backgroundImagePath) ?? page.backgroundImagePath
              : undefined
    }
}

export const createProjectSlice: StateCreator<MangaState, [], [], ProjectSlice> = (set, get) => ({
    currentProjectPath: null,
    templates: [],
    isSaving: false,
    lastSavedAt: null,
    saveError: null,
    isExporting: false,

    setCurrentProject: (path) => set({ currentProjectPath: path }),

    setProjectData: (data) => {
        console.log('Store: setProjectData called with:', data)
        const projectPathForAssets = get().currentProjectPath
        const sanitizedPages = (data.pages || []).map((page) => sanitizePage(page, projectPathForAssets))
        const normalizedPages = sanitizedPages.map((p, i) => ({
            ...p,
            name: String(i + 1).padStart(3, '0')
        }))
        // 保管ページも同じ sanitize でアセットパスを解決（ページ番号は付け替えない）
        const sanitizedArchived = (data.archivedPages || []).map((page) =>
            sanitizePage(page, projectPathForAssets)
        )

        // 「最後に見ていたページ」は端末ローカル(localStorage)から復元。無ければ旧データの
        // lastPageId（後方互換）→ 先頭ページ の順。存在しないIDは無視。
        let restoredPageId: string | null = null
        try {
            const stored = projectPathForAssets
                ? localStorage.getItem(lastPageKey(projectPathForAssets))
                : null
            if (stored && normalizedPages.some((p) => p.id === stored)) restoredPageId = stored
        } catch {
            /* localStorage 不可なら無視 */
        }
        const legacyPageId =
            data.lastPageId && normalizedPages.some((p) => p.id === data.lastPageId)
                ? data.lastPageId
                : null

        set({
            pages: normalizedPages,
            archivedPages: sanitizedArchived,
            currentPageId: restoredPageId || legacyPageId || normalizedPages[0]?.id || null,
            selectedPanelId: null,
            selectedBubbleId: null,
            currentProjectPath: get().currentProjectPath,
            referenceCharacters: normalizeReferenceCharacters(data.referenceCharacters),
            backgroundLibrary: normalizeBackgroundLibrary(data.backgroundLibrary),
            manuscript: typeof data.manuscript === 'string' ? data.manuscript : '',
            manuscriptSelection: null
        })
        console.log('Store: setProjectData done. normalized count:', normalizedPages.length)
    },

    getProjectData: () => {
        const state = get()
        const pp = state.currentProjectPath
        if (!pp) {
            return {
                pages: state.pages,
                archivedPages: state.archivedPages,
                referenceCharacters: state.referenceCharacters,
                backgroundLibrary: state.backgroundLibrary,
                manuscript: state.manuscript
            }
        }
        const pages = state.pages.map((page) => relativizePageAssets(pp, page))
        const archivedPages = state.archivedPages.map((page) => relativizePageAssets(pp, page))
        return {
            pages,
            archivedPages,
            referenceCharacters: state.referenceCharacters,
            backgroundLibrary: state.backgroundLibrary,
            manuscript: state.manuscript
        }
    },

    saveProject: async () => {
        const state = get()
        if (!state.currentProjectPath || !window.electron) {
            console.warn('Store: cannot save project - no path or electron not found')
            return
        }
        try {
            set({ isSaving: true, saveError: null })
            const projectData = state.getProjectData()
            await window.electron.saveProject(state.currentProjectPath, projectData)
            console.log('Store: project saved successfully to', state.currentProjectPath)
            set({ isSaving: false, saveError: null, lastSavedAt: Date.now() })
        } catch (error) {
            console.error('Store: failed to save project', error)
            set({ isSaving: false, saveError: 'プロジェクトの保存に失敗しました' })
            await showError('プロジェクトの保存に失敗しました')
        }
    },

    loadTemplates: async () => {
        if (!window.electron) return
        const templates = await window.electron.getTemplates()
        set({ templates })
    },

    saveAsTemplate: async (name) => {
        const state = get()
        const page = state.pages.find((p) => p.id === state.currentPageId)
        console.log('Store: saving as template', { name, pageId: state.currentPageId })
        if (!page || !window.electron) {
            console.error('Store: cannot save template - page or electron not found')
            return
        }
        try {
            const template = {
                name,
                panels: page.panels.map(({
                    id: _id,
                    imagePath: _imagePath,
                    imageX: _imageX,
                    imageY: _imageY,
                    imageScale: _imageScale,
                    imageRotation: _imageRotation,
                    imageFlipX: _imageFlipX,
                    isGrayscale: _isGrayscale,
                    grayscaleBrightness: _grayscaleBrightness,
                    ...rest
                }) => ({ ...rest }))
            }
            console.log('Store: sending template to main', template)
            const templates = await window.electron.saveTemplate(template)
            console.log('Store: templates updated', templates)
            set({ templates })
            await showInfo(`テンプレート "${name}" を保存しました`)
        } catch (error) {
            console.error('Store: failed to save template', error)
            await showError('テンプレートの保存に失敗しました')
        }
    },

    removeTemplate: async (id) => {
        if (!window.electron) return
        try {
            const ok = await confirmMessage('このテンプレートを削除してもよろしいですか？')
            if (ok) {
                const templates = await window.electron.deleteTemplate(id)
                set({ templates })
            }
        } catch (error) {
            console.error('Store: failed to delete template', error)
            await showError('テンプレートの削除に失敗しました')
        }
    },

    setExporting: (val) => set({ isExporting: val }),

    cleanupAssets: async () => {
        const state = get()
        if (!state.currentProjectPath || !window.electron) {
            console.warn('Store: cannot cleanup assets - no project path or electron not found')
            return
        }
        try {
            const referencedPaths = new Set<string>()
            const pp = state.currentProjectPath
            // 保管ページ（アーカイブ）の画像も「使用中」として保護し、勝手にゴミ箱へ送らない
            const allPagesForRefs = [...state.pages, ...state.archivedPages]
            allPagesForRefs.forEach((page) => {
                page.panels.forEach((panel) => {
                    if (panel.imagePath) {
                        const rel = toRelativeAssetPath(pp, panel.imagePath) ?? panel.imagePath
                        referencedPaths.add(rel)
                    }
                    const pbg = panel.backgroundImagePath
                    if (pbg && !pbg.startsWith('builtin://')) {
                        const rel = toRelativeAssetPath(pp, pbg) ?? pbg
                        referencedPaths.add(rel)
                    }
                })
                page.materials.forEach((material) => {
                    if (material.imagePath) {
                        const rel = toRelativeAssetPath(pp, material.imagePath) ?? material.imagePath
                        referencedPaths.add(rel)
                    }
                })
            })
            state.referenceCharacters.forEach((ch) => {
                ch.images.forEach((im) => {
                    const rel = toRelativeAssetPath(pp, im.relativePath) ?? im.relativePath
                    referencedPaths.add(rel)
                })
            })
            state.backgroundLibrary.forEach((bg) => {
                const rel = toRelativeAssetPath(pp, bg.relativePath) ?? bg.relativePath
                referencedPaths.add(rel)
            })
            allPagesForRefs.forEach((page) => {
                const bp = page.backgroundImagePath
                if (bp && !bp.startsWith('builtin://')) {
                    const rel = toRelativeAssetPath(pp, bp) ?? bp
                    referencedPaths.add(rel)
                }
            })

            const physicalAssets = await window.electron.getAssets(state.currentProjectPath)
            const unusedAssets = physicalAssets.filter((fullPath) => {
                const rel = physicalFileToRelative(pp, fullPath)
                if (isAssetTrashRelativePath(rel)) return false
                return !referencedPaths.has(rel)
            })

            if (unusedAssets.length === 0) {
                await showInfo('未使用のアセットは見つかりませんでした。')
                return
            }

            const ok = await confirmMessage(
                `${unusedAssets.length} 件の未使用ファイルを assets/dust/ に移動しますか？\n（漫画データから参照されていない画像のみ。完全削除ではありません）`
            )
            if (ok) {
                let moved = 0
                for (const absPath of unusedAssets) {
                    const r = await window.electron.moveAssetToTrash(pp, absPath)
                    if (r.moved) moved += 1
                }
                await showInfo(`${moved} 件を assets/dust/ に移動しました。`)
            }
        } catch (error) {
            console.error('Store: failed to cleanup assets', error)
            await showError('アセットの整理に失敗しました。')
        }
    }
})
