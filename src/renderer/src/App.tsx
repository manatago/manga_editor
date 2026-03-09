import React, { useState, useEffect, useRef } from 'react'
import Canvas from './components/Canvas'
import { useMangaStore, PanelType } from './store/useMangaStore'
import { Plus, FolderOpen, PanelTop, Square, AlignLeft, Table, Columns, Layers, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ChevronUp, ChevronDown, Trash2, Layout, BookTemplate, Save, MessageSquare, Type, Palette, Maximize, Ghost, Zap, Circle, Move, MoveUp, MoveDown, ArrowUpToLine, ArrowDownToLine, Image as ImageIcon, Download } from 'lucide-react'
import { FadeDirection } from './store/useMangaStore'

const DirectionButton: React.FC<{
    dir: FadeDirection;
    icon: React.ReactNode;
    current: FadeDirection | undefined;
    onSelect: (dir: FadeDirection) => void;
}> = ({ dir, icon, current, onSelect }) => (
    <button
        onClick={() => onSelect(dir)}
        title={dir === 'none' ? 'None' : dir.charAt(0).toUpperCase() + dir.slice(1)}
        className={`w-full aspect-square flex items-center justify-center rounded border transition-all ${current === dir ? 'bg-blue-600 border-blue-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'}`}
    >
        {icon}
    </button>
)

