import React from 'react'
import { Trash2, Layers, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Ghost, Maximize, Zap, Square, MessageSquare, Type, Palette, Move, FolderOpen, Scissors, Volume2, Grid, Megaphone, PanelsTopLeft, AlignLeft, Table, Columns, Copy } from 'lucide-react'
import { useMangaStore, Panel, Bubble, FadeDirection, PanelType } from '../store/useMangaStore'

interface SidebarRightProps {
    currentPageId: string | null;
    selectedPanel: any;
    removePanel: (id: string) => void;
    updatePanel: (id: string, updates: any) => void;
    selectedBubble: any;
    removeBubble: (id: string) => void;
    updateBubble: (id: string, updates: any) => void;
    currentPage: any;
    updatePage: (id: string, updates: any) => void;
    addBubble: (props: any) => void;
    currentProjectPath: string | null;
    selectedMaterial: any;
    removeMaterial: (id: string) => void;
    updateMaterial: (id: string, updates: any) => void;
    addMaterial: (props: any) => void;
}
interface DirectionButtonProps {
    dir: FadeDirection
    icon: React.ReactNode
    current: FadeDirection | undefined
    onSelect: (dir: FadeDirection) => void
}

const DirectionButton: React.FC<DirectionButtonProps> = ({ dir, icon, current, onSelect }) => (
    <button
        onClick={() => onSelect(dir)}
        title={dir === 'none' ? 'None' : dir.charAt(0).toUpperCase() + dir.slice(1)}
        className={`w-full aspect-square flex items-center justify-center rounded border transition-all ${current === dir ? 'bg-blue-600 border-blue-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'}`}
    >
        {icon}
    </button>
)

