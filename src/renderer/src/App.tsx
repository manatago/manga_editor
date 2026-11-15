import React, { useState, useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import Canvas from './components/Canvas'
import { CanvasViewport } from './components/Canvas/CanvasViewport'
import { ShortcutHelp, ShortcutHelpButton } from './components/ShortcutHelp'
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
import { ReferencePagesModal } from './components/ReferencePagesModal/ReferencePagesModal'
import { AppSettingsModal } from './components/AppSettingsModal'
import { NovelAISettingsModal } from './components/NovelAISettingsModal'
import { useMangaStore, PanelType, type BubbleType } from './store/useMangaStore'
import { lastPageKey } from './store/slices/projectSlice'
import {
    PANEL_STANDARD_HEIGHT,
    standardPanelWidth,
    computePanelInsertion
} from './utils/panelInsertion'
import { PanelTop, PanelLeft, Languages, GitBranch, BookOpen, Check, Loader2, AlertCircle, Circle, MoreHorizontal } from 'lucide-react'
import { showError } from './utils/dialogs'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useAutoSave } from './hooks/useAutoSave'
import { useProjectActions } from './hooks/useProjectActions'
import { useExport } from './hooks/useExport'
import { PanelTypeIcon } from './components/icons/PanelTypeIcon'
import { BubbleTypeIcon } from './components/icons/BubbleTypeIcon'
import { BUBBLE_TYPE_LABELS, BUBBLE_TYPE_ORDER } from './components/icons/bubbleTypeMeta'

/** 上部バーのコマ追加ボタン（表示順） */
const PANEL_ADD_BUTTONS: ReadonlyArray<{ type: PanelType; title: string }> = [
    { type: 'rect', title: '矩形' },
    { type: 'slanted', title: '斜め' },
    { type: 'trapezoid-h', title: '台形（横）' },
    { type: 'trapezoid-v', title: '台形（縦）' },
    { type: 'pentagon', title: '正五角形' },
    { type: 'hexagon', title: '正六角形' },
    { type: 'circle', title: '円' }
]

