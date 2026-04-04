import React from 'react'
import { Trash2, Layers, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ArrowUpLeft, ArrowUpRight, ArrowDownLeft, ArrowDownRight, FolderOpen, ChevronsUp, ChevronsDown, CircleX } from 'lucide-react'
import { FadeDirection, Panel } from '../../store/useMangaStore'
import type { GradientType } from '../../store/types'
import { PanelTypeIcon } from '../icons/PanelTypeIcon'

const SECTION_TITLE_CLASS = 'text-xs font-bold text-zinc-100 tracking-wide bg-zinc-800/70 border border-zinc-700 rounded-md px-2 py-1 inline-block'

const PANEL_TYPE_OPTIONS = [
    { type: 'rect', label: '矩形', shortLabel: '矩形' },
    { type: 'slanted', label: '斜め', shortLabel: '斜め' },
    { type: 'trapezoid-h', label: '台形（横）', shortLabel: '台形(横)' },
    { type: 'trapezoid-v', label: '台形（縦）', shortLabel: '台形(縦)' },
    { type: 'pentagon', label: '正五角形', shortLabel: '正五角形' },
    { type: 'hexagon', label: '正六角形', shortLabel: '正六角形' },
    { type: 'circle', label: '円', shortLabel: '円' }
] as const

interface DirectionButtonProps {
    dir: FadeDirection
    icon: React.ReactNode
    current: FadeDirection | undefined
    onSelect: (dir: FadeDirection) => void
}

const DirectionButton: React.FC<DirectionButtonProps> = ({ dir, icon, current, onSelect }) => (
    <button
        onClick={() => onSelect(dir)}
        title={
            dir === 'none' ? 'クリア' :
            dir === 'top' ? '上' :
            dir === 'top-right' ? '右上' :
            dir === 'right' ? '右' :
            dir === 'bottom-right' ? '右下' :
            dir === 'bottom' ? '下' :
            dir === 'bottom-left' ? '左下' :
            dir === 'left' ? '左' :
            '左上'
        }
        className={`w-6 h-6 flex items-center justify-center rounded border transition-all ${current === dir ? 'bg-blue-600 border-blue-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'}`}
    >
        {icon}
    </button>
)

interface PanelSettingsProps {
    panel: Panel
    updatePanel: (id: string, updates: Partial<Panel>) => void
    removePanel: (id: string) => void
    reorderPanel: (id: string, action: 'front' | 'back' | 'up' | 'down') => void
    currentProjectPath: string | null
}