function App(): React.JSX.Element {
    const {
        currentProjectPath,
        setCurrentProject,
        setProjectData,
        pages,
        currentPageId,
        selectedPanelId,
        setSelectedPanel,
        selectedBubbleId,
        setSelectedBubble,
        addPage,
        selectPage,
        updatePage,
        addPanel,
        updatePanel,
        removePanel,
        addBubble,
        updateBubble,
        removeBubble,
        reorderPanel,
        movePage,
        templates,
        loadTemplates,
        saveAsTemplate,
        undo,
        redo,
        saveProject
    } = useMangaStore()

    console.log('App: Rendering. currentProjectPath:', currentProjectPath, 'pages count:', pages.length, 'currentPageId:', currentPageId)

    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
    const [isSavingTemplate, setIsSavingTemplate] = useState(false)
    const [templateName, setTemplateName] = useState('')
    const stageRef = useRef<any>(null)

    const handleExportPNG = async () => {
        if (!stageRef.current || !currentPageId || !currentProjectPath) return

        const { setExporting } = useMangaStore.getState()
        setExporting(true)

        // Give React a moment to hide the transformers
        setTimeout(async () => {
            try {
                const dataUrl = stageRef.current.toDataURL({
                    pixelRatio: 2 // High quality export
                })
                const pageName = pages.find(p => p.id === currentPageId)?.name || 'page'
                await window.electron.exportPNG(currentProjectPath, pageName, dataUrl)
                console.log('App: PNG exported successfully')
            } catch (error) {
                console.error('App: export failed', error)
                alert('エクスポートに失敗しました')
            } finally {
                setExporting(false)
            }
        }, 100)
    }

    // Handle global keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in an input field
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }

            if (e.key === 'Backspace' || e.key === 'Delete') {
                if (selectedPanelId) {
                    removePanel(selectedPanelId);
                } else if (selectedBubbleId) {
                    removeBubble(selectedBubbleId);
                }
            }

            // Undo / Redo
            if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'z') {
                e.preventDefault();
                undo();
            } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z') {
                e.preventDefault();
                redo();
            } else if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
                e.preventDefault();
                redo();
            }

            // Save
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                saveProject();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedPanelId, selectedBubbleId, removePanel, removeBubble, undo, redo, saveProject]);

    // Load templates on mount
    useEffect(() => {
        console.log('App: Initial load templates')
        loadTemplates()
    }, [])

    const currentPage = pages.find(p => p.id === currentPageId)
    const selectedPanel = currentPage?.panels.find(p => p.id === selectedPanelId)
    const selectedBubble = currentPage?.bubbles.find(b => b.id === selectedBubbleId)

    // Auto-save
    useEffect(() => {
        if (currentProjectPath && pages.length > 0) {
            console.log('App: Auto-save triggered')
            const timeout = setTimeout(async () => {
                try {
                    await window.electron.saveProject(currentProjectPath, { pages })
                    console.log('App: Auto-save successful')
                } catch (error) {
                    console.error('Auto-save failed:', error)
                }
            }, 1000)
            return () => clearTimeout(timeout)
        }
    }, [pages, currentProjectPath])

    const handleCreateNew = async () => {
        console.log('App: handleCreateNew clicked')
        if (!window.electron) {
            console.error('App: window.electron is undefined')
            return
        }
        try {
            const folderPath = await window.electron.selectFolder()
            console.log('App: folder selected:', folderPath)
            if (!folderPath) return
            const projectName = `manga_${new Date().getTime()} `
            const projectPath = await window.electron.createProject(folderPath, projectName)
            console.log('App: project created at:', projectPath)
            setCurrentProject(projectPath)
            // Load the newly created project data
            const projectData = await window.electron.loadProject(projectPath)
            console.log('App: loaded new project data:', projectData)
            setProjectData(projectData)
        } catch (error) {
            console.error('App: handleCreateNew error:', error)
            alert('プロジェクトの作成に失敗しました')
        }
    }

    const handleOpenProject = async () => {
        console.log('App: handleOpenProject clicked')
        if (!window.electron) {
            console.error('App: window.electron is undefined')
            return
        }
        try {
            const folderPath = await window.electron.selectFolder()
            console.log('App: folder selected:', folderPath)
            if (!folderPath) return
            const projectData = await window.electron.loadProject(folderPath)
            console.log('App: project data loaded from main:', projectData)
            setCurrentProject(folderPath)
            setProjectData(projectData)
        } catch (error) {
            console.error('App: handleOpenProject error:', error)
            alert('プロジェクトの読み込みに失敗しました')
        }
    }

    const handleAddPanelWithType = (type: PanelType) => {
        let slant = 0, offsetB = 0, offsetC = 0, offsetD = 0
        if (type === 'slanted') slant = 40
        if (type === 'trapezoid-h') { slant = 20; offsetB = -20; offsetC = 0; offsetD = 0; }
        if (type === 'trapezoid-v') { slant = 0; offsetD = 20; offsetC = -20; offsetB = 0; }

        addPanel({
            x: 100,
            y: 100,
            type,
            slant,
            offsetB,
            offsetC,
            offsetD
        })
    }

    return (
        <div className="flex h-screen bg-zinc-950 text-zinc-300 overflow-hidden font-sans">
            {/* Left Sidebar */}
            <div className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col shrink-0">
                <div className="p-4 border-b border-zinc-800 flex items-center gap-2">
                    <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center">
                        <span className="text-white font-bold text-xs">M</span>
                    </div>
                    <h1 className="font-bold text-white tracking-tight">MangaFarm</h1>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-6">
                    {!currentProjectPath ? (
                        <div className="space-y-2">
                            <button onClick={handleCreateNew} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white group">
                                <Plus size={18} className="group-hover:text-blue-500 transition-colors" />
                                <span className="text-sm font-medium">新規プロジェクト</span>
                            </button>
                            <button onClick={handleOpenProject} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white group">
                                <FolderOpen size={18} className="group-hover:text-blue-500 transition-colors" />
                                <span className="text-sm font-medium">プロジェクトを開く</span>
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <button
                                    onClick={() => saveProject()}
                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 border border-blue-600/20 transition-colors text-blue-400 hover:text-blue-300 font-bold group"
                                >
                                    <Save size={18} />
                                    <span className="text-sm">保存 (Cmd+S)</span>
                                </button>
                                <button
                                    onClick={handleExportPNG}
                                    disabled={!currentPageId}
                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-600/20 transition-colors text-emerald-400 hover:text-emerald-300 font-bold group disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Download size={18} />
                                    <span className="text-sm">PNG出力 (Export)</span>
                                </button>
                            </div>

                            <div className="space-y-1">
                                <div className="flex items-center justify-between px-3 mb-2">
                                    <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Pages</h2>
                                    {currentPageId && !isSavingTemplate && (
                                        <button
                                            onClick={() => {
                                                console.log('App: Save layout clicked')
                                                setIsSavingTemplate(true)
                                                setTemplateName(`Template ${templates.length + 1}`)
                                            }}
                                            className="text-[10px] text-blue-500 hover:text-blue-400 font-bold uppercase transition-colors flex items-center gap-1 p-1 -m-1"
                                            title="現在のレイアウトをテンプレートとして保存"
                                        >
                                            <Save size={10} />
                                            Save Layout
                                        </button>
                                    )}
                                </div>

                                {isSavingTemplate && (
                                    <div className="px-2 mb-4 p-2 bg-blue-600/10 border border-blue-600/20 rounded-lg space-y-2">
                                        <input
                                            autoFocus
                                            value={templateName}
                                            onChange={(e) => setTemplateName(e.target.value)}
                                            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                                            placeholder="テンプレート名"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && templateName) {
                                                    saveAsTemplate(templateName)
                                                    setIsSavingTemplate(false)
                                                }
                                                if (e.key === 'Escape') setIsSavingTemplate(false)
                                            }}
                                        />
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => {
                                                    if (templateName) {
                                                        saveAsTemplate(templateName)
                                                        setIsSavingTemplate(false)
                                                    }
                                                }}
                                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-[10px] font-bold py-1 rounded"
                                            >
                                                保存
                                            </button>
                                            <button
                                                onClick={() => setIsSavingTemplate(false)}
                                                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-[10px] font-bold py-1 rounded"
                                            >
                                                取消
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-2 mb-4 px-1">
                                    <button
                                        onClick={() => addPage()}
                                        className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-all text-xs font-bold shadow-lg shadow-blue-900/20"
                                    >
                                        <Plus size={16} />
                                        <span>白紙</span>
                                    </button>
                                    <button
                                        onClick={() => setIsTemplateModalOpen(true)}
                                        className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-all text-xs font-bold border border-zinc-700"
                                    >
                                        <Layout size={16} />
                                        <span>Template</span>
                                    </button>
                                </div>

                                <div className="space-y-1">
                                    {pages.map((page, idx) => (
                                        <div key={page.id} className="group relative">
                                            <button
                                                onClick={() => selectPage(page.id)}
                                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm ${currentPageId === page.id ? 'bg-zinc-800 text-white border border-zinc-700' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 border border-transparent'}`}
                                            >
                                                <span className="truncate flex-1 text-left font-mono font-medium">{page.name}</span>
                                            </button>
                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); movePage(page.id, 'up'); }}
                                                    disabled={idx === 0}
                                                    className="p-1 text-zinc-500 hover:text-white disabled:opacity-0 transition-colors"
                                                    title="上に移動"
                                                >
                                                    <ChevronUp size={14} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); movePage(page.id, 'down'); }}
                                                    disabled={idx === pages.length - 1}
                                                    className="p-1 text-zinc-500 hover:text-white disabled:opacity-0 transition-colors"
                                                    title="下に移動"
                                                >
                                                    <ChevronDown size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Area */}
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

            {/* Right Sidebar: Properties */}
            <div className={`w-72 bg-zinc-900 border-l border-zinc-800 shrink-0 flex flex-col transition-transform ${currentPageId ? 'translate-x-0' : 'translate-x-full'} `}>
                {currentPageId && (
                    <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
                        {selectedPanel ? (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Panel Settings</h2>
                                        <button onClick={() => removePanel(selectedPanel.id)} className="p-1.5 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 rounded-md transition-all">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {(['rect', 'slanted', 'trapezoid-h', 'trapezoid-v'] as const).map((type) => (
                                            <button
                                                key={type}
                                                onClick={() => updatePanel(selectedPanel.id, { type })}
                                                className={`py-2 px-3 rounded-lg border text-[10px] font-bold transition-all ${selectedPanel.type === type ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/40' : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'} `}
                                            >
                                                {type.replace('-', ' ').toUpperCase()}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {selectedPanel.type !== 'rect' && (
                                    <div className="space-y-4 pt-4 border-t border-zinc-800">
                                        <h3 className="text-[10px] font-bold text-zinc-600 uppercase">Shape Adjustments</h3>
                                        <div className="space-y-4">
                                            {selectedPanel.type === 'slanted' && (
                                                <div>
                                                    <div className="flex justify-between mb-1"><label className="text-[10px] text-zinc-500 uppercase">Slant Angle</label><span className="text-[10px] text-blue-500 font-mono">{selectedPanel.slant}px</span></div>
                                                    <input type="range" min="-200" max="200" value={selectedPanel.slant} onChange={(e) => updatePanel(selectedPanel.id, { slant: parseInt(e.target.value) })} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {selectedPanel.imagePath && (
                                    <div className="space-y-4 pt-4 border-t border-zinc-800">
                                        <h3 className="text-[10px] font-bold text-zinc-600 uppercase">Image Settings</h3>
                                        <div className="space-y-4">
                                            <div>
                                                <div className="flex justify-between mb-1"><label className="text-[10px] text-zinc-500 uppercase">Scale</label><span className="text-[10px] text-blue-500 font-mono">{Math.round((selectedPanel.imageScale ?? 1) * 100)}%</span></div>
                                                <input type="range" min="10" max="500" value={(selectedPanel.imageScale ?? 1) * 100} onChange={(e) => updatePanel(selectedPanel.id, { imageScale: parseInt(e.target.value) / 100 })} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                            </div>
                                            <div>
                                                <div className="flex justify-between mb-1"><label className="text-[10px] text-zinc-500 uppercase">Rotation</label><span className="text-[10px] text-blue-500 font-mono">{selectedPanel.imageRotation ?? 0}°</span></div>
                                                <input type="range" min="0" max="360" value={selectedPanel.imageRotation ?? 0} onChange={(e) => updatePanel(selectedPanel.id, { imageRotation: parseInt(e.target.value) })} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-6 pt-4 border-t border-zinc-800">
                                    <div>
                                        <h3 className="text-[10px] font-bold text-zinc-600 uppercase mb-3">Fade Out Direction</h3>
                                        <div className="grid grid-cols-5 gap-1.5">
                                            <DirectionButton dir="none" icon={<Layers size={14} />} current={selectedPanel.fadeDirection} onSelect={(dir) => updatePanel(selectedPanel.id, { fadeDirection: dir })} />
                                            <DirectionButton dir="top" icon={<ArrowUp size={14} />} current={selectedPanel.fadeDirection} onSelect={(dir) => updatePanel(selectedPanel.id, { fadeDirection: dir })} />
                                            <DirectionButton dir="bottom" icon={<ArrowDown size={14} />} current={selectedPanel.fadeDirection} onSelect={(dir) => updatePanel(selectedPanel.id, { fadeDirection: dir })} />
                                            <DirectionButton dir="left" icon={<ArrowLeft size={14} />} current={selectedPanel.fadeDirection} onSelect={(dir) => updatePanel(selectedPanel.id, { fadeDirection: dir })} />
                                            <DirectionButton dir="right" icon={<ArrowRight size={14} />} current={selectedPanel.fadeDirection} onSelect={(dir) => updatePanel(selectedPanel.id, { fadeDirection: dir })} />
                                        </div>
                                    </div>

                                    {selectedPanel.fadeDirection && selectedPanel.fadeDirection !== 'none' && (
                                        <div className="animate-in fade-in zoom-in-95 duration-200">
                                            <div className="flex justify-between mb-2">
                                                <label className="text-[10px] text-zinc-500 uppercase">Fade Strength</label>
                                                <span className="text-[10px] text-blue-500 font-mono">{Math.round((selectedPanel.fadeStrength ?? 0.4) * 100)}%</span>
                                            </div>
                                            <input type="range" min="10" max="100" value={(selectedPanel.fadeStrength ?? 0.4) * 100} onChange={(e) => updatePanel(selectedPanel.id, { fadeStrength: parseInt(e.target.value) / 100 })} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                        </div>
                                    )}

                                    <div className="pt-2">
                                        <button
                                            onClick={() => updatePanel(selectedPanel.id, { hasFocusLines: !selectedPanel.hasFocusLines })}
                                            className={`w-full py-2 px-3 rounded-lg border text-[10px] font-bold transition-all flex items-center justify-between ${selectedPanel.hasFocusLines ? 'bg-blue-600/10 border-blue-600/50 text-blue-400' : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'} `}
                                        >
                                            <span>集中線エフェクト</span>
                                            <div className={`w-2 h-2 rounded-full ${selectedPanel.hasFocusLines ? 'bg-blue-400 animate-pulse' : 'bg-zinc-700'} `} />
                                        </button>

                                        {selectedPanel.hasFocusLines && (
                                            <div className="mt-4 space-y-4 p-3 bg-zinc-800/50 rounded-lg border border-zinc-800 animate-in fade-in slide-in-from-top-2 duration-200">
                                                <button
                                                    onClick={() => updatePanel(selectedPanel.id, { isAdjustingFocus: !selectedPanel.hasFocusLines || !selectedPanel.isAdjustingFocus })}
                                                    className={`w-full py-1.5 rounded text-[10px] font-bold transition-all ${selectedPanel.isAdjustingFocus ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'bg-zinc-700 text-zinc-400 hover:text-white'} `}
                                                >
                                                    {selectedPanel.isAdjustingFocus ? '中心位置を決定' : '中心位置を調整'}
                                                </button>
                                                <div>
                                                    <div className="flex justify-between mb-1"><label className="text-[8px] text-zinc-500 uppercase">密度 (Density)</label><span className="text-[8px] text-blue-500 font-mono">{selectedPanel.focusDensity}</span></div>
                                                    <input type="range" min="20" max="800" value={selectedPanel.focusDensity ?? 100} onChange={(e) => updatePanel(selectedPanel.id, { focusDensity: parseInt(e.target.value) })} className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                                </div>
                                                <div>
                                                    <div className="flex justify-between mb-1"><label className="text-[8px] text-zinc-500 uppercase">太さ (Width)</label><span className="text-[8px] text-blue-500 font-mono">{selectedPanel.focusWidth}px</span></div>
                                                    <input type="range" min="0.5" max="5" step="0.5" value={selectedPanel.focusWidth ?? 1} onChange={(e) => updatePanel(selectedPanel.id, { focusWidth: parseFloat(e.target.value) })} className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                                </div>
                                                <div>
                                                    <div className="flex justify-between mb-1"><label className="text-[8px] text-zinc-500 uppercase">中心半径 (Radius)</label><span className="text-[8px] text-blue-500 font-mono">{selectedPanel.focusRadius}px</span></div>
                                                    <input type="range" min="0" max="300" value={selectedPanel.focusRadius ?? 50} onChange={(e) => updatePanel(selectedPanel.id, { focusRadius: parseInt(e.target.value) })} className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : selectedBubble ? (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Bubble Settings</h2>
                                <div>
                                    <label className="text-xs text-zinc-400 block mb-2">種類</label>
                                    <div className="grid grid-cols-3 gap-1">
                                        {(['rounded', 'jagged', 'rect', 'flash'] as const).map((type) => (
                                            <button
                                                key={type}
                                                onClick={() => updateBubble(selectedBubble.id, { type })}
                                                className={`py-2 flex flex-col items-center gap-1 rounded border transition-all ${selectedBubble.type === type ? 'bg-blue-600 border-blue-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'} `}
                                            >
                                                {type === 'rounded' ? <Ghost size={14} /> : type === 'jagged' ? <Maximize size={14} /> : type === 'flash' ? <Zap size={14} /> : <Square size={14} />}
                                                <span className="text-[8px] uppercase tracking-tighter">{type}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-xs text-zinc-400">テキスト</label>
                                        <button
                                            onClick={() => updateBubble(selectedBubble.id, { isVertical: !selectedBubble.isVertical })}
                                            className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${selectedBubble.isVertical ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'} `}
                                        >
                                            {selectedBubble.isVertical ? '縦書き' : '横書き'}
                                        </button>
                                    </div>
                                    <textarea
                                        value={selectedBubble.text}
                                        onChange={(e) => updateBubble(selectedBubble.id, { text: e.target.value })}
                                        className="w-full h-24 bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-blue-500/50 resize-none"
                                        placeholder="セリフを入力..."
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-zinc-400 block mb-2">サイズ</label>
                                        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded px-2">
                                            <Type size={14} className="text-zinc-600" />
                                            <input
                                                type="number"
                                                value={selectedBubble.fontSize}
                                                onChange={(e) => updateBubble(selectedBubble.id, { fontSize: parseInt(e.target.value) })}
                                                className="w-full bg-transparent p-2 text-xs text-white focus:outline-none"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-zinc-400 block mb-2">文字色</label>
                                        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded px-2 h-[34px]">
                                            <Palette size={14} className="text-zinc-600" />
                                            <input
                                                type="color"
                                                value={selectedBubble.fontColor}
                                                onChange={(e) => updateBubble(selectedBubble.id, { fontColor: e.target.value })}
                                                className="w-full h-5 bg-transparent border-none p-0 cursor-pointer"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-zinc-400 block mb-2">太さ</label>
                                        <button
                                            onClick={() => updateBubble(selectedBubble.id, { fontWeight: selectedBubble.fontWeight === 'bold' ? 'normal' : 'bold' })}
                                            className={`w-full py-2 rounded text-xs font-bold transition-colors ${selectedBubble.fontWeight === 'bold' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'} `}
                                        >
                                            {selectedBubble.fontWeight === 'bold' ? '太字 (Bold)' : '標準 (Normal)'}
                                        </button>
                                    </div>
                                    <div>
                                        <label className="text-xs text-zinc-400 block mb-2">フォント</label>
                                        <select
                                            value={selectedBubble.fontFamily}
                                            onChange={(e) => updateBubble(selectedBubble.id, { fontFamily: e.target.value })}
                                            className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                                        >
                                            <option value="sans-serif">ゴシック体</option>
                                            <option value="serif">明朝体</option>
                                            <option value="'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif">ヒラギノ角ゴ / メイリオ</option>
                                            <option value="'Hiragino Mincho ProN', 'MS PMincho', serif">ヒラギノ明朝 / MS明朝</option>
                                            <option value="'Klee One', cursive">手描き (クレー One)</option>
                                            <option value="'Yusei Magic', sans-serif">手描き (油星マジック)</option>
                                            <option value="'Hachi Maru Pop', cursive">手描き (はちまるポップ)</option>
                                            <option value="'Kiwi Maru', serif">手描き (キウイ丸)</option>
                                            <option value="'Comic Sans MS', cursive">Handwriting (Comic Sans)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs text-zinc-400 block mb-2">枠線の太さ</label>
                                        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded px-2 h-[34px]">
                                            <input
                                                type="number"
                                                min="0"
                                                max="20"
                                                step="0.5"
                                                value={selectedBubble.borderWidth ?? 2}
                                                onChange={(e) => updateBubble(selectedBubble.id, { borderWidth: parseFloat(e.target.value) })}
                                                className="w-full bg-transparent p-2 text-xs text-white focus:outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4 pt-4 border-t border-zinc-800">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-zinc-400 block mb-2">背景色</label>
                                            <input
                                                type="color"
                                                value={selectedBubble.backgroundColor}
                                                onChange={(e) => updateBubble(selectedBubble.id, { backgroundColor: e.target.value })}
                                                className="w-full h-6 bg-transparent border-none p-0 cursor-pointer"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-zinc-400 block mb-2">枠線色</label>
                                            <input
                                                type="color"
                                                value={selectedBubble.borderColor}
                                                onChange={(e) => updateBubble(selectedBubble.id, { borderColor: e.target.value })}
                                                className="w-full h-6 bg-transparent border-none p-0 cursor-pointer"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between mb-2">
                                            <label className="text-xs text-zinc-400">不透明度</label>
                                            <span className="text-xs text-blue-500 font-mono">{Math.round(selectedBubble.opacity * 100)}%</span>
                                        </div>
                                        <input
                                            type="range" min="0" max="1" step="0.05"
                                            value={selectedBubble.opacity}
                                            onChange={(e) => updateBubble(selectedBubble.id, { opacity: parseFloat(e.target.value) })}
                                            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                        />
                                    </div>

                                    <div className="pt-2 space-y-4">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Move size={12} className="text-zinc-500" />
                                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Text Offset</label>
                                        </div>
                                        <div className="grid grid-cols-1 gap-3">
                                            <div>
                                                <div className="flex justify-between mb-1">
                                                    <span className="text-[10px] text-zinc-500">X Offset</span>
                                                    <span className="text-[10px] text-blue-500 font-mono">{selectedBubble.textOffsetX}px</span>
                                                </div>
                                                <input
                                                    type="range" min="-100" max="100" step="1"
                                                    value={selectedBubble.textOffsetX}
                                                    onChange={(e) => updateBubble(selectedBubble.id, { textOffsetX: parseInt(e.target.value) })}
                                                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                                />
                                            </div>
                                            <div>
                                                <div className="flex justify-between mb-1">
                                                    <span className="text-[10px] text-zinc-500">Y Offset</span>
                                                    <span className="text-[10px] text-blue-500 font-mono">{selectedBubble.textOffsetY}px</span>
                                                </div>
                                                <input
                                                    type="range" min="-100" max="100" step="1"
                                                    value={selectedBubble.textOffsetY}
                                                    onChange={(e) => updateBubble(selectedBubble.id, { textOffsetY: parseInt(e.target.value) })}
                                                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                                />
                                            </div>
                                            <div>
                                                <div className="flex justify-between mb-1">
                                                    <span className="text-[10px] text-zinc-500">Deformation</span>
                                                    <span className="text-[10px] text-blue-500 font-mono">{Math.round((selectedBubble.deformation ?? 1) * 100)}%</span>
                                                </div>
                                                <input
                                                    type="range" min="0" max="3" step="0.1"
                                                    value={selectedBubble.deformation ?? 1}
                                                    onChange={(e) => updateBubble(selectedBubble.id, { deformation: parseFloat(e.target.value) })}
                                                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                                />
                                            </div>
                                            {(selectedBubble.type === 'jagged' || selectedBubble.type === 'flash') && (
                                                <div className="space-y-4">
                                                    <div>
                                                        <div className="flex justify-between mb-1">
                                                            <span className="text-[10px] text-zinc-500">Spikes</span>
                                                            <span className="text-[10px] text-blue-500 font-mono">{selectedBubble.spikeCount ?? 36}</span>
                                                        </div>
                                                        <input
                                                            type="range" min="8" max="100" step="1"
                                                            value={selectedBubble.spikeCount ?? 36}
                                                            onChange={(e) => updateBubble(selectedBubble.id, { spikeCount: parseInt(e.target.value) })}
                                                            className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                                        />
                                                    </div>
                                                    {selectedBubble.type === 'flash' && (
                                                        <>
                                                            <div>
                                                                <div className="flex justify-between mb-1">
                                                                    <span className="text-[10px] text-zinc-500">Thickness</span>
                                                                    <span className="text-[10px] text-blue-500 font-mono">{selectedBubble.borderWidth ?? 0.5}px</span>
                                                                </div>
                                                                <input
                                                                    type="range" min="0.1" max="10" step="0.1"
                                                                    value={selectedBubble.borderWidth ?? 0.5}
                                                                    onChange={(e) => updateBubble(selectedBubble.id, { borderWidth: parseFloat(e.target.value) })}
                                                                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                                                />
                                                            </div>
                                                            <div>
                                                                <div className="flex justify-between mb-1">
                                                                    <span className="text-[10px] text-zinc-500">Length</span>
                                                                    <span className="text-[10px] text-blue-500 font-mono">{Math.round((selectedBubble.flashLength ?? 1) * 100)}%</span>
                                                                </div>
                                                                <input
                                                                    type="range" min="0.1" max="5" step="0.1"
                                                                    value={selectedBubble.flashLength ?? 1}
                                                                    onChange={(e) => updateBubble(selectedBubble.id, { flashLength: parseFloat(e.target.value) })}
                                                                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                                                />
                                                            </div>
                                                        </>
                                                    )}

                                                </div>
                                            )}
                                            <div className="pt-2 mt-2 border-t border-zinc-800">
                                                <div className="flex justify-between mb-2">
                                                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Tail Settings</span>
                                                    <button
                                                        onClick={() => updateBubble(selectedBubble.id, { tailX: 0, tailY: 0, tailControlX: 0, tailControlY: 0 })}
                                                        className="text-[9px] text-zinc-500 hover:text-white transition-colors"
                                                    >
                                                        Reset
                                                    </button>
                                                </div>
                                                <div className="space-y-3">
                                                    {selectedBubble.type === 'rounded' && (
                                                        <div className="pb-2 border-b border-zinc-900">
                                                            <label className="text-[10px] text-zinc-500 block mb-2 uppercase tracking-tight">しっぽの形状</label>
                                                            <div className="flex gap-1">
                                                                <button
                                                                    onClick={() => updateBubble(selectedBubble.id, { tailType: 'point' })}
                                                                    className={`flex-1 py-1.5 rounded text-[10px] font-bold transition-all ${selectedBubble.tailType !== 'thought' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'} `}
                                                                >
                                                                    通常
                                                                </button>
                                                                <button
                                                                    onClick={() => updateBubble(selectedBubble.id, { tailType: 'thought' })}
                                                                    className={`flex-1 py-1.5 rounded text-[10px] font-bold transition-all ${selectedBubble.tailType === 'thought' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'} `}
                                                                >
                                                                    考え事
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div>
                                                        <div className="flex justify-between mb-1">
                                                            <span className="text-[10px] text-zinc-500">Tip Pos (X/Y)</span>
                                                            <span className="text-[10px] text-blue-500 font-mono">{selectedBubble.tailX || 0}, {selectedBubble.tailY || 0}</span>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <input
                                                                type="range" min="-300" max="300" step="1"
                                                                value={selectedBubble.tailX || 0}
                                                                onChange={(e) => updateBubble(selectedBubble.id, { tailX: parseInt(e.target.value) })}
                                                                className="flex-1 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                                            />
                                                            <input
                                                                type="range" min="-300" max="300" step="1"
                                                                value={selectedBubble.tailY || 0}
                                                                onChange={(e) => updateBubble(selectedBubble.id, { tailY: parseInt(e.target.value) })}
                                                                className="flex-1 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="flex justify-between mb-1">
                                                            <span className="text-[10px] text-zinc-500">Curvature (X/Y)</span>
                                                            <span className="text-[10px] text-emerald-500 font-mono">{selectedBubble.tailControlX || 0}, {selectedBubble.tailControlY || 0}</span>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <input
                                                                type="range" min="-300" max="300" step="1"
                                                                value={selectedBubble.tailControlX || 0}
                                                                onChange={(e) => updateBubble(selectedBubble.id, { tailControlX: parseInt(e.target.value) })}
                                                                className="flex-1 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                                            />
                                                            <input
                                                                type="range" min="-300" max="300" step="1"
                                                                value={selectedBubble.tailControlY || 0}
                                                                onChange={(e) => updateBubble(selectedBubble.id, { tailControlY: parseInt(e.target.value) })}
                                                                className="flex-1 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="flex justify-between mb-1">
                                                            <span className="text-[10px] text-zinc-500">Base Width</span>
                                                            <span className="text-[10px] text-zinc-400 font-mono">{selectedBubble.tailWidth || 20}px</span>
                                                        </div>
                                                        <input
                                                            type="range" min="2" max="100" step="1"
                                                            value={selectedBubble.tailWidth || 20}
                                                            onChange={(e) => updateBubble(selectedBubble.id, { tailWidth: parseInt(e.target.value) })}
                                                            className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-500"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => removeBubble(selectedBubble.id)}
                                    className="w-full py-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/30 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2"
                                >
                                    <Trash2 size={14} />
                                    吹き出しを削除
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-8 animate-in fade-in duration-300">
                                <div>
                                    <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Page Settings</h2>
                                    <div className="space-y-6">
                                        <div>
                                            <label className="text-xs text-zinc-400 block mb-3">背景色</label>
                                            <div className="grid grid-cols-7 gap-1.5">
                                                {['#ffffff', '#f4f4f5', '#d4d4d8', '#a1a1aa', '#52525b', '#27272a', '#000000', '#fee2e2', '#fca5a5', '#ef4444', '#b91c1c', '#fef9c3', '#fde047', '#eab308', '#dcfce7', '#86efac', '#22c55e', '#dbeafe', '#93c5fd', '#3b82f6', '#1d4ed8'].map((color) => (
                                                    <button
                                                        key={color}
                                                        onClick={() => currentPageId && updatePage(currentPageId, { backgroundColor: color })}
                                                        className={`w-full aspect-square rounded-sm border transition-all ${currentPage?.backgroundColor === color ? 'border-white scale-110 z-10' : 'border-zinc-800 hover:border-zinc-600'} `}
                                                        style={{ backgroundColor: color }}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between mb-2">
                                                <label className="text-xs text-zinc-400">背景不透明度</label>
                                                <span className="text-xs text-blue-500 font-mono">{Math.round((currentPage?.backgroundOpacity ?? 1) * 100)}%</span>
                                            </div>
                                            <input
                                                type="range" min="0" max="100"
                                                value={(currentPage?.backgroundOpacity ?? 1) * 100}
                                                onChange={(e) => currentPageId && updatePage(currentPageId, { backgroundOpacity: parseInt(e.target.value) / 100 })}
                                                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-zinc-800">
                                    <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Speech Bubbles</h2>
                                    <button
                                        onClick={() => addBubble({ x: 100, y: 100 })}
                                        className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold transition-all border border-zinc-700 flex items-center justify-center gap-2 group"
                                    >
                                        <MessageSquare size={16} className="group-hover:text-blue-500 transition-colors" />
                                        吹き出しを追加
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Template Selection Modal */}
            {isTemplateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                            <h3 className="font-bold flex items-center gap-2">
                                <BookTemplate size={18} className="text-blue-500" />
                                テンプレートからページを作成
                            </h3>
                            <button onClick={() => setIsTemplateModalOpen(false)} className="text-zinc-500 hover:text-white">✕</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-3">
                            {templates.length === 0 ? (
                                <div className="col-span-2 py-12 text-center text-zinc-600 italic">
                                    登録されているテンプレートがありません。<br />
                                    編集画面の "Save Template" から保存できます。
                                </div>
                            ) : (
                                templates.map((tmpl) => (
                                    <button
                                        key={tmpl.id}
                                        onClick={() => {
                                            addPage(tmpl.panels)
                                            setIsTemplateModalOpen(false)
                                        }}
                                        className="text-left p-4 rounded-xl bg-zinc-800/50 hover:bg-blue-600/10 border border-zinc-800 hover:border-blue-600/30 transition-all group"
                                    >
                                        <div className="text-xs font-bold text-zinc-300 group-hover:text-blue-400 mb-1">{tmpl.name}</div>
                                        <div className="text-[10px] text-zinc-500 italic">{tmpl.panels.length} コマ</div>
                                    </button>
                                ))
                            )}
                        </div>
                        <div className="p-4 bg-zinc-950/50 border-t border-zinc-800 flex justify-end">
                            <button
                                onClick={() => setIsTemplateModalOpen(false)}
                                className="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-white transition-colors"
                            >
                                キャンセル
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default App
