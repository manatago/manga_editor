import React from 'react'
import { FolderOpen, MessageSquare } from 'lucide-react'

interface PageSettingsProps {
    currentPage: any
    currentPageId: string
    updatePage: (id: string, updates: any) => void
    addBubble: (props: any) => void
    addMaterial: (props: any) => void
    currentProjectPath: string | null
}

const PageSettings: React.FC<PageSettingsProps> = ({ currentPage, currentPageId, updatePage, addBubble, addMaterial, currentProjectPath }) => {
    return (
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
