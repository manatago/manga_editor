import React from 'react'
import { FolderOpen, MessageSquare } from 'lucide-react'

const PAGE_SIZE_PRESETS = [
    { id: 'manga-default', label: '漫画野郎標準 (840 x 1188)', w: 840, h: 1188 },
    { id: 'a4-portrait', label: 'A4 縦 (794 x 1123)', w: 794, h: 1123 },
    { id: 'b5-portrait', label: 'B5 縦 (728 x 1031)', w: 728, h: 1031 },
    { id: 'webtoon', label: 'Webtoon 縦長 (1080 x 1920)', w: 1080, h: 1920 }
] as const

interface PageSettingsProps {
    currentPage: any
    currentPageId: string
    updatePage: (id: string, updates: any) => void
    addBubble: (props: any) => void
    addMaterial: (props: any) => void
    currentProjectPath: string | null
}

const PageSettings: React.FC<PageSettingsProps> = ({ currentPage, currentPageId, updatePage, addBubble, addMaterial, currentProjectPath }) => {
    const pageWidth = Math.max(400, Math.round(currentPage?.pageWidth ?? 840))
    const pageHeight = Math.max(400, Math.round(currentPage?.pageHeight ?? 1188))

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            <div>
                <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Page Settings</h2>
                <div className="space-y-6">
                    <div>
                        <label className="text-xs text-zinc-400 block mb-3">キャンバスサイズ</label>
                        <div className="grid grid-cols-2 gap-2">
                            {PAGE_SIZE_PRESETS.map((preset) => (
                                <button
                                    key={preset.id}
                                    onClick={() => currentPageId && updatePage(currentPageId, { pageWidth: preset.w, pageHeight: preset.h })}
                                    className={`text-left px-3 py-2 rounded-lg border text-[11px] transition-all ${
                                        pageWidth === preset.w && pageHeight === preset.h
                                            ? 'border-blue-500/60 bg-blue-500/10 text-blue-300'
                                            : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700'
                                    }`}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-3">
                            <div>
                                <label className="text-[10px] text-zinc-500 uppercase block mb-1">幅 (px)</label>
                                <input
                                    type="number"
                                    min={400}
                                    max={4000}
                                    value={pageWidth}
                                    onChange={(e) => currentPageId && updatePage(currentPageId, { pageWidth: Math.max(400, Number(e.target.value) || 400) })}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-zinc-500 uppercase block mb-1">高さ (px)</label>
                                <input
                                    type="number"
                                    min={400}
                                    max={8000}
                                    value={pageHeight}
                                    onChange={(e) => currentPageId && updatePage(currentPageId, { pageHeight: Math.max(400, Number(e.target.value) || 400) })}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                                />
                            </div>
                        </div>
                        <div className="mt-4 pt-3 border-t border-zinc-800 space-y-3">
                            <label className="flex items-center justify-between gap-3 text-xs text-zinc-300">
                                <span>グリッド表示・スナップ</span>
                                <button
                                    type="button"
                                    onClick={() => currentPageId && updatePage(currentPageId, { gridEnabled: !currentPage?.gridEnabled })}
                                    className={`px-2 py-1 rounded border text-[10px] transition-all ${
                                        currentPage?.gridEnabled
                                            ? 'bg-blue-600/20 border-blue-500/60 text-blue-300'
                                            : 'bg-zinc-900 border-zinc-700 text-zinc-400'
                                    }`}
                                >
                                    {currentPage?.gridEnabled ? 'ON' : 'OFF'}
                                </button>
                            </label>
                            <div>
                                <div className="flex justify-between mb-1">
                                    <label className="text-[10px] text-zinc-500 uppercase">グリッド間隔</label>
                                    <span className="text-[10px] text-blue-500 font-mono">{Math.max(8, Math.round(currentPage?.gridSize ?? 24))}px</span>
                                </div>
                                <input
                                    type="range"
                                    min="8"
                                    max="200"
                                    step="2"
                                    value={Math.max(8, Math.round(currentPage?.gridSize ?? 24))}
                                    onChange={(e) => currentPageId && updatePage(currentPageId, { gridSize: Math.max(8, Number(e.target.value) || 24) })}
                                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                />
                            </div>
                        </div>
                    </div>

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
                        <div className="mt-4 space-y-4">
                            <div>
                                <label className="text-[10px] text-zinc-500 uppercase block mb-1">Custom Color</label>
                                <input
                                    type="color"
                                    value={currentPage?.backgroundColor || '#ffffff'}
                                    onChange={(e) => currentPageId && updatePage(currentPageId, { backgroundColor: e.target.value })}
                                    className="w-full h-8 bg-zinc-900 border border-zinc-800 rounded p-1 cursor-pointer"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="text-xs text-zinc-400">背景不透明度</label>
                                    <span className="text-xs text-blue-500 font-mono">{Math.round((currentPage?.backgroundOpacity ?? 1) * 100)}%</span>
                                </div>
                                <input
                                    type="range" min="0" max="1" step="0.05"
                                    value={currentPage?.backgroundOpacity ?? 1}
                                    onChange={(e) => currentPageId && updatePage(currentPageId, { backgroundOpacity: parseFloat(e.target.value) })}
                                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                />
                            </div>

                            <div className="pt-2 border-t border-zinc-800">
                                <label className="text-[10px] text-zinc-500 uppercase block mb-2">Gradient</label>
                                <select
                                    value={currentPage?.bgGradientType || 'none'}
                                    onChange={(e) => currentPageId && updatePage(currentPageId, { bgGradientType: e.target.value })}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                                >
                                    <option value="none">None</option>
                                    <option value="linear">Linear</option>
                                    <option value="radial">Radial</option>
                                </select>
                            </div>

                            {(currentPage?.bgGradientType && currentPage?.bgGradientType !== 'none') && (
                                <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] text-zinc-500 uppercase block mb-1">Start Color</label>
                                            <input
                                                type="color"
                                                value={currentPage.bgGradientStartColor || currentPage.backgroundColor || '#ffffff'}
                                                onChange={(e) => currentPageId && updatePage(currentPageId, { bgGradientStartColor: e.target.value })}
                                                className="w-full h-8 bg-zinc-900 border border-zinc-800 rounded p-1 cursor-pointer"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-zinc-500 uppercase block mb-1">End Color</label>
                                            <input
                                                type="color"
                                                value={currentPage.bgGradientEndColor || '#ffffff'}
                                                onChange={(e) => currentPageId && updatePage(currentPageId, { bgGradientEndColor: e.target.value })}
                                                className="w-full h-8 bg-zinc-900 border border-zinc-800 rounded p-1 cursor-pointer"
                                            />
                                        </div>
                                    </div>
                                    {currentPage.bgGradientType === 'linear' && (
                                        <div>
                                            <div className="flex justify-between mb-1">
                                                <label className="text-[10px] text-zinc-500 uppercase">Rotation</label>
                                                <span className="text-[10px] text-blue-500 font-mono">{currentPage.bgGradientRotation ?? 0}°</span>
                                            </div>
                                            <input
                                                type="range" min="0" max="360"
                                                value={currentPage.bgGradientRotation ?? 0}
                                                onChange={(e) => currentPageId && updatePage(currentPageId, { bgGradientRotation: parseInt(e.target.value) })}
                                                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
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
    )
}

export default PageSettings
