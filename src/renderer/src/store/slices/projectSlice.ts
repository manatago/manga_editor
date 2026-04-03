import { StateCreator } from 'zustand'
import type { MangaState } from '../useMangaStore'
import type { PageTemplate, MangaProjectData, Page } from '../types'
import { toRelativeAssetPath, physicalFileToRelative, isAssetTrashRelativePath } from '../../utils/projectAssets'
import { normalizeReferenceCharacters } from '../../utils/referenceCharacters'
import { normalizeBackgroundLibrary } from '../../utils/backgroundLibrary'
import { confirmMessage, showError, showInfo } from '../../utils/dialogs'

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
        lastPageId?: string | null
        referenceCharacters?: MangaProjectData['referenceCharacters']
        backgroundLibrary?: MangaProjectData['backgroundLibrary']
    }) => void
    getProjectData: () => MangaProjectData
    saveProject: () => Promise<void>
    loadTemplates: () => Promise<void>
    saveAsTemplate: (name: string) => Promise<void>
    removeTemplate: (id: string) => Promise<void>
    setExporting: (val: boolean) => void
    cleanupAssets: () => Promise<void>
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
        const sanitizedPages = (data.pages || []).map((page) => ({
            ...page,
            pageWidth: Math.max(400, Math.round(page.pageWidth ?? 840)),
            pageHeight: Math.max(400, Math.round(page.pageHeight ?? 1188)),
            gridEnabled: !!page.gridEnabled,
            gridSize: Math.max(8, Math.min(200, Math.round(page.gridSize ?? 24))),
            backgroundColor: page.backgroundColor || '#ffffff',
            backgroundOpacity: page.backgroundOpacity ?? 1,
            bubbles: (page.bubbles || []).map((bubble) => ({
                ...bubble,
                fontSize: bubble.fontSize || 22,
                backgroundOpacity: bubble.backgroundOpacity ?? 1,
                lineHeight: bubble.lineHeight ?? 1.0,
                fontWeight: bubble.fontWeight || 'bold',
                spikeCount: bubble.spikeCount || 36,
                narrowRatio: bubble.narrowRatio ?? 0.3,
                flashLength: bubble.flashLength || 1,
                tailType: bubble.tailType || 'point',
                rotation: bubble.rotation ?? 0
            })),
            panels: (page.panels || []).map((panel) => {
                let width = panel.width
                let height = panel.height
                if ((width === undefined || width === null) && (panel as any).points) {
                    const pts = (panel as any).points
                    width = pts[2] - pts[0]
                    height = pts[5] - pts[1]
                }
                return {
                    ...panel,
                    type: panel.type || 'rect',
                    width: width || 200,
                    height: height || 150,
                    rotation: panel.rotation ?? 0,
                    x: panel.x || 0,
                    y: panel.y || 0,
                    strokeWidth: panel.strokeWidth ?? 1,
                    strokeColor: (panel as any).strokeColor || '#000000',
                    slant: panel.slant || 0,
                    offsetB: panel.offsetB || 0,
                    offsetC: panel.offsetC || 0,
                    offsetD: panel.offsetD || 0,
                    imageX: panel.imageX || 0,
                    imageY: panel.imageY || 0,
                    imageScale: panel.imageScale ?? 1,
                    imageRotation: panel.imageRotation ?? 0,
                    fadeDirection: panel.fadeDirection || 'none',
                    hasFocusLines: panel.hasFocusLines || false,
                    focusCenterX: panel.focusCenterX ?? 0.5,
                    focusCenterY: panel.focusCenterY ?? 0.5,
                    focusDensity: panel.focusDensity ?? 100,
                    focusWidth: panel.focusWidth ?? 1,
                    focusRadius: panel.focusRadius ?? 50,
                    fadeStrength: panel.fadeStrength ?? 0.4,
                    isGrayscale: panel.isGrayscale ?? false,
                    imageFlipX: panel.imageFlipX ?? false,
                    blurRadius: panel.blurRadius ?? 0,
                    hasRainEffect: panel.hasRainEffect ?? false,
                    rainDensity: panel.rainDensity ?? 100,
                    rainOpacity: panel.rainOpacity ?? 0.3,
                    imagePath:
                        projectPathForAssets && panel.imagePath
                            ? toRelativeAssetPath(projectPathForAssets, panel.imagePath) ?? panel.imagePath
                            : panel.imagePath,
                    backgroundImagePath: (() => {
                        const bp = panel.backgroundImagePath
                        if (!bp) return undefined
                        if (bp.startsWith('builtin://')) return bp
                        return projectPathForAssets
                            ? toRelativeAssetPath(projectPathForAssets, bp) ?? bp
                            : bp
                    })(),
                    backgroundImageOpacity:
                        panel.backgroundImageOpacity != null
                            ? Math.max(0, Math.min(1, panel.backgroundImageOpacity))
                            : 1,
                    backgroundImageFit:
                        panel.backgroundImageFit === 'stretch' || panel.backgroundImageFit === 'tile'
                            ? panel.backgroundImageFit
                            : undefined
                }
            }),
            materials: (page.materials || []).map((mat) => ({
                ...mat,
                opacity: mat.opacity ?? 1,
                isClipped: mat.isClipped ?? false,
                isGrayscale: mat.isGrayscale ?? false,
                imagePath:
                    projectPathForAssets && mat.imagePath
                        ? toRelativeAssetPath(projectPathForAssets, mat.imagePath) ?? mat.imagePath
                        : mat.imagePath
            })),
            backgroundImagePath: (() => {
                const bp = page.backgroundImagePath
                if (!bp) return undefined
                if (bp.startsWith('builtin://')) return bp
                return projectPathForAssets
                    ? toRelativeAssetPath(projectPathForAssets, bp) ?? bp
                    : bp
            })(),
            backgroundImageOpacity:
                page.backgroundImageOpacity != null
                    ? Math.max(0, Math.min(1, page.backgroundImageOpacity))
                    : 1,
            backgroundImageFit:
                page.backgroundImageFit === 'stretch' || page.backgroundImageFit === 'tile'
                    ? page.backgroundImageFit
                    : undefined
        }))

        const normalizedPages = sanitizedPages.map((p, i) => ({
            ...p,
            name: String(i + 1).padStart(3, '0')
        }))

        set({
            pages: normalizedPages,
            currentPageId: data.lastPageId || normalizedPages[0]?.id || null,
            selectedPanelId: null,
            selectedBubbleId: null,
            currentProjectPath: get().currentProjectPath,
            referenceCharacters: normalizeReferenceCharacters(data.referenceCharacters),
            backgroundLibrary: normalizeBackgroundLibrary(data.backgroundLibrary)
        })
        console.log('Store: setProjectData done. normalized count:', normalizedPages.length)
    },

    getProjectData: () => {
        const state = get()
        const pp = state.currentProjectPath
        if (!pp) {
            return {
                pages: state.pages,
                lastPageId: state.currentPageId,
                referenceCharacters: state.referenceCharacters,
                backgroundLibrary: state.backgroundLibrary
            }
        }
        const pages = state.pages.map((page) => ({
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
        }))
        return {
            pages,
            lastPageId: state.currentPageId,
            referenceCharacters: state.referenceCharacters,
            backgroundLibrary: state.backgroundLibrary
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
                    id, imagePath, imageX, imageY, imageScale, imageRotation, imageFlipX, isGrayscale, ...rest
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
            state.pages.forEach((page) => {
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
            state.pages.forEach((page) => {
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