const PanelSettings: React.FC<PanelSettingsProps> = ({ panel, updatePanel, removePanel, reorderPanel, currentProjectPath }) => {
    const handleImageUpload = async () => {
        if (!window.electron || !currentProjectPath) return
        const sourcePath = await window.electron.selectFile()
        if (sourcePath) {
            try {
                const projectLocalPath = await window.electron.copyFileToProject(currentProjectPath, sourcePath)
                updatePanel(panel.id, {
                    imagePath: projectLocalPath,
                    imageX: panel.width / 2,
                    imageY: panel.height / 2,
                    imageScale: 1,
                    imageRotation: 0
                })
            } catch (error) {
                console.error('PanelSettings: Failed to copy image to project:', error)
            }
        }
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className={SECTION_TITLE_CLASS}>コマの形状</h2>
                    <button onClick={() => removePanel(panel.id)} className="p-1.5 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 rounded-md transition-all">
                        <Trash2 size={14} />
                    </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    {PANEL_TYPE_OPTIONS.map(({ type, label, shortLabel }) => (
                        <button
                            key={type}
                            onClick={() => updatePanel(panel.id, { type })}
                            title={label}
                            className={`py-2 px-3 rounded-lg border text-[10px] font-bold transition-all flex items-center justify-center ${panel.type === type ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/40' : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'} `}
                        >
                            <span className="inline-flex items-center justify-center gap-2">
                                <PanelTypeIcon type={type} size={16} strokeWidth={2} />
                                <span className="text-[10px] font-medium">{shortLabel}</span>
                            </span>
                        </button>
                    ))}
                </div>
                <div className="pt-4">
                    <div className="flex justify-between mb-1">
                        <label className="text-[10px] text-zinc-500 uppercase">回転</label>
                        <span className="text-[10px] text-blue-500 font-mono">{panel.rotation ?? 0}°</span>
                    </div>
                    <input
                        type="range"
                        min="-180"
                        max="180"
                        value={panel.rotation ?? 0}
                        onChange={(e) => updatePanel(panel.id, { rotation: parseInt(e.target.value) })}
                        className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                </div>
            </div>

            {(panel.type === 'slanted' || panel.type === 'trapezoid-h' || panel.type === 'trapezoid-v') && (
                <div className="space-y-4 pt-4 border-t border-zinc-800">
                    <h3 className={SECTION_TITLE_CLASS}>形状調整</h3>
                    <div className="space-y-4">
                        {panel.type === 'slanted' && (
                            <div>
                                <div className="flex justify-between mb-1"><label className="text-[10px] text-zinc-500 uppercase">傾き</label><span className="text-[10px] text-blue-500 font-mono">{panel.slant}px</span></div>
                                <input type="range" min="-200" max="200" value={panel.slant} onChange={(e) => updatePanel(panel.id, { slant: parseInt(e.target.value) })} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                            </div>
                        )}
                        {panel.type === 'trapezoid-h' && (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <div className="flex justify-between mb-1"><label className="text-[10px] text-zinc-500 uppercase">左上</label><span className="text-[10px] text-blue-500 font-mono">{panel.slant}px</span></div>
                                    <input type="range" min="-200" max="200" value={panel.slant} onChange={(e) => updatePanel(panel.id, { slant: parseInt(e.target.value) })} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                </div>
                                <div>
                                    <div className="flex justify-between mb-1"><label className="text-[10px] text-zinc-500 uppercase">右上</label><span className="text-[10px] text-blue-500 font-mono">{panel.offsetB}px</span></div>
                                    <input type="range" min="-200" max="200" value={panel.offsetB} onChange={(e) => updatePanel(panel.id, { offsetB: parseInt(e.target.value) })} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                </div>
                                <div>
                                    <div className="flex justify-between mb-1"><label className="text-[10px] text-zinc-500 uppercase">右下</label><span className="text-[10px] text-blue-500 font-mono">{panel.offsetC}px</span></div>
                                    <input type="range" min="-200" max="200" value={panel.offsetC} onChange={(e) => updatePanel(panel.id, { offsetC: parseInt(e.target.value) })} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                </div>
                                <div>
                                    <div className="flex justify-between mb-1"><label className="text-[10px] text-zinc-500 uppercase">左下</label><span className="text-[10px] text-blue-500 font-mono">{panel.offsetD}px</span></div>
                                    <input type="range" min="-200" max="200" value={panel.offsetD} onChange={(e) => updatePanel(panel.id, { offsetD: parseInt(e.target.value) })} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                </div>
                            </div>
                        )}
                        {panel.type === 'trapezoid-v' && (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <div className="flex justify-between mb-1"><label className="text-[10px] text-zinc-500 uppercase">左上</label><span className="text-[10px] text-blue-500 font-mono">{panel.slant}px</span></div>
                                    <input type="range" min="-200" max="200" value={panel.slant} onChange={(e) => updatePanel(panel.id, { slant: parseInt(e.target.value) })} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                </div>
                                <div>
                                    <div className="flex justify-between mb-1"><label className="text-[10px] text-zinc-500 uppercase">左下</label><span className="text-[10px] text-blue-500 font-mono">{panel.offsetB}px</span></div>
                                    <input type="range" min="-200" max="200" value={panel.offsetB} onChange={(e) => updatePanel(panel.id, { offsetB: parseInt(e.target.value) })} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                </div>
                                <div>
                                    <div className="flex justify-between mb-1"><label className="text-[10px] text-zinc-500 uppercase">右下</label><span className="text-[10px] text-blue-500 font-mono">{panel.offsetC}px</span></div>
                                    <input type="range" min="-200" max="200" value={panel.offsetC} onChange={(e) => updatePanel(panel.id, { offsetC: parseInt(e.target.value) })} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                </div>
                                <div>
                                    <div className="flex justify-between mb-1"><label className="text-[10px] text-zinc-500 uppercase">右上</label><span className="text-[10px] text-blue-500 font-mono">{panel.offsetD}px</span></div>
                                    <input type="range" min="-200" max="200" value={panel.offsetD} onChange={(e) => updatePanel(panel.id, { offsetD: parseInt(e.target.value) })} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="space-y-4 pt-4 border-t border-zinc-800">
                <h3 className={SECTION_TITLE_CLASS}>コマの前後関係</h3>
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={() => reorderPanel(panel.id, 'front')}
                        className="py-2 px-3 rounded-lg border text-[10px] font-bold transition-all bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-700 flex items-center justify-center"
                        title="最前面へ"
                    >
                        <ChevronsUp size={16} />
                    </button>
                    <button
                        onClick={() => reorderPanel(panel.id, 'back')}
                        className="py-2 px-3 rounded-lg border text-[10px] font-bold transition-all bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-700 flex items-center justify-center"
                        title="最背面へ"
                    >
                        <ChevronsDown size={16} />
                    </button>
                    <button
                        onClick={() => reorderPanel(panel.id, 'up')}
                        className="py-2 px-3 rounded-lg border text-[10px] font-bold transition-all bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-700 flex items-center justify-center"
                        title="1つ前へ"
                    >
                        <ArrowUp size={16} />
                    </button>
                    <button
                        onClick={() => reorderPanel(panel.id, 'down')}
                        className="py-2 px-3 rounded-lg border text-[10px] font-bold transition-all bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-700 flex items-center justify-center"
                        title="1つ後ろへ"
                    >
                        <ArrowDown size={16} />
                    </button>
                </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-zinc-800">
                <h3 className={SECTION_TITLE_CLASS}>枠線</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] text-zinc-500 uppercase block mb-1">色</label>
                        <input
                            type="color"
                            value={panel.strokeColor || '#000000'}
                            onChange={(e) => updatePanel(panel.id, { strokeColor: e.target.value })}
                            className="w-full h-8 bg-zinc-900 border border-zinc-800 rounded p-1 cursor-pointer"
                        />
                    </div>
                    <div>
                        <div className="flex justify-between mb-1">
                            <label className="text-[10px] text-zinc-500 uppercase">太さ</label>
                            <span className="text-[10px] text-blue-500 font-mono">{panel.strokeWidth}px</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="20"
                            step="0.5"
                            value={panel.strokeWidth}
                            onChange={(e) => updatePanel(panel.id, { strokeWidth: parseFloat(e.target.value) })}
                            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                    </div>
                </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-zinc-800">
                <h3 className={SECTION_TITLE_CLASS}>サイズ</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] text-zinc-500 uppercase block mb-1">幅</label>
                        <input
                            type="number"
                            value={panel.width}
                            onChange={(e) => updatePanel(panel.id, { width: parseInt(e.target.value) })}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] text-zinc-500 uppercase block mb-1">高さ</label>
                        <input
                            type="number"
                            value={panel.height}
                            onChange={(e) => updatePanel(panel.id, { height: parseInt(e.target.value) })}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                        />
                    </div>
                </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-zinc-800">
                <h3 className={SECTION_TITLE_CLASS}>画像</h3>
                <button
                    onClick={handleImageUpload}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 transition-all font-bold group"
                >
                    <FolderOpen size={16} className="group-hover:text-blue-500 transition-colors" />
                    <span className="text-xs">画像をアップロード/変更</span>
                </button>
            </div>
            <div className="space-y-4 pt-4 border-t border-zinc-800">
                <h3 className={SECTION_TITLE_CLASS}>背景</h3>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] text-zinc-500 uppercase block mb-1">色</label>
                            <input
                                type="color"
                                value={panel.backgroundColor || '#ffffff'}
                                onChange={(e) => updatePanel(panel.id, { backgroundColor: e.target.value })}
                                className="w-full h-8 bg-zinc-900 border border-zinc-800 rounded p-1 cursor-pointer"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-zinc-500 uppercase block mb-1">不透明度</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="range" min="0" max="1" step="0.05"
                                    value={panel.backgroundOpacity ?? 1}
                                    onChange={(e) => updatePanel(panel.id, { backgroundOpacity: parseFloat(e.target.value) })}
                                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] text-zinc-500 uppercase block mb-1">グラデーション</label>
                        <select
                            value={panel.bgGradientType || 'none'}
                            onChange={(e) => updatePanel(panel.id, { bgGradientType: e.target.value as GradientType })}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                        >
                            <option value="none">なし</option>
                            <option value="linear">線形</option>
                            <option value="radial">放射</option>
                        </select>
                    </div>

                    {(panel.bgGradientType && panel.bgGradientType !== 'none') && (
                        <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] text-zinc-500 uppercase block mb-1">開始色</label>
                                    <input
                                        type="color"
                                        value={panel.bgGradientStartColor || panel.backgroundColor || '#ffffff'}
                                        onChange={(e) => updatePanel(panel.id, { bgGradientStartColor: e.target.value })}
                                        className="w-full h-8 bg-zinc-900 border border-zinc-800 rounded p-1 cursor-pointer"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-zinc-500 uppercase block mb-1">終了色</label>
                                    <input
                                        type="color"
                                        value={panel.bgGradientEndColor || '#ffffff'}
                                        onChange={(e) => updatePanel(panel.id, { bgGradientEndColor: e.target.value })}
                                        className="w-full h-8 bg-zinc-900 border border-zinc-800 rounded p-1 cursor-pointer"
                                    />
                                </div>
                            </div>
                            {panel.bgGradientType === 'linear' && (
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <label className="text-[10px] text-zinc-500 uppercase">回転</label>
                                        <span className="text-[10px] text-blue-500 font-mono">{panel.bgGradientRotation ?? 0}°</span>
                                    </div>
                                    <input
                                        type="range" min="0" max="360"
                                        value={panel.bgGradientRotation ?? 0}
                                        onChange={(e) => updatePanel(panel.id, { bgGradientRotation: parseInt(e.target.value) })}
                                        className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-6 pt-4 border-t border-zinc-800">
                <h3 className={SECTION_TITLE_CLASS}>画面効果</h3>
                {panel.imagePath && (
                    <div className="animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between mb-2">
                            <label className="text-[10px] text-zinc-500 uppercase">ぼかし</label>
                            <span className="text-[10px] text-blue-500 font-mono">{panel.blurRadius ?? 0}px</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="40"
                            value={panel.blurRadius ?? 0}
                            onChange={(e) => updatePanel(panel.id, { blurRadius: parseInt(e.target.value) })}
                            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                    </div>
                )}
                {panel.imagePath && panel.isGrayscale && (
                    <div className="mt-4 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between mb-2">
                            <label className="text-[10px] text-zinc-500 uppercase">グレーの明るさ</label>
                            <span className="text-[10px] text-blue-500 font-mono">
                                {Math.round((panel.grayscaleBrightness ?? 0) * 100)}
                            </span>
                        </div>
                        <input
                            type="range"
                            min="-50"
                            max="50"
                            value={Math.round(Math.max(-50, Math.min(50, (panel.grayscaleBrightness ?? 0) * 100)))}
                            onChange={(e) =>
                                updatePanel(panel.id, {
                                    grayscaleBrightness: parseInt(e.target.value, 10) / 100
                                })
                            }
                            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <p className="text-[10px] text-zinc-500 mt-1.5 leading-relaxed">
                            左で濃く（暗く）、右で薄く（明るく）。グレースケールはコマ選択中に Shift＋画像上のツールからオンにできます。
                        </p>
                    </div>
                )}
                <div>
                    <h4 className="text-xs font-bold text-zinc-200 tracking-wide mb-3">フェードアウト</h4>
                    <div className="grid grid-cols-3 gap-1.5 w-fit mx-auto">
                        <DirectionButton dir="top-left" icon={<ArrowUpLeft size={14} />} current={panel.fadeDirection} onSelect={(dir) => updatePanel(panel.id, { fadeDirection: dir })} />
                        <DirectionButton dir="top" icon={<ArrowUp size={14} />} current={panel.fadeDirection} onSelect={(dir) => updatePanel(panel.id, { fadeDirection: dir })} />
                        <DirectionButton dir="top-right" icon={<ArrowUpRight size={14} />} current={panel.fadeDirection} onSelect={(dir) => updatePanel(panel.id, { fadeDirection: dir })} />
                        <DirectionButton dir="left" icon={<ArrowLeft size={14} />} current={panel.fadeDirection} onSelect={(dir) => updatePanel(panel.id, { fadeDirection: dir })} />
                        <DirectionButton dir="none" icon={<CircleX size={14} />} current={panel.fadeDirection} onSelect={(dir) => updatePanel(panel.id, { fadeDirection: dir })} />
                        <DirectionButton dir="right" icon={<ArrowRight size={14} />} current={panel.fadeDirection} onSelect={(dir) => updatePanel(panel.id, { fadeDirection: dir })} />
                        <DirectionButton dir="bottom-left" icon={<ArrowDownLeft size={14} />} current={panel.fadeDirection} onSelect={(dir) => updatePanel(panel.id, { fadeDirection: dir })} />
                        <DirectionButton dir="bottom" icon={<ArrowDown size={14} />} current={panel.fadeDirection} onSelect={(dir) => updatePanel(panel.id, { fadeDirection: dir })} />
                        <DirectionButton dir="bottom-right" icon={<ArrowDownRight size={14} />} current={panel.fadeDirection} onSelect={(dir) => updatePanel(panel.id, { fadeDirection: dir })} />
                    </div>
                </div>

                {panel.fadeDirection && panel.fadeDirection !== 'none' && (
                    <div className="animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between mb-2">
                            <label className="text-[10px] text-zinc-500 uppercase">フェードの強さ</label>
                            <span className="text-[10px] text-blue-500 font-mono">{Math.round((panel.fadeStrength ?? 0.4) * 100)}%</span>
                        </div>
                        <input type="range" min="10" max="100" value={(panel.fadeStrength ?? 0.4) * 100} onChange={(e) => updatePanel(panel.id, { fadeStrength: parseInt(e.target.value) / 100 })} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                    </div>
                )}

                <div className="pt-2 space-y-4">
                    <div>
                        <button
                            onClick={() => updatePanel(panel.id, { hasFocusLines: !panel.hasFocusLines })}
                            className={`w-full py-2 px-3 rounded-lg border text-[10px] font-bold transition-all flex items-center justify-between ${panel.hasFocusLines ? 'bg-blue-600/10 border-blue-600/50 text-blue-400' : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'} `}
                        >
                            <span>集中線エフェクト</span>
                            <div className={`w-2 h-2 rounded-full ${panel.hasFocusLines ? 'bg-blue-400 animate-pulse' : 'bg-zinc-700'} `} />
                        </button>

                        {panel.hasFocusLines && (
                            <div className="mt-4 space-y-4 p-3 bg-zinc-800/50 rounded-lg border border-zinc-800 animate-in fade-in slide-in-from-top-2 duration-200" style={{ zIndex: 10 }}>
                                <button
                                    onClick={() => updatePanel(panel.id, { isAdjustingFocus: !panel.isAdjustingFocus })}
                                    className={`w-full py-1.5 rounded text-[10px] font-bold transition-all ${panel.isAdjustingFocus ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'bg-zinc-700 text-zinc-400 hover:text-white'} `}
                                >
                                    {panel.isAdjustingFocus ? '中心位置を決定' : '中心位置を調整'}
                                </button>
                                <div>
                                    <div className="flex justify-between mb-1"><label className="text-[8px] text-zinc-500 uppercase">密度 (Density)</label><span className="text-[8px] text-blue-500 font-mono">{panel.focusDensity}</span></div>
                                    <input type="range" min="20" max="800" value={panel.focusDensity ?? 100} onChange={(e) => updatePanel(panel.id, { focusDensity: parseInt(e.target.value) })} className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                </div>
                                <div>
                                    <div className="flex justify-between mb-1"><label className="text-[8px] text-zinc-500 uppercase">太さ (Width)</label><span className="text-[8px] text-blue-500 font-mono">{panel.focusWidth}px</span></div>
                                    <input type="range" min="0.5" max="5" step="0.5" value={panel.focusWidth ?? 1} onChange={(e) => updatePanel(panel.id, { focusWidth: parseFloat(e.target.value) })} className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                </div>
                                <div>
                                    <div className="flex justify-between mb-1"><label className="text-[8px] text-zinc-500 uppercase">中心半径 (Radius)</label><span className="text-[8px] text-blue-500 font-mono">{panel.focusRadius}px</span></div>
                                    <input type="range" min="0" max="300" value={panel.focusRadius ?? 50} onChange={(e) => updatePanel(panel.id, { focusRadius: parseInt(e.target.value) })} className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                </div>
                            </div>
                        )}
                    </div>

                    <div>
                        <button
                            onClick={() => updatePanel(panel.id, { hasRainEffect: !panel.hasRainEffect })}
                            className={`w-full py-2 px-3 rounded-lg border text-[10px] font-bold transition-all flex items-center justify-between ${panel.hasRainEffect ? 'bg-blue-600/10 border-blue-600/50 text-blue-400' : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'} `}
                        >
                            <span>雨エフェクト</span>
                            <div className={`w-2 h-2 rounded-full ${panel.hasRainEffect ? 'bg-blue-400 animate-pulse' : 'bg-zinc-700'} `} />
                        </button>

                        {panel.hasRainEffect && (
                            <div className="mt-4 space-y-4 p-3 bg-zinc-800/50 rounded-lg border border-zinc-800 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div>
                                    <div className="flex justify-between mb-1"><label className="text-[8px] text-zinc-500 uppercase">密度 (Density)</label><span className="text-[8px] text-blue-500 font-mono">{panel.rainDensity}</span></div>
                                    <input type="range" min="20" max="500" value={panel.rainDensity ?? 100} onChange={(e) => updatePanel(panel.id, { rainDensity: parseInt(e.target.value) })} className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                </div>
                                <div>
                                    <div className="flex justify-between mb-1"><label className="text-[8px] text-zinc-500 uppercase">不透明度 (Opacity)</label><span className="text-[8px] text-blue-500 font-mono">{Math.round((panel.rainOpacity ?? 0.3) * 100)}%</span></div>
                                    <input type="range" min="0" max="1" step="0.05" value={panel.rainOpacity ?? 0.3} onChange={(e) => updatePanel(panel.id, { rainOpacity: parseFloat(e.target.value) })} className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PanelSettings
