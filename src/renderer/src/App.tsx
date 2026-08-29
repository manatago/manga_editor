import React, { useState, useEffect, useRef } from 'react'
import Canvas from './components/Canvas'
import SidebarLeft from './components/SidebarLeft'
import SidebarRight from './components/SidebarRight'
import { TemplateModal } from './components/TemplateModal'
import { ExportOverlay } from './components/ExportOverlay'
import { NovelAIGenerationModal } from './components/NovelAIGenerationModal'
import { PanelWandEditor } from './components/PanelWandEditor'
import { ManuscriptPanel } from './components/ManuscriptPanel'
import { ScriptEditor } from './components/ScriptEditor/ScriptEditor'
import { ModeToggle } from './components/ModeToggle'
import { TranslationModal } from './components/TranslationModal/TranslationModal'
import { GitSyncModal } from './components/GitSyncModal/GitSyncModal'
import { useMangaStore, PanelType, type BubbleType } from './store/useMangaStore'
import { lastPageKey } from './store/slices/projectSlice'
import {
    PANEL_STANDARD_HEIGHT,
    standardPanelWidth,
    computePanelInsertion
} from './utils/panelInsertion'
import { PanelTop, PanelLeft, Languages, GitBranch } from 'lucide-react'
import { showError } from './utils/dialogs'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useProjectActions } from './hooks/useProjectActions'
import { useExport } from './hooks/useExport'
import { PanelTypeIcon } from './components/icons/PanelTypeIcon'
import { BubbleTypeIcon } from './components/icons/BubbleTypeIcon'
import { BUBBLE_TYPE_LABELS, BUBBLE_TYPE_ORDER } from './components/icons/bubbleTypeMeta'