const SidebarRight: React.FC<SidebarRightProps> = ({
    currentPageId,
    selectedPanel,
    removePanel,
    updatePanel,
    selectedBubble,
    removeBubble,
    updateBubble,
    currentPage,
    updatePage,
    addBubble,
    currentProjectPath,
    selectedMaterial,
    removeMaterial,
    updateMaterial,
    addMaterial
}) => {
    const { pages } = useMangaStore()
    const handleImageUpload = async () => {
        if (!window.electron || !currentProjectPath) return
        const sourcePath = await window.electron.selectFile()
        if (sourcePath) {
            try {
                const projectLocalPath = await window.electron.copyFileToProject(currentProjectPath, sourcePath)
                updatePanel(selectedPanel.id, {
                    imagePath: projectLocalPath,
                    imageX: selectedPanel.width / 2,
                    imageY: selectedPanel.height / 2,
                    imageScale: 1,
                    imageRotation: 0
                })
            } catch (error) {
                console.error('SidebarRight: Failed to copy image to project:', error)
            }
        }
    }

    if (!currentPageId) return null

    return (
        <div className={`w-72 bg-zinc-900 border-l border-zinc-800 shrink-0 flex flex-col transition-transform ${currentPageId ? 'translate-x-0' : 'translate-x-full'} `}>
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

                        <div className="space-y-4 pt-4 border-t border-zinc-800">
                            <h3 className="text-[10px] font-bold text-zinc-600 uppercase">Border & Size</h3>
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <label className="text-[10px] text-zinc-500 uppercase">Border Width</label>
                                        <span className="text-[10px] text-blue-500 font-mono">{selectedPanel.strokeWidth}px</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="20"
                                        step="0.5"
                                        value={selectedPanel.strokeWidth}
                                        onChange={(e) => updatePanel(selectedPanel.id, { strokeWidth: parseFloat(e.target.value) })}
                                        className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] text-zinc-500 uppercase block mb-1">Width</label>
                                        <input
                                            type="number"
                                            value={selectedPanel.width}
                                            onChange={(e) => updatePanel(selectedPanel.id, { width: parseInt(e.target.value) })}
                                            className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-zinc-500 uppercase block mb-1">Height</label>
                                        <input
                                            type="number"
                                            value={selectedPanel.height}
                                            onChange={(e) => updatePanel(selectedPanel.id, { height: parseInt(e.target.value) })}
                                            className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                                        />
                                    </div>
                                </div>
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
                                    {selectedPanel.type === 'trapezoid-h' && (
                                        <div className="space-y-4">
                                            <div>
                                                <div className="flex justify-between mb-1"><label className="text-[10px] text-zinc-500 uppercase">Top Left Offset</label><span className="text-[10px] text-blue-500 font-mono">{selectedPanel.slant}px</span></div>
                                                <input type="range" min="-200" max="200" value={selectedPanel.slant} onChange={(e) => updatePanel(selectedPanel.id, { slant: parseInt(e.target.value) })} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                            </div>
                                            <div>
                                                <div className="flex justify-between mb-1"><label className="text-[10px] text-zinc-500 uppercase">Top Right Offset</label><span className="text-[10px] text-blue-500 font-mono">{selectedPanel.offsetB}px</span></div>
                                                <input type="range" min="-200" max="200" value={selectedPanel.offsetB} onChange={(e) => updatePanel(selectedPanel.id, { offsetB: parseInt(e.target.value) })} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                            </div>
                                            <div>
                                                <div className="flex justify-between mb-1"><label className="text-[10px] text-zinc-500 uppercase">Bottom Right Offset</label><span className="text-[10px] text-blue-500 font-mono">{selectedPanel.offsetC}px</span></div>
                                                <input type="range" min="-200" max="200" value={selectedPanel.offsetC} onChange={(e) => updatePanel(selectedPanel.id, { offsetC: parseInt(e.target.value) })} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                            </div>
                                            <div>
                                                <div className="flex justify-between mb-1"><label className="text-[10px] text-zinc-500 uppercase">Bottom Left Offset</label><span className="text-[10px] text-blue-500 font-mono">{selectedPanel.offsetD}px</span></div>
                                                <input type="range" min="-200" max="200" value={selectedPanel.offsetD} onChange={(e) => updatePanel(selectedPanel.id, { offsetD: parseInt(e.target.value) })} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                            </div>
                                        </div>
                                    )}
                                    {selectedPanel.type === 'trapezoid-v' && (
                                        <div className="space-y-4">
                                            <div>
                                                <div className="flex justify-between mb-1"><label className="text-[10px] text-zinc-500 uppercase">Left Top Offset</label><span className="text-[10px] text-blue-500 font-mono">{selectedPanel.slant}px</span></div>
                                                <input type="range" min="-200" max="200" value={selectedPanel.slant} onChange={(e) => updatePanel(selectedPanel.id, { slant: parseInt(e.target.value) })} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                            </div>
                                            <div>
                                                <div className="flex justify-between mb-1"><label className="text-[10px] text-zinc-500 uppercase">Left Bottom Offset</label><span className="text-[10px] text-blue-500 font-mono">{selectedPanel.offsetB}px</span></div>
                                                <input type="range" min="-200" max="200" value={selectedPanel.offsetB} onChange={(e) => updatePanel(selectedPanel.id, { offsetB: parseInt(e.target.value) })} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                            </div>
                                            <div>
                                                <div className="flex justify-between mb-1"><label className="text-[10px] text-zinc-500 uppercase">Right Bottom Offset</label><span className="text-[10px] text-blue-500 font-mono">{selectedPanel.offsetC}px</span></div>
                                                <input type="range" min="-200" max="200" value={selectedPanel.offsetC} onChange={(e) => updatePanel(selectedPanel.id, { offsetC: parseInt(e.target.value) })} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                            </div>
                                            <div>
                                                <div className="flex justify-between mb-1"><label className="text-[10px] text-zinc-500 uppercase">Right Top Offset</label><span className="text-[10px] text-blue-500 font-mono">{selectedPanel.offsetD}px</span></div>
                                                <input type="range" min="-200" max="200" value={selectedPanel.offsetD} onChange={(e) => updatePanel(selectedPanel.id, { offsetD: parseInt(e.target.value) })} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        <div className="space-y-4 pt-4 border-t border-zinc-800">
                            <h3 className="text-[10px] font-bold text-zinc-600 uppercase">Image</h3>
                            <button
                                onClick={handleImageUpload}
                                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 transition-all font-bold group"
                            >
                                <FolderOpen size={16} className="group-hover:text-blue-500 transition-colors" />
                                <span className="text-xs">画像をアップロード/変更</span>
                            </button>
                        </div>
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
                                        <input type="range" min="-180" max="180" value={selectedPanel.imageRotation ?? 0} onChange={(e) => updatePanel(selectedPanel.id, { imageRotation: parseInt(e.target.value) })} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                    </div>
                                    <div className="pt-2 grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => updatePanel(selectedPanel.id, { isGrayscale: !selectedPanel.isGrayscale })}
                                            className={`w-full py-2 px-3 rounded-lg border text-[10px] font-bold transition-all flex items-center justify-between ${selectedPanel.isGrayscale ? 'bg-zinc-100 border-zinc-200 text-zinc-900' : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'} `}
                                        >
                                            <span>グレースケール</span>
                                            <div className={`w-2 h-2 rounded-full ${selectedPanel.isGrayscale ? 'bg-zinc-900' : 'bg-zinc-700'} `} />
                                        </button>
                                        <button
                                            onClick={() => updatePanel(selectedPanel.id, { 
                                                imageFlipX: !selectedPanel.imageFlipX,
                                                imageX: selectedPanel.width / 2,
                                                imageY: selectedPanel.height / 2
                                            })}
                                            className={`w-full py-2 px-3 rounded-lg border text-[10px] font-bold transition-all flex items-center justify-between ${selectedPanel.imageFlipX ? 'bg-zinc-100 border-zinc-200 text-zinc-900' : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'} `}
                                        >
                                            <span>左右反転</span>
                                            <div className={`w-2 h-2 rounded-full ${selectedPanel.imageFlipX ? 'bg-zinc-900' : 'bg-zinc-700'} `} />
                                        </button>
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
                                            onClick={() => updatePanel(selectedPanel.id, { isAdjustingFocus: !selectedPanel.isAdjustingFocus })}
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
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Bubble Settings</h2>
                            <button
                                onClick={() => {
                                    const nextClipped = !selectedBubble.isClipped
                                    let updates: any = { isClipped: nextClipped }
                                    
                                    // If enabling clipping and no panelId is set, try to find the panel under the bubble
                                    if (nextClipped && !selectedBubble.panelId && pages.find(p => p.id === currentPageId)?.panels) {
                                        const panels = pages.find(p => p.id === currentPageId)!.panels
                                        // Find panel containing bubble center (bx, by)
                                        const bx = selectedBubble.x
                                        const by = selectedBubble.y
                                        const foundPanel = [...panels].reverse().find((p: Panel) => {
                                            return bx >= p.x && bx <= p.x + p.width && by >= p.y && by <= p.y + p.height
                                        })
                                        if (foundPanel) {
                                            updates.panelId = foundPanel.id
                                        }
                                    }
                                    updateBubble(selectedBubble.id, updates)
                                }}
                                className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all flex items-center gap-2 ${selectedBubble.isClipped ? 'bg-blue-600/10 border-blue-600/50 text-blue-400' : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'} `}
                            >
                                <Scissors size={12} />
                                <span>コマ内のみ表示</span>
                            </button>
                        </div>
                        <div>
                            <label className="text-xs text-zinc-400 block mb-2">種類</label>
                            <div className="grid grid-cols-3 gap-1">
                                {(['rounded', 'jagged', 'rect', 'rect-double', 'flash', 'shout', 'square-jagged', 'megaphone'] as const).map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => updateBubble(selectedBubble.id, { type })}
                                        className={`py-2 flex flex-col items-center gap-1 rounded border transition-all ${selectedBubble.type === type ? 'bg-blue-600 border-blue-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'} `}
                                    >
                                        {type === 'rounded' ? <Ghost size={14} /> : 
                                         type === 'jagged' ? <Maximize size={14} /> : 
                                         type === 'flash' ? <Zap size={14} /> : 
                                         type === 'shout' ? <Volume2 size={14} /> : 
                                         type === 'rect-double' ? <Layers size={14} /> : 
                                         type === 'square-jagged' ? <Grid size={14} /> : 
                                         type === 'megaphone' ? <Megaphone size={14} /> : 
                                         <Square size={14} />}
                                        <span className="text-[7px] uppercase tracking-tighter">{type === 'square-jagged' ? 'sq-jag' : type}</span>
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
                                    <optgroup label="手書き風">
                                        <option value="'Klee One', cursive">クレー One（柔らか）</option>
                                        <option value="'Yusei Magic', sans-serif">油星マジック（ペン字）</option>
                                        <option value="'Yomogi', cursive">よもぎ（手書き）</option>
                                        <option value="'Zen Kurenaido', sans-serif">禅 紅粉藤（優しい）</option>
                                        <option value="'Hachi Maru Pop', cursive">はちまるポップ（丸字）</option>
                                        <option value="'Kiwi Maru', serif">キウイ丸（丸字）</option>
                                        <option value="'Mochiy Pop P One', sans-serif">もちポップ（太め丸字）</option>
                                        <option value="'RocknRoll One', sans-serif">ロックンロール（元気）</option>
                                        <option value="'Rampart One', cursive">ランパート（輪郭）</option>
                                        <option value="'Stick', sans-serif">スティック（棒字）</option>
                                        <option value="'Train One', cursive">トレイン One（太め輪郭）</option>
                                        <option value="'Cherry Bomb One', cursive">チェリーボム（ポップ爆発）</option>
                                        <option value="'Slackside One', cursive">スラックサイド（ゆるゆる）</option>

                                        <option value="'Comic Sans MS', cursive">Comic Sans（英語手書き）</option>
                                    </optgroup>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-zinc-400 block mb-2">行間</label>
                                <div className="flex justify-between mb-1">
                                    <span className="text-[10px] text-zinc-500">間隔</span>
                                    <span className="text-[10px] text-blue-500 font-mono">{(selectedBubble.lineHeight ?? 1.4).toFixed(1)}</span>
                                </div>
                                <input
                                    type="range" min="-0.5" max="2.0" step="0.1"
                                    value={selectedBubble.lineHeight ?? 1.4}
                                    onChange={(e) => updateBubble(selectedBubble.id, { lineHeight: parseFloat(e.target.value) })}
                                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                />
                            </div>
                            {selectedBubble.type === 'megaphone' && (
                                <div className="col-span-2">
                                    <div className="flex justify-between mb-1">
                                        <label className="text-xs text-zinc-400">窄まり具合 (Narrowing)</label>
                                        <span className="text-xs text-blue-500 font-mono">{Math.round((1 - (selectedBubble.narrowRatio ?? 0.3)) * 100)}%</span>
                                    </div>
                                    <input
                                        type="range" min="0.1" max="0.9" step="0.05"
                                        value={selectedBubble.narrowRatio ?? 0.3}
                                        onChange={(e) => updateBubble(selectedBubble.id, { narrowRatio: parseFloat(e.target.value) })}
                                        className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                    />
                                </div>
                            )}
                            <div>
                                <label className="text-xs text-zinc-400 block mb-2">枠線の太さ</label>
                                <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded px-2 h-[34px]">
                                    <input
                                        type="number"
                                        min="0"
                                        max="20"
                                        step="0.1"
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
                                        className="w-full h-8 bg-transparent border-none p-0 cursor-pointer"
                                    />
                                    <div className="mt-2">
                                        <div className="flex justify-between mb-1">
                                            <span className="text-[10px] text-zinc-500 uppercase">不透明度</span>
                                            <span className="text-[10px] text-blue-500 font-mono">{Math.round((selectedBubble.backgroundOpacity ?? 1) * 100)}%</span>
                                        </div>
                                        <input
                                            type="range" min="0" max="1" step="0.05"
                                            value={selectedBubble.backgroundOpacity ?? 1}
                                            onChange={(e) => updateBubble(selectedBubble.id, { backgroundOpacity: parseFloat(e.target.value) })}
                                            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                        />
                                    </div>
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
                ) : selectedMaterial ? (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Material Settings</h2>
                            <button
                                onClick={() => {
                                    const nextClipped = !selectedMaterial.isClipped
                                    let updates: any = { isClipped: nextClipped }
                                    if (nextClipped && !selectedMaterial.panelId && pages.find(p => p.id === currentPageId)?.panels) {
                                        const panels = pages.find(p => p.id === currentPageId)!.panels
                                        const mx = selectedMaterial.x
                                        const my = selectedMaterial.y
                                        const foundPanel = [...panels].reverse().find((p: Panel) => {
                                            return mx >= p.x && mx <= p.x + p.width && my >= p.y && my <= p.y + p.height
                                        })
                                        if (foundPanel) updates.panelId = foundPanel.id
                                    }
                                    updateMaterial(selectedMaterial.id, updates)
                                }}
                                className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all flex items-center gap-2 ${selectedMaterial.isClipped ? 'bg-blue-600/10 border-blue-600/50 text-blue-400' : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'} `}
                            >
                                <Scissors size={12} />
                                <span>コマ内のみ表示</span>
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="text-xs text-zinc-400">回転</label>
                                    <span className="text-xs text-blue-500 font-mono">{Math.round(selectedMaterial.rotation || 0)}°</span>
                                </div>
                                <input
                                    type="range" min="-180" max="180"
                                    value={selectedMaterial.rotation || 0}
                                    onChange={(e) => updateMaterial(selectedMaterial.id, { rotation: parseInt(e.target.value) })}
                                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                />
                            </div>

                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="text-xs text-zinc-400">不透明度</label>
                                    <span className="text-xs text-blue-500 font-mono">{Math.round((selectedMaterial.opacity ?? 1) * 100)}%</span>
                                </div>
                                <input
                                    type="range" min="0" max="100"
                                    value={(selectedMaterial.opacity ?? 1) * 100}
                                    onChange={(e) => updateMaterial(selectedMaterial.id, { opacity: parseInt(e.target.value) / 100 })}
                                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                />
                            </div>

                            <div className="pt-2">
                                <button
                                    onClick={() => updateMaterial(selectedMaterial.id, { isGrayscale: !selectedMaterial.isGrayscale })}
                                    className={`w-full py-2 px-3 rounded-lg border text-[10px] font-bold transition-all flex items-center justify-between ${selectedMaterial.isGrayscale ? 'bg-zinc-100 border-zinc-200 text-zinc-900' : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'} `}
                                >
                                    <span>グレースケール</span>
                                    <div className={`w-2 h-2 rounded-full ${selectedMaterial.isGrayscale ? 'bg-zinc-900' : 'bg-zinc-700'} `} />
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={() => removeMaterial(selectedMaterial.id)}
                            className="w-full py-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/30 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2"
                        >
                            <Trash2 size={14} />
                            素材を削除
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
                            <button
                                onClick={async () => {
                                    if (!window.electron || !currentProjectPath) return
                                    const sourcePath = await window.electron.selectFile()
                                    if (sourcePath) {
                                        const projectLocalPath = await window.electron.copyFileToProject(currentProjectPath, sourcePath)
                                        addMaterial({ imagePath: projectLocalPath, x: 200, y: 200 })
                                    }
                                }}
                                className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold transition-all border border-zinc-700 flex items-center justify-center gap-2 group mt-2"
                            >
                                <FolderOpen size={16} className="group-hover:text-green-500 transition-colors" />
                                素材を追加 (PNG)
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default SidebarRight