function App(): React.JSX.Element {
    // App は描画に必要な最小限だけを購読する。ページ内容（pages 等）は購読しない：
    // 購読すると編集のたびに App 全体（＝ほぼ全 UI）が再描画される。
    // ハンドラ内で必要な値はその時点の getState() から読む。
    const {
        currentProjectPath,
        currentPageId,
        selectedPanelId,
        scriptEditorOpen,
        isExporting,
        isSaving,
        lastSavedAt,
        saveError,
        addPanel,
        addBubble,
        removeManuscriptRange
    } = useMangaStore(
        useShallow((s) => ({
            currentProjectPath: s.currentProjectPath,
            currentPageId: s.currentPageId,
            selectedPanelId: s.selectedPanelId,
            scriptEditorOpen: s.scriptEditorOpen,
            isExporting: s.isExporting,
            isSaving: s.isSaving,
            lastSavedAt: s.lastSavedAt,
            saveError: s.saveError,
            addPanel: s.addPanel,
            addBubble: s.addBubble,
            removeManuscriptRange: s.removeManuscriptRange
        }))
    )

    // Custom Hooks
    useKeyboardShortcuts()
    useAutoSave()
    const { handleCreateNew, handleOpenProject, openProjectByPath, handleUseTemplate, handleSaveAsTemplate } = useProjectActions()
    const { stageRef, handleExportPNG, handleExportAllPagesPNG, handleExportAllPagesPDF, handleExportText } = useExport()

    // Local UI State
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
    const [isTranslationModalOpen, setIsTranslationModalOpen] = useState(false)
    const [isGitSyncModalOpen, setIsGitSyncModalOpen] = useState(false)
    const [isReferencePagesOpen, setIsReferencePagesOpen] = useState(false)
    const [isAppSettingsOpen, setIsAppSettingsOpen] = useState(false)
    const [isNovelaiSettingsOpen, setIsNovelaiSettingsOpen] = useState(false)
    const [projectMenuOpen, setProjectMenuOpen] = useState(false)
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

    const saveStatusLabel = saveError
        ? '保存エラー'
        : isSaving
          ? '保存中...'
          : lastSavedAt
            ? `保存済み ${new Date(lastSavedAt).toLocaleTimeString()}`
            : '未保存'


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
        const { loadTemplates, loadCustomTones, loadNovelAIToken } = useMangaStore.getState()
        loadTemplates()
        loadCustomTones()
        loadNovelAIToken()
    }, [])

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
        const { pages, currentPageId } = useMangaStore.getState()
        const currentPage = pages.find((p) => p.id === currentPageId)
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
        const { pages, currentPageId, selectedPanelId, manuscript, manuscriptSelection } = useMangaStore.getState()
        const selectedPanel = pages
            .find((p) => p.id === currentPageId)
            ?.panels.find((p) => p.id === selectedPanelId)
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
                        onExportAllPagesPDF={(format, hideMosaic) => handleExportAllPagesPDF({ format, hideMosaic })}
                        onExportText={handleExportText}
                        onOpenTemplateModal={() => setIsTemplateModalOpen(true)}
                        handleCreateNew={handleCreateNew}
                        handleOpenProject={handleOpenProject}
                        currentProjectPath={currentProjectPath}
                        onCollapse={() => setLeftSidebarOpen(false)}
                    />
                </div>
            </div>

            {!leftSidebarOpen && (
                <button
                    type="button"
                    className="fixed left-0 top-1/2 z-50 -translate-y-1/2 py-8 pl-1 pr-1.5 rounded-r-md bg-zinc-800/95 border border-zinc-700 border-l-0 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-50 shadow-lg"
                    onClick={() => setLeftSidebarOpen(true)}
                    title="ページ一覧・メニューを表示"
                >
                    <PanelLeft size={20} strokeWidth={2} />
                </button>
            )}

            <div className="flex-1 flex flex-col min-w-0">
                {/* 画面が狭い（縦置きモニタ / 小さな MacBook Air 等）ときは横スクロールさせず、
                    ツール群を次の段へ折り返す。min-h で段数に応じて高さが伸びる。 */}
                <div className="min-h-14 bg-zinc-900 border-b border-zinc-800 flex items-center px-3 sm:px-6 py-1.5 justify-between shrink-0 min-w-0 gap-3">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 min-w-0 flex-1">
                        {currentProjectPath && <ModeToggle />}
                        {/* 作画モードのときだけ作図ツール（コマ形・吹き出し形）を出す。台本モードでは不要なので隠す */}
                        {currentPageId && !scriptEditorOpen && (
                            <>
                                <div className="flex shrink-0 bg-zinc-800/50 p-1 rounded-lg border border-zinc-800">
                                    {PANEL_ADD_BUTTONS.map(({ type, title }) => (
                                        <button key={type} onClick={() => handleAddPanelWithType(type)} className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-zinc-50 transition-all flex items-center justify-center px-3" title={title}>
                                            <PanelTypeIcon type={type} size={16} />
                                        </button>
                                    ))}
                                </div>
                                <div className="flex shrink-0 bg-zinc-800/50 p-1 rounded-lg border border-zinc-800 ml-1 lg:ml-4">
                                    {BUBBLE_TYPE_ORDER.map((type) => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => handleAddBubbleWithType(type)}
                                            disabled={!selectedPanelId}
                                            title={BUBBLE_TYPE_LABELS[type]}
                                            className={`p-1.5 rounded transition-all flex items-center justify-center min-w-[32px] ${
                                                selectedPanelId ? 'hover:bg-zinc-700 text-zinc-400 hover:text-zinc-50' : 'text-zinc-700 cursor-not-allowed'
                                            }`}
                                        >
                                            <BubbleTypeIcon type={type} size={14} />
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                    {currentProjectPath && (
                        <>
                            {/* 同期はよく使う＆状態を持つので単独で残す */}
                            <button
                                type="button"
                                onClick={() => setIsGitSyncModalOpen(true)}
                                title="同期（Git / LFS）"
                                className="flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-800/60 border border-zinc-800 text-zinc-400 hover:text-zinc-50 shrink-0"
                            >
                                <GitBranch size={16} />
                            </button>
                            {/* 翻訳版・参考資料はたまに使うのでオーバーフローにまとめる */}
                            <div className="relative shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setProjectMenuOpen((v) => !v)}
                                    title="その他（翻訳版・参考資料）"
                                    className="flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-800/60 border border-zinc-800 text-zinc-400 hover:text-zinc-50"
                                >
                                    <MoreHorizontal size={16} />
                                </button>
                                {projectMenuOpen && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setProjectMenuOpen(false)} />
                                        <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl p-1">
                                            <button
                                                type="button"
                                                onClick={() => { setProjectMenuOpen(false); setIsTranslationModalOpen(true) }}
                                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50"
                                            >
                                                <Languages size={16} /> 翻訳版を作成
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => { setProjectMenuOpen(false); setIsReferencePagesOpen(true) }}
                                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50"
                                            >
                                                <BookOpen size={16} /> 参考資料
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </>
                    )}
                    {/* 設定は Properties 見出しの歯車に一本化（重複回避） */}
                    <ShortcutHelpButton />
                    {currentProjectPath && (
                        <div
                            className={`flex items-center gap-1.5 shrink-0 text-xs whitespace-nowrap ${saveError ? 'text-red-400' : 'text-zinc-500'}`}
                            title={saveStatusLabel}
                        >
                            {saveError ? (
                                <AlertCircle size={14} />
                            ) : isSaving ? (
                                <Loader2 size={14} className="animate-spin" />
                            ) : lastSavedAt ? (
                                <Check size={14} />
                            ) : (
                                <Circle size={14} />
                            )}
                            <span className={saveError ? '' : 'hidden xl:inline'}>{saveStatusLabel}</span>
                        </div>
                    )}
                    </div>
                </div>

                <CanvasViewport>
                    {currentPageId ? <Canvas stageRef={stageRef} /> : (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-800">
                            <PanelTop size={64} className="mb-4 opacity-10" />
                            <p className="text-sm font-medium opacity-40">ページを選択して編集を開始してください</p>
                        </div>
                    )}
                </CanvasViewport>

                {currentProjectPath && <ManuscriptPanel />}
            </div>

            <SidebarRight onOpenSettings={() => setIsAppSettingsOpen(true)} />

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

            <ShortcutHelp />

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

            <ReferencePagesModal
                isOpen={isReferencePagesOpen}
                onClose={() => setIsReferencePagesOpen(false)}
            />

            <AppSettingsModal
                isOpen={isAppSettingsOpen}
                onClose={() => setIsAppSettingsOpen(false)}
                onOpenGitSync={() => setIsGitSyncModalOpen(true)}
                onOpenNovelai={() => setIsNovelaiSettingsOpen(true)}
            />

            <NovelAISettingsModal
                isOpen={isNovelaiSettingsOpen}
                onClose={() => setIsNovelaiSettingsOpen(false)}
            />

            {closePrompt && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4">
                    <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-5">
                        <div className="flex items-center gap-2 text-zinc-50 mb-2">
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
                        <div className="flex items-center gap-2 text-zinc-50 mb-2">
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