function App(): React.JSX.Element {
    const {
        currentProjectPath,
        pages,
        archivedPages,
        currentPageId,
        selectPage,
        addPage,
        updatePage,
        movePage,
        removePage,
        addPanel,
        updatePanel,
        removePanel,
        addBubble,
        updateBubble,
        removeBubble,
        saveProject,
        getProjectData,
        templates,
        addMaterial,
        updateMaterial,
        removeMaterial,
        selectedPanelId,
        selectedBubbleId,
        selectedMaterialId,
        setSelectedPanel,
        setSelectedBubble,
        setSelectedMaterial,
        loadTemplates,
        loadCustomTones,
        loadNovelAIToken,
        isExporting,
        isSaving,
        lastSavedAt,
        saveError,
        referenceCharacters,
        backgroundLibrary,
        manuscript,
        manuscriptSelection,
        removeManuscriptRange
    } = useMangaStore()

    // Custom Hooks
    useKeyboardShortcuts()
    const { handleCreateNew, handleOpenProject, openProjectByPath, handleUseTemplate, handleSaveAsTemplate } = useProjectActions()
    const { stageRef, handleExportPNG, handleExportAllPagesPNG, handleExportText } = useExport()

    // Local UI State
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
    const [isTranslationModalOpen, setIsTranslationModalOpen] = useState(false)
    const [isGitSyncModalOpen, setIsGitSyncModalOpen] = useState(false)
    const [closePrompt, setClosePrompt] = useState<GitRepoStatus | null>(null)
    const [closeBusy, setCloseBusy] = useState(false)
    const [openPullPrompt, setOpenPullPrompt] = useState<GitRepoStatus | null>(null)
    const [openPullBusy, setOpenPullBusy] = useState(false)
    const [leftSidebarOpen, setLeftSidebarOpen] = useState(() => {
        try {
            return localStorage.getItem('manga-yarou-left-sidebar') !== 'false'
        } catch {
            return true
        }
    })

    useEffect(() => {
        try {
            localStorage.setItem('manga-yarou-left-sidebar', leftSidebarOpen ? 'true' : 'false')
        } catch {
            /* ignore */
        }
    }, [leftSidebarOpen])

    const currentPage = pages.find(p => p.id === currentPageId)
    const autoSaveTimerRef = useRef<number | null>(null)
    const saveStatusLabel = saveError
        ? '保存エラー'
        : isSaving
          ? '保存中...'
          : lastSavedAt
            ? `保存済み ${new Date(lastSavedAt).toLocaleTimeString()}`
            : '未保存'

    const selectedPanel = currentPage?.panels.find(p => p.id === selectedPanelId)
    const selectedBubble = currentPage?.bubbles.find(b => b.id === selectedBubbleId)
    const selectedMaterial = currentPage?.materials.find(m => m.id === selectedMaterialId)

    // Bridge for terminal logging
    useEffect(() => {
        if (window.electron && window.electron.log) {
            const originalError = console.error
            console.error = (...args: any[]) => {
                window.electron.log('error', ...args)
                originalError.apply(console, args)
            }
            const originalWarn = console.warn
            console.warn = (...args: any[]) => {
                window.electron.log('warn', ...args)
                originalWarn.apply(console, args)
            }

            const handleError = (event: ErrorEvent) => {
                window.electron.log('error', 'Uncaught Error:', event.error?.message, event.error?.stack)
            }
            const handleRejection = (event: PromiseRejectionEvent) => {
                window.electron.log('error', 'Unhandled Rejection:', event.reason?.message, event.reason?.stack)
            }

            window.addEventListener('error', handleError)
            window.addEventListener('unhandledrejection', handleRejection)

            return () => {
                window.removeEventListener('error', handleError)
                window.removeEventListener('unhandledrejection', handleRejection)
                console.error = originalError
                console.warn = originalWarn
            }
        }
    }, [])

    // Initial load
    useEffect(() => {
        loadTemplates()
        loadCustomTones()
        loadNovelAIToken()
    }, [])

    // Auto-save logic
    useEffect(() => {
        if (currentProjectPath && (pages.length > 0 || archivedPages.length > 0)) {
            if (autoSaveTimerRef.current !== null) {
                window.clearTimeout(autoSaveTimerRef.current)
            }
            autoSaveTimerRef.current = window.setTimeout(async () => {
                saveProject()
                autoSaveTimerRef.current = null
            }, 1000)
        }
        return () => {
            if (autoSaveTimerRef.current !== null) {
                window.clearTimeout(autoSaveTimerRef.current)
                autoSaveTimerRef.current = null
            }
        }
    }, [pages, archivedPages, currentProjectPath, referenceCharacters, backgroundLibrary, manuscript])

    // Flush pending debounce save to avoid data loss on app close.
    useEffect(() => {
        const flushPendingSaveOnUnload = () => {
            if (!currentProjectPath || !window.electron?.saveProjectSync) return
            if (autoSaveTimerRef.current !== null) {
                window.clearTimeout(autoSaveTimerRef.current)
                autoSaveTimerRef.current = null
            }
            try {
                window.electron.saveProjectSync(currentProjectPath, getProjectData())
            } catch (error) {
                console.error('App: failed to flush save on unload', error)
            }
        }
        window.addEventListener('beforeunload', flushPendingSaveOnUnload)
        return () => {
            window.removeEventListener('beforeunload', flushPendingSaveOnUnload)
        }
    }, [currentProjectPath, getProjectData])

    // 閉じる時: 未同期の変更があれば「同期しますか？」を確認
    useEffect(() => {
        if (!window.electron?.onAppBeforeClose) return
        const off = window.electron.onAppBeforeClose(async () => {
            const state = useMangaStore.getState()
            const path = state.currentProjectPath
            // 未保存分をディスクへ反映してから git 状態を見る
            try {
                if (path && window.electron?.saveProjectSync) {
                    window.electron.saveProjectSync(path, state.getProjectData())
                }
            } catch {
                /* noop */
            }
            if (!path || !window.electron) {
                window.electron?.confirmAppClose()
                return
            }
            try {
                const st = await window.electron.gitRepoStatus(path)
                if (!st.isRepo || (st.dirty === 0 && st.ahead === 0)) {
                    window.electron.confirmAppClose()
                    return
                }
                setClosePrompt(st)
            } catch {
                window.electron.confirmAppClose()
            }
        })
        return off
    }, [])

    // プロジェクトを開いた時: リモートを確認し、新しい変更があればプルを案内
    useEffect(() => {
        const path = currentProjectPath
        if (!path || !window.electron?.gitFetchStatus) return
        let cancelled = false
        void (async () => {
            try {
                const { status } = await window.electron.gitFetchStatus(path)
                if (cancelled) return
                if (status.isRepo && status.behind > 0) setOpenPullPrompt(status)
            } catch {
                /* オフライン等は黙ってスキップ */
            }
        })()
        return () => {
            cancelled = true
        }
    }, [currentProjectPath])

    // 「最後に見ていたページ」を端末ローカルへ保存（manga.json/同期は汚さない）
    useEffect(() => {
        if (!currentProjectPath || !currentPageId) return
        try {
            localStorage.setItem(lastPageKey(currentProjectPath), currentPageId)
        } catch {
            /* localStorage 不可なら無視 */
        }
    }, [currentPageId, currentProjectPath])

    const handleOpenPull = async () => {
        const path = useMangaStore.getState().currentProjectPath
        if (!path || !window.electron) return
        setOpenPullBusy(true)
        try {
            const res = await window.electron.gitPull(path)
            if (res.ok) {
                await openProjectByPath(path)
                setOpenPullPrompt(null)
            } else {
                await showError('プルに失敗しました:\n\n' + res.log)
            }
        } catch (e) {
            await showError('プルに失敗しました:\n' + (e instanceof Error ? e.message : String(e)))
        } finally {
            setOpenPullBusy(false)
        }
    }

    const handleCloseSync = async () => {
        const path = useMangaStore.getState().currentProjectPath
        if (!path || !window.electron) return
        setCloseBusy(true)
        try {
            const res = await window.electron.gitPush(path, '')
            if (res.ok) {
                window.electron.confirmAppClose()
            } else {
                setCloseBusy(false)
                await showError('同期(プッシュ)に失敗しました。同期せずに閉じることもできます:\n\n' + res.log)
            }
        } catch (e) {
            setCloseBusy(false)
            await showError('同期に失敗しました:\n' + (e instanceof Error ? e.message : String(e)))
        }
    }

    const handleAddPanelWithType = (type: PanelType) => {
        const pageWidth = currentPage?.pageWidth ?? 840
        let slant = 0, offsetB = 0, offsetC = 0, offsetD = 0
        let width = standardPanelWidth(pageWidth)
        let height = PANEL_STANDARD_HEIGHT
        if (type === 'slanted') slant = 40
        if (type === 'trapezoid-h') { slant = 20; offsetB = -20; offsetC = 0; offsetD = 0; }
        if (type === 'trapezoid-v') { slant = 0; offsetD = 20; offsetC = -20; offsetB = 0; }
        if (type === 'hexagon') { width = 200; height = Math.round(200 * Math.sqrt(3) / 2) }
        if (type === 'circle') { width = 180; height = 180 }

        const placement = computePanelInsertion(currentPage, type, width, height)

        addPanel({
            x: placement.x, y: placement.y, type,
            slant, offsetB, offsetC, offsetD,
            width: placement.width, height: placement.height
        })
    }

    const handleAddBubbleWithType = (type: BubbleType) => {
        if (!selectedPanel) return
        const centerX = selectedPanel.x + selectedPanel.width / 2
        const centerY = selectedPanel.y + selectedPanel.height / 2

        let text: string | undefined
        const sel = manuscriptSelection
        if (sel && sel.end > sel.start) {
            const picked = manuscript.slice(sel.start, sel.end).trim()
            if (picked) {
                text = picked
                removeManuscriptRange(sel.start, sel.end)
            }
        }

        addBubble({
            type,
            x: centerX - 75,
            y: centerY - 50,
            panelId: selectedPanel.id,
            isClipped: false,
            ...(text ? { text } : {})
        })
    }

    return (
        <div className="flex h-screen bg-zinc-950 text-zinc-300 overflow-hidden font-sans">
            <div
                className={`shrink-0 overflow-hidden bg-zinc-900 border-r border-zinc-800 transition-[width] duration-200 ease-in-out ${
                    leftSidebarOpen ? 'w-64' : 'w-0 border-r-0'
                }`}
            >
                <div className="w-64 h-full min-h-0 flex flex-col">
                    <SidebarLeft
                        onExportPNG={(format) => handleExportPNG(format)}
                        onExportAllPagesPNG={(format) => handleExportAllPagesPNG({ format })}
                        onExportAllPagesPNGNoMosaic={(format) => handleExportAllPagesPNG({ hideMosaic: true, format })}
                        onExportText={handleExportText}
                        onOpenTemplateModal={() => setIsTemplateModalOpen(true)}
                        handleCreateNew={handleCreateNew}
                        handleOpenProject={handleOpenProject}
                        currentProjectPath={currentProjectPath}
                        currentPageId={currentPageId}
                        pages={pages}
                        selectPage={selectPage}
                        movePage={movePage}
                        removePage={removePage}
                        addPage={addPage}
                        onCollapse={() => setLeftSidebarOpen(false)}
                    />
                </div>
            </div>

            {!leftSidebarOpen && (
                <button
                    type="button"
                    className="fixed left-0 top-1/2 z-50 -translate-y-1/2 py-8 pl-1 pr-1.5 rounded-r-md bg-zinc-800/95 border border-zinc-700 border-l-0 text-zinc-400 hover:bg-zinc-700 hover:text-white shadow-lg"
                    onClick={() => setLeftSidebarOpen(true)}
                    title="ページ一覧・メニューを表示"
                >
                    <PanelLeft size={20} strokeWidth={2} />
                </button>
            )}

            <div className="flex-1 flex flex-col min-w-0">
                <div className="h-14 bg-zinc-900 border-b border-zinc-800 flex items-center px-3 sm:px-6 justify-between shrink-0 min-w-0 gap-2 overflow-x-auto">
                    <div className="flex items-center gap-2 min-w-0">
                        {currentProjectPath && <ModeToggle />}
                        {currentProjectPath && (
                            <button
                                type="button"
                                onClick={() => setIsTranslationModalOpen(true)}
                                title="翻訳版を作成"
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm bg-zinc-800/60 border border-zinc-800 text-zinc-400 hover:text-white shrink-0"
                            >
                                <Languages size={16} />
                                <span className="hidden md:inline">翻訳版</span>
                            </button>
                        )}
                        {currentProjectPath && (
                            <button
                                type="button"
                                onClick={() => setIsGitSyncModalOpen(true)}
                                title="同期（Git / LFS）"
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm bg-zinc-800/60 border border-zinc-800 text-zinc-400 hover:text-white shrink-0"
                            >
                                <GitBranch size={16} />
                                <span className="hidden md:inline">同期</span>
                            </button>
                        )}
                        {currentPageId && (
                            <>
                                <div className="flex bg-zinc-800/50 p-1 rounded-lg border border-zinc-800">
                                    <button onClick={() => handleAddPanelWithType('rect')} className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white transition-all flex items-center justify-center px-3" title="矩形">
                                        <PanelTypeIcon type="rect" size={16} />
                                    </button>
                                    <button onClick={() => handleAddPanelWithType('slanted')} className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white transition-all flex items-center justify-center px-3" title="斜め">
                                        <PanelTypeIcon type="slanted" size={16} />
                                    </button>
                                    <button onClick={() => handleAddPanelWithType('trapezoid-h')} className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white transition-all flex items-center justify-center px-3" title="台形（横）">
                                        <PanelTypeIcon type="trapezoid-h" size={16} />
                                    </button>
                                    <button onClick={() => handleAddPanelWithType('trapezoid-v')} className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white transition-all flex items-center justify-center px-3" title="台形（縦）">
                                        <PanelTypeIcon type="trapezoid-v" size={16} />
                                    </button>
                                    <button onClick={() => handleAddPanelWithType('pentagon')} className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white transition-all flex items-center justify-center px-3" title="正五角形">
                                        <PanelTypeIcon type="pentagon" size={16} />
                                    </button>
                                    <button onClick={() => handleAddPanelWithType('hexagon')} className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white transition-all flex items-center justify-center px-3" title="正六角形">
                                        <PanelTypeIcon type="hexagon" size={16} />
                                    </button>
                                    <button onClick={() => handleAddPanelWithType('circle')} className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white transition-all flex items-center justify-center px-3" title="円">
                                        <PanelTypeIcon type="circle" size={16} />
                                    </button>
                                </div>
                                <div className="flex bg-zinc-800/50 p-1 rounded-lg border border-zinc-800 ml-4">
                                    {BUBBLE_TYPE_ORDER.map((type) => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => handleAddBubbleWithType(type)}
                                            disabled={!selectedPanelId}
                                            title={BUBBLE_TYPE_LABELS[type]}
                                            className={`p-1.5 rounded transition-all flex items-center justify-center min-w-[32px] ${
                                                selectedPanelId ? 'hover:bg-zinc-700 text-zinc-400 hover:text-white' : 'text-zinc-700 cursor-not-allowed'
                                            }`}
                                        >
                                            <BubbleTypeIcon type={type} size={14} />
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                    {currentProjectPath && (
                        <div className={`text-xs whitespace-nowrap ${saveError ? 'text-red-400' : 'text-zinc-500'}`}>
                            {saveStatusLabel}
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-auto bg-zinc-950 relative manga-scrollbar">
                    {currentPageId ? <Canvas stageRef={stageRef} /> : (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-800">
                            <PanelTop size={64} className="mb-4 opacity-10" />
                            <p className="text-sm font-medium opacity-40">ページを選択して編集を開始してください</p>
                        </div>
                    )}
                </div>

                {currentProjectPath && <ManuscriptPanel />}
            </div>

            <SidebarRight />

            <TemplateModal
                isOpen={isTemplateModalOpen}
                onClose={() => setIsTemplateModalOpen(false)}
                onCreateNew={handleCreateNew}
                onOpenProject={handleOpenProject}
                onSelectTemplate={(id) => {
                    handleUseTemplate(id)
                    setIsTemplateModalOpen(false)
                }}
                onSaveCurrentAsTemplate={handleSaveAsTemplate}
            />

            <ExportOverlay isExporting={isExporting} />

            <NovelAIGenerationModal />

            <PanelWandEditor />

            <ScriptEditor />

            <TranslationModal
                isOpen={isTranslationModalOpen}
                onClose={() => setIsTranslationModalOpen(false)}
                onOpenProject={openProjectByPath}
            />

            <GitSyncModal
                isOpen={isGitSyncModalOpen}
                onClose={() => setIsGitSyncModalOpen(false)}
                onReloadProject={openProjectByPath}
            />

            {closePrompt && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4">
                    <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-5">
                        <div className="flex items-center gap-2 text-white mb-2">
                            <GitBranch size={18} className="text-amber-400" />
                            <h2 className="text-base font-semibold">変更があります</h2>
                        </div>
                        <p className="text-sm text-zinc-400 leading-relaxed mb-1">
                            この作品にまだ同期していない変更があります。閉じる前に同期（プッシュ）しますか？
                        </p>
                        <div className="text-xs text-zinc-500 mb-4">
                            未コミット {closePrompt.dirty} 件 / 未プッシュ {closePrompt.ahead} コミット
                        </div>
                        <div className="flex flex-col gap-2">
                            <button
                                type="button"
                                onClick={handleCloseSync}
                                disabled={closeBusy}
                                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40"
                            >
                                {closeBusy ? '同期中…' : '同期して閉じる'}
                            </button>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => window.electron?.confirmAppClose()}
                                    disabled={closeBusy}
                                    className="flex-1 px-3 py-2 rounded-md text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 disabled:opacity-40"
                                >
                                    同期せず閉じる
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setClosePrompt(null)}
                                    disabled={closeBusy}
                                    className="flex-1 px-3 py-2 rounded-md text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 disabled:opacity-40"
                                >
                                    キャンセル
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {openPullPrompt && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4">
                    <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-5">
                        <div className="flex items-center gap-2 text-white mb-2">
                            <GitBranch size={18} className="text-indigo-400" />
                            <h2 className="text-base font-semibold">新しい変更があります</h2>
                        </div>
                        <p className="text-sm text-zinc-400 leading-relaxed mb-1">
                            リモートに、この作品のより新しいバージョンがあります。取り込み（プル）しますか？
                        </p>
                        <div className="text-xs text-zinc-500 mb-4">
                            未取得 {openPullPrompt.behind} コミット
                            {openPullPrompt.ahead > 0 && ` / ローカル未プッシュ ${openPullPrompt.ahead} コミット`}
                        </div>
                        {openPullPrompt.ahead > 0 && (
                            <div className="flex items-start gap-1.5 text-xs text-amber-400 mb-3">
                                <GitBranch size={13} className="mt-0.5 shrink-0" />
                                こちらにも未プッシュの変更があります。プルは rebase で取り込みます。
                            </div>
                        )}
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={handleOpenPull}
                                disabled={openPullBusy}
                                className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40"
                            >
                                {openPullBusy ? '取り込み中…' : 'プルする'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setOpenPullPrompt(null)}
                                disabled={openPullBusy}
                                className="flex-1 px-3 py-2 rounded-md text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 disabled:opacity-40"
                            >
                                あとで
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default App
