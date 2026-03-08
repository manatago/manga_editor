import React, { useState, useEffect } from 'react'
import Canvas from './components/Canvas'
import { useMangaStore, PanelType } from './store/useMangaStore'
import { Plus, FolderOpen, PanelTop, Square, AlignLeft, Table, Columns, Layers, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ChevronUp, ChevronDown, Trash2, Layout, BookTemplate, Save } from 'lucide-react'
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
        addPage,
        selectPage,
        updatePage,
        addPanel,
        updatePanel,
        removePanel,
        reorderPanel,
        templates,
        loadTemplates,
        saveAsTemplate
    } = useMangaStore()

    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
    const [isSavingTemplate, setIsSavingTemplate] = useState(false)
    const [templateName, setTemplateName] = useState('')

    // Load templates on mount
    useEffect(() => {
        loadTemplates()
    }, [])

    const currentPage = pages.find(p => p.id === currentPageId)
    const selectedPanel = currentPage?.panels.find(p => p.id === selectedPanelId)

    // Auto-save
    useEffect(() => {
        if (currentProjectPath && pages.length > 0) {
            const timeout = setTimeout(async () => {
                try {
                    await window.electron.saveProject(currentProjectPath, { pages })
                } catch (error) {
                    console.error('Auto-save failed:', error)
                }
            }, 1000)
            return () => clearTimeout(timeout)
        }
    }, [pages, currentProjectPath])

    const handleCreateNew = async () => {
        if (!window.electron) return
        try {
            const folderPath = await window.electron.selectFolder()
            if (!folderPath) return
            const projectName = `manga_${new Date().getTime()}`
            const projectPath = await window.electron.createProject(folderPath, projectName)
            setCurrentProject(projectPath)
            setProjectData({ pages: [] })
        } catch (error) {
            console.error(error)
            alert('プロジェクトの作成に失敗しました')
        }
    }

    const handleOpenProject = async () => {
        if (!window.electron) return
        try {
            const folderPath = await window.electron.selectFolder()
            if (!folderPath) return
            const projectData = await window.electron.loadProject(folderPath)
            setCurrentProject(folderPath)
            setProjectData(projectData)
        } catch (error) {
            console.error(error)
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

                            {pages.map((page, idx) => (
                                <button
                                    key={page.id}
                                    onClick={() => selectPage(page.id)}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm ${currentPageId === page.id ? 'bg-zinc-800 text-white border border-zinc-700' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}
                                >
                                    <span className="opacity-30 text-[10px] font-mono">{String(idx + 1).padStart(2, '0')}</span>
                                    <span className="truncate">{page.name}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Main Area */}
            <div className="flex-1 flex flex-col min-w-0">
                <div className="h-14 bg-zinc-900 border-b border-zinc-800 flex items-center px-6 justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        {currentPageId && (
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
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-auto bg-zinc-950 relative">
                    {currentPageId ? <Canvas /> : (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-800">
                            <PanelTop size={64} className="mb-4 opacity-10" />
                            <p className="text-sm font-medium opacity-40">ページを選択して編集を開始してください</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Sidebar: Properties */}
            <div className={`w-72 bg-zinc-900 border-l border-zinc-800 shrink-0 transition-transform ${currentPageId ? 'translate-x-0' : 'translate-x-full'}`}>
                {!selectedPanelId && currentPageId && (
                    <div className="p-6 space-y-8 overflow-y-auto h-full">
                        <div>
                            <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Page Canvas Settings</h2>
                            <div className="space-y-6">
                                <div>
                                    <label className="text-xs text-zinc-400 block mb-3">背景色 (Background Color)</label>
                                    <div className="grid grid-cols-7 gap-1.5">
                                        {['#ffffff', '#f4f4f5', '#d4d4d8', '#a1a1aa', '#52525b', '#27272a', '#000000', '#fee2e2', '#fca5a5', '#ef4444', '#b91c1c', '#fef9c3', '#fde047', '#eab308', '#dcfce7', '#86efac', '#22c55e', '#dbeafe', '#93c5fd', '#3b82f6', '#1d4ed8'].map((color) => {
                                            const page = pages.find(p => p.id === currentPageId)
                                            return (
                                                <button
                                                    key={color}
                                                    onClick={() => updatePage(currentPageId, { backgroundColor: color })}
                                                    className={`w-full aspect-square rounded-sm border transition-all ${page?.backgroundColor === color ? 'border-white scale-110 z-10' : 'border-zinc-800 hover:border-zinc-600'}`}
                                                    style={{ backgroundColor: color }}
                                                />
                                            )
                                        })}
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between mb-2">
                                        <label className="text-xs text-zinc-400">背景の透明度 (Opacity)</label>
                                        <span className="text-xs text-blue-500 font-mono">{Math.round((pages.find(p => p.id === currentPageId)?.backgroundOpacity ?? 1) * 100)}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={(pages.find(p => p.id === currentPageId)?.backgroundOpacity ?? 1) * 100}
                                        onChange={(e) => updatePage(currentPageId, { backgroundOpacity: parseInt(e.target.value) / 100 })}
                                        className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {selectedPanel && (
                    <div className="p-6 space-y-8 overflow-y-auto h-full">
                        <div>
                            <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Appearance</h2>
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between mb-2">
                                        <label className="text-xs text-zinc-400">枠線の太さ</label>
                                        <span className="text-xs text-blue-500 font-mono">{selectedPanel.strokeWidth}px</span>
                                    </div>
                                    <input type="range" min="0" max="20" value={selectedPanel.strokeWidth} onChange={(e) => updatePanel(selectedPanel.id, { strokeWidth: parseInt(e.target.value) })} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                </div>
                            </div>
                        </div>

                        {selectedPanel.imagePath && (
                            <div>
                                <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Background Image</h2>
                                <div className="space-y-4">
                                    <div>
                                        <div className="flex justify-between mb-2">
                                            <label className="text-xs text-zinc-400">拡大率 (Scale)</label>
                                            <span className="text-xs text-blue-500 font-mono">{Math.round((selectedPanel.imageScale || 1) * 100)}%</span>
                                        </div>
                                        <input type="range" min="10" max="500" value={(selectedPanel.imageScale || 1) * 100} onChange={(e) => updatePanel(selectedPanel.id, { imageScale: parseInt(e.target.value) / 100 })} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                    </div>
                                    <div>
                                        <div className="flex justify-between mb-2">
                                            <label className="text-xs text-zinc-400">回転 (Rotation)</label>
                                            <span className="text-xs text-blue-500 font-mono">{selectedPanel.imageRotation || 0}°</span>
                                        </div>
                                        <input type="range" min="-180" max="180" value={selectedPanel.imageRotation || 0} onChange={(e) => updatePanel(selectedPanel.id, { imageRotation: parseInt(e.target.value) })} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                    </div>
                                    <div>
                                        <div className="flex justify-between mb-2">
                                            <label className="text-xs text-zinc-400">位置調整 (Offset X)</label>
                                            <span className="text-xs text-blue-500 font-mono">{selectedPanel.imageX || 0}px</span>
                                        </div>
                                        <input type="range" min="-500" max="500" value={selectedPanel.imageX || 0} onChange={(e) => updatePanel(selectedPanel.id, { imageX: parseInt(e.target.value) })} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                    </div>
                                    <div>
                                        <div className="flex justify-between mb-2">
                                            <label className="text-xs text-zinc-400">位置調整 (Offset Y)</label>
                                            <span className="text-xs text-blue-500 font-mono">{selectedPanel.imageY || 0}px</span>
                                        </div>
                                        <input type="range" min="-500" max="500" value={selectedPanel.imageY || 0} onChange={(e) => updatePanel(selectedPanel.id, { imageY: parseInt(e.target.value) })} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                    </div>
                                    <button
                                        onClick={() => updatePanel(selectedPanel.id, { imagePath: undefined })}
                                        className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-[10px] font-bold rounded flex items-center justify-center gap-2 transition-colors uppercase tracking-wider"
                                    >
                                        画像を解除
                                    </button>
                                </div>
                            </div>
                        )}

                        <div>
                            <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Panel Effects</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs text-zinc-400 block mb-2">フェードアウト (Fade Out)</label>
                                    <div className="flex flex-col items-center mb-4">
                                        <div className="grid grid-cols-3 gap-1 w-32">
                                            <div />
                                            <DirectionButton dir="top" icon={<ArrowUp size={14} />} current={selectedPanel.fadeDirection} onSelect={(dir) => updatePanel(selectedPanel.id, { fadeDirection: dir })} />
                                            <div />

                                            <DirectionButton dir="left" icon={<ArrowLeft size={14} />} current={selectedPanel.fadeDirection} onSelect={(dir) => updatePanel(selectedPanel.id, { fadeDirection: dir })} />
                                            <DirectionButton dir="none" icon={<span className="text-[10px] font-bold">OFF</span>} current={selectedPanel.fadeDirection} onSelect={(dir) => updatePanel(selectedPanel.id, { fadeDirection: dir })} />
                                            <DirectionButton dir="right" icon={<ArrowRight size={14} />} current={selectedPanel.fadeDirection} onSelect={(dir) => updatePanel(selectedPanel.id, { fadeDirection: dir })} />

                                            <div />
                                            <DirectionButton dir="bottom" icon={<ArrowDown size={14} />} current={selectedPanel.fadeDirection} onSelect={(dir) => updatePanel(selectedPanel.id, { fadeDirection: dir })} />
                                            <div />
                                        </div>
                                    </div>
                                    {selectedPanel.fadeDirection !== 'none' && (
                                        <div className="mb-2">
                                            <div className="flex justify-between mb-2">
                                                <label className="text-xs text-zinc-400">フェードの強さ (Strength)</label>
                                                <span className="text-xs text-blue-500 font-mono">{Math.round((selectedPanel.fadeStrength ?? 0.4) * 100)}%</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0.1"
                                                max="1"
                                                step="0.05"
                                                value={selectedPanel.fadeStrength ?? 0.4}
                                                onChange={(e) => updatePanel(selectedPanel.id, { fadeStrength: parseFloat(e.target.value) })}
                                                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                            />
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center justify-between py-2 border-t border-zinc-800/50">
                                    <label className="text-xs text-zinc-400">集中線 (Focus Lines)</label>
                                    <button
                                        onClick={() => updatePanel(selectedPanel.id, { hasFocusLines: !selectedPanel.hasFocusLines })}
                                        className={`w-10 h-5 rounded-full transition-all relative ${selectedPanel.hasFocusLines ? 'bg-blue-600' : 'bg-zinc-800'}`}
                                    >
                                        <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${selectedPanel.hasFocusLines ? 'left-6' : 'left-1'}`} />
                                    </button>
                                </div>
                                {selectedPanel.hasFocusLines && (
                                    <div className="space-y-4 pt-2 border-t border-zinc-800/30">
                                        <div>
                                            <div className="flex justify-between mb-2">
                                                <label className="text-xs text-zinc-400">線の密度 (Density)</label>
                                                <span className="text-xs text-blue-500 font-mono">{selectedPanel.focusDensity}</span>
                                            </div>
                                            <input type="range" min="10" max="500" value={selectedPanel.focusDensity} onChange={(e) => updatePanel(selectedPanel.id, { focusDensity: parseInt(e.target.value) })} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                        </div>
                                        <div>
                                            <div className="flex justify-between mb-2">
                                                <label className="text-xs text-zinc-400">線の太さ (Thickness)</label>
                                                <span className="text-xs text-blue-500 font-mono">{selectedPanel.focusWidth || 1}</span>
                                            </div>
                                            <input type="range" min="0.1" max="10" step="0.1" value={selectedPanel.focusWidth || 1} onChange={(e) => updatePanel(selectedPanel.id, { focusWidth: parseFloat(e.target.value) })} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                        </div>
                                        <div>
                                            <div className="flex justify-between mb-2">
                                                <label className="text-xs text-zinc-400">集中円の大きさ (Radius)</label>
                                                <span className="text-xs text-blue-500 font-mono">{selectedPanel.focusRadius || 50}px</span>
                                            </div>
                                            <input type="range" min="0" max="300" value={selectedPanel.focusRadius || 50} onChange={(e) => updatePanel(selectedPanel.id, { focusRadius: parseInt(e.target.value) })} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                        </div>
                                        <div>
                                            <div className="flex justify-between mb-2">
                                                <label className="text-xs text-zinc-400">中心位置 X (Focus X)</label>
                                                <span className="text-xs text-blue-500 font-mono">{Math.round((selectedPanel.focusCenterX ?? 0.5) * 100)}%</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="-50"
                                                max="150"
                                                value={Math.round((selectedPanel.focusCenterX ?? 0.5) * 100)}
                                                onChange={(e) => updatePanel(selectedPanel.id, { focusCenterX: parseInt(e.target.value) / 100 })}
                                                onMouseEnter={() => updatePanel(selectedPanel.id, { isAdjustingFocus: true })}
                                                onMouseLeave={() => updatePanel(selectedPanel.id, { isAdjustingFocus: false })}
                                                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                            />
                                        </div>
                                        <div>
                                            <div className="flex justify-between mb-2">
                                                <label className="text-xs text-zinc-400">中心位置 Y (Focus Y)</label>
                                                <span className="text-xs text-blue-500 font-mono">{Math.round((selectedPanel.focusCenterY ?? 0.5) * 100)}%</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="-50"
                                                max="150"
                                                value={Math.round((selectedPanel.focusCenterY ?? 0.5) * 100)}
                                                onChange={(e) => updatePanel(selectedPanel.id, { focusCenterY: parseInt(e.target.value) / 100 })}
                                                onMouseEnter={() => updatePanel(selectedPanel.id, { isAdjustingFocus: true })}
                                                onMouseLeave={() => updatePanel(selectedPanel.id, { isAdjustingFocus: false })}
                                                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Geometry ({selectedPanel.type})</h2>
                            <div className="space-y-4">
                                {(selectedPanel.type === 'slanted' || selectedPanel.type === 'trapezoid-h' || selectedPanel.type === 'trapezoid-v') && (
                                    <div>
                                        <div className="flex justify-between mb-2">
                                            <label className="text-xs text-zinc-400">変形度 (Parameter A)</label>
                                            <span className="text-xs text-blue-500 font-mono">{Math.round(selectedPanel.slant)}px</span>
                                        </div>
                                        <input type="range" min="-150" max="150" value={selectedPanel.slant} onChange={(e) => updatePanel(selectedPanel.id, { slant: parseInt(e.target.value) })} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                    </div>
                                )}
                                {(selectedPanel.type === 'trapezoid-h' || selectedPanel.type === 'trapezoid-v') && (
                                    <>
                                        <div>
                                            <div className="flex justify-between mb-2">
                                                <label className="text-xs text-zinc-400">変形度 (Parameter B)</label>
                                                <span className="text-xs text-blue-500 font-mono">{Math.round(selectedPanel.offsetB)}px</span>
                                            </div>
                                            <input type="range" min="-150" max="150" value={selectedPanel.offsetB} onChange={(e) => updatePanel(selectedPanel.id, { offsetB: parseInt(e.target.value) })} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                        </div>
                                        <div>
                                            <div className="flex justify-between mb-2">
                                                <label className="text-xs text-zinc-400">変形度 (Parameter C)</label>
                                                <span className="text-xs text-blue-500 font-mono">{Math.round(selectedPanel.offsetC)}px</span>
                                            </div>
                                            <input type="range" min="-150" max="150" value={selectedPanel.offsetC} onChange={(e) => updatePanel(selectedPanel.id, { offsetC: parseInt(e.target.value) })} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                        </div>
                                        <div>
                                            <div className="flex justify-between mb-2">
                                                <label className="text-xs text-zinc-400">変形度 (Parameter D)</label>
                                                <span className="text-xs text-blue-500 font-mono">{Math.round(selectedPanel.offsetD)}px</span>
                                            </div>
                                            <input type="range" min="-150" max="150" value={selectedPanel.offsetD} onChange={(e) => updatePanel(selectedPanel.id, { offsetD: parseInt(e.target.value) })} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <div>
                            <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Layering</h2>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => reorderPanel(selectedPanel.id, 'front')}
                                    className="flex items-center justify-center gap-2 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-[10px] font-medium transition-colors"
                                >
                                    <ChevronUp size={14} className="text-blue-500" />
                                    最前面
                                </button>
                                <button
                                    onClick={() => reorderPanel(selectedPanel.id, 'back')}
                                    className="flex items-center justify-center gap-2 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-[10px] font-medium transition-colors"
                                >
                                    <ChevronDown size={14} className="text-zinc-500" />
                                    最後面
                                </button>
                                <button
                                    onClick={() => reorderPanel(selectedPanel.id, 'up')}
                                    className="flex items-center justify-center gap-2 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-[10px] font-medium transition-colors"
                                >
                                    <ArrowUp size={14} />
                                    一つ前へ
                                </button>
                                <button
                                    onClick={() => reorderPanel(selectedPanel.id, 'down')}
                                    className="flex items-center justify-center gap-2 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-[10px] font-medium transition-colors"
                                >
                                    <ArrowDown size={14} />
                                    一つ後ろへ
                                </button>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-zinc-800 space-y-3">
                            <button
                                onClick={() => {
                                    if (confirm('このコマを削除しますか？')) {
                                        removePanel(selectedPanel.id)
                                    }
                                }}
                                className="w-full py-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/30 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2"
                            >
                                <Trash2 size={14} />
                                コマを削除
                            </button>
                            <button
                                onClick={() => setSelectedPanel(null)}
                                className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-[10px] text-zinc-400 font-medium transition-colors uppercase tracking-wider"
                            >
                                Deselect
                            </button>
                        </div>
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
