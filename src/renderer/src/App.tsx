import React, { useState, useEffect, useRef } from 'react'
import Canvas from './components/Canvas'
import SidebarLeft from './components/SidebarLeft'
import SidebarRight from './components/SidebarRight'
import { TemplateModal } from './components/TemplateModal'
import { ExportOverlay } from './components/ExportOverlay'
import { NovelAIGenerationModal } from './components/NovelAIGenerationModal'
import { useMangaStore, PanelType, type BubbleType } from './store/useMangaStore'
import { PanelTop, PanelLeft } from 'lucide-react'
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
        backgroundLibrary
    } = useMangaStore()

    // Custom Hooks
    useKeyboardShortcuts()
    const { handleCreateNew, handleOpenProject, handleUseTemplate, handleSaveAsTemplate } = useProjectActions()
    const { stageRef, handleExportPNG, handleExportAllPagesPNG, handleExportText } = useExport()

    // Local UI State
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
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
        if (currentProjectPath && pages.length > 0) {
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
    }, [pages, currentProjectPath, referenceCharacters, backgroundLibrary])

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

    const handleAddPanelWithType = (type: PanelType) => {
        let slant = 0, offsetB = 0, offsetC = 0, offsetD = 0
        let width = 200, height = 150
        if (type === 'slanted') slant = 40
        if (type === 'trapezoid-h') { slant = 20; offsetB = -20; offsetC = 0; offsetD = 0; }
        if (type === 'trapezoid-v') { slant = 0; offsetD = 20; offsetC = -20; offsetB = 0; }
        if (type === 'hexagon') { width = 200; height = Math.round(200 * Math.sqrt(3) / 2) }
        if (type === 'circle') { width = 180; height = 180 }

        addPanel({
            x: 100, y: 100, type, slant, offsetB, offsetC, offsetD, width, height
        })
    }

    const handleAddBubbleWithType = (type: BubbleType) => {
        if (!selectedPanel) return
        const centerX = selectedPanel.x + selectedPanel.width / 2
        const centerY = selectedPanel.y + selectedPanel.height / 2
        addBubble({
            type,
            x: centerX - 75,
            y: centerY - 50,
            panelId: selectedPanel.id,
            isClipped: false
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
                        onExportPNG={handleExportPNG}
                        onExportAllPagesPNG={handleExportAllPagesPNG}
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
        </div>
    )
}

export default App
