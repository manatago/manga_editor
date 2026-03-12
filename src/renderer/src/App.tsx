import React, { useState, useEffect } from 'react'
import Canvas from './components/Canvas'
import SidebarLeft from './components/SidebarLeft'
import SidebarRight from './components/SidebarRight'
import { TemplateModal } from './components/TemplateModal'
import { ExportOverlay } from './components/ExportOverlay'
import { useMangaStore, PanelType } from './store/useMangaStore'
import { PanelTop, Square, AlignLeft, Table, Columns, MessageSquare, Zap } from 'lucide-react'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useProjectActions } from './hooks/useProjectActions'
import { useExport } from './hooks/useExport'

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
        isExporting
    } = useMangaStore()

    // Custom Hooks
    useKeyboardShortcuts()
    const { handleCreateNew, handleOpenProject, handleUseTemplate, handleSaveAsTemplate } = useProjectActions()
    const { stageRef, handleExportPNG } = useExport()

    // Local UI State
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)

    const currentPage = pages.find(p => p.id === currentPageId)
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
    }, [])

    // Auto-save logic
    useEffect(() => {
        if (currentProjectPath && pages.length > 0) {
            const timeout = setTimeout(async () => {
                saveProject()
            }, 1000)
            return () => clearTimeout(timeout)
        }
    }, [pages, currentProjectPath])

    const handleAddPanelWithType = (type: PanelType) => {
        let slant = 0, offsetB = 0, offsetC = 0, offsetD = 0
        if (type === 'slanted') slant = 40
        if (type === 'trapezoid-h') { slant = 20; offsetB = -20; offsetC = 0; offsetD = 0; }
        if (type === 'trapezoid-v') { slant = 0; offsetD = 20; offsetC = -20; offsetB = 0; }

        addPanel({
            x: 100, y: 100, type, slant, offsetB, offsetC, offsetD
        })
    }

    return (
        <div className="flex h-screen bg-zinc-950 text-zinc-300 overflow-hidden font-sans">
            <SidebarLeft
                onExportPNG={handleExportPNG}
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
            />

            <div className="flex-1 flex flex-col min-w-0">
                <div className="h-14 bg-zinc-900 border-b border-zinc-800 flex items-center px-6 justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        {currentPageId && (
                            <>
                                <div className="flex bg-zinc-800/50 p-1 rounded-lg border border-zinc-800">
                                    <button onClick={() => handleAddPanelWithType('rect')} className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white transition-all flex items-center gap-2 px-3">
                                        <Square size={14} />
                                        <span className="text-xs font-medium">矩形</span>
                                    </button>
                                    <button onClick={() => handleAddPanelWithType('slanted')} className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white transition-all flex items-center gap-2 px-3">
                                        <AlignLeft size={14} className="skew-x-12" />
                                        <span className="text-xs font-medium">斜め</span>
                                    </button>
                                    <button onClick={() => handleAddPanelWithType('trapezoid-h')} className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white transition-all flex items-center gap-2 px-3">
                                        <Table size={14} />
                                        <span className="text-xs font-medium">台形(横)</span>
                                    </button>
                                    <button onClick={() => handleAddPanelWithType('trapezoid-v')} className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white transition-all flex items-center gap-2 px-3">
                                        <Columns size={14} />
                                        <span className="text-xs font-medium">台形(縦)</span>
                                    </button>
                                </div>
                                <div className="flex bg-zinc-800/50 p-1 rounded-lg border border-zinc-800 ml-4">
                                    <button onClick={() => addBubble({ type: 'rounded' })} className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white transition-all flex items-center gap-2 px-3">
                                        <MessageSquare size={14} />
                                        <span className="text-xs font-medium">普通</span>
                                    </button>
                                    <button onClick={() => addBubble({ type: 'jagged' })} className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white transition-all flex items-center gap-2 px-3">
                                        <Zap size={14} />
                                        <span className="text-xs font-medium">ギザギザ</span>
                                    </button>
                                    <button onClick={() => addBubble({ type: 'rect' })} className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white transition-all flex items-center gap-2 px-3">
                                        <Square size={14} />
                                        <span className="text-xs font-medium">矩形</span>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-auto bg-zinc-950 relative">
                    {currentPageId ? <Canvas stageRef={stageRef} /> : (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-800">
                            <PanelTop size={64} className="mb-4 opacity-10" />
                            <p className="text-sm font-medium opacity-40">ページを選択して編集を開始してください</p>
                        </div>
                    )}
                </div>
            </div>

            <SidebarRight
                currentPageId={currentPageId}
                selectedPanel={selectedPanel}
                removePanel={removePanel}
                updatePanel={updatePanel}
                selectedBubble={selectedBubble}
                removeBubble={removeBubble}
                updateBubble={updateBubble}
                currentPage={currentPage}
                updatePage={updatePage}
                addBubble={addBubble}
                currentProjectPath={currentProjectPath}
                selectedMaterial={selectedMaterial}
                removeMaterial={removeMaterial}
                updateMaterial={updateMaterial}
                addMaterial={addMaterial}
            />

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
        </div>
    )
}

export default App
