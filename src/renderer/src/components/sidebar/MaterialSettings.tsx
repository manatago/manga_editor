import React from 'react'
import { Trash2, Scissors } from 'lucide-react'
import { useMangaStore, Material } from '../../store/useMangaStore'
import { findTargetPanel } from '../utils/geometry'

interface MaterialSettingsProps {
    material: Material
    updateMaterial: (id: string, updates: Partial<Material>) => void
    removeMaterial: (id: string) => void
    currentPageId: string
    currentProjectPath: string | null
}

const MaterialSettings: React.FC<MaterialSettingsProps> = ({ material, updateMaterial, removeMaterial, currentPageId, currentProjectPath }) => {
    const { pages } = useMangaStore()

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Material Settings</h2>
                <button
                    onClick={() => {
                        const nextClipped = !material.isClipped
                        let updates: Partial<Material> = { isClipped: nextClipped }
                        if (nextClipped && !material.panelId && pages.find(p => p.id === currentPageId)?.panels) {
                            const panels = pages.find(p => p.id === currentPageId)!.panels
                            const centerX = material.x + (material.width || 200) / 2
                            const centerY = material.y + (material.height || 200) / 2
                            const foundPanel = findTargetPanel(centerX, centerY, panels)
                            if (foundPanel) updates.panelId = foundPanel.id
                        }
                        updateMaterial(material.id, updates)
                    }}
                    className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all flex items-center gap-2 ${material.isClipped ? 'bg-blue-600/10 border-blue-600/50 text-blue-400' : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'} `}
                >
                    <Scissors size={12} />
                    <span>コマ内のみ表示</span>
                </button>
            </div>

            <div className="space-y-4">
                <div>
                    <div className="flex justify-between mb-2">
                        <label className="text-xs text-zinc-400">回転</label>
                        <span className="text-xs text-blue-500 font-mono">{Math.round(material.rotation || 0)}°</span>
                    </div>
                    <input
                        type="range" min="-180" max="180"
                        value={material.rotation || 0}
                        onChange={(e) => updateMaterial(material.id, { rotation: parseInt(e.target.value) })}
                        className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                </div>

                <div>
                    <div className="flex justify-between mb-2">
                        <label className="text-xs text-zinc-400">不透明度</label>
                        <span className="text-xs text-blue-500 font-mono">{Math.round((material.opacity ?? 1) * 100)}%</span>
                    </div>
                    <input
                        type="range" min="0" max="100"
                        value={(material.opacity ?? 1) * 100}
                        onChange={(e) => updateMaterial(material.id, { opacity: parseInt(e.target.value) / 100 })}
                        className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                </div>

                <div className="pt-2 border-t border-zinc-800 space-y-3">
                    <button
                        onClick={() => updateMaterial(material.id, { isGrayscale: !material.isGrayscale })}
                        className={`w-full py-2 px-3 rounded-lg border text-[10px] font-bold transition-all flex items-center justify-between ${material.isGrayscale ? 'bg-zinc-100 border-zinc-200 text-zinc-900' : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'} `}
                    >
                        <span>グレースケール</span>
                        <div className={`w-2 h-2 rounded-full ${material.isGrayscale ? 'bg-zinc-900' : 'bg-zinc-700'} `} />
                    </button>
                    {material.isGrayscale && (
                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-xs text-zinc-400">グレーの明るさ</label>
                                <span className="text-xs text-blue-500 font-mono">
                                    {Math.round((material.grayscaleBrightness ?? 0) * 100)}
                                </span>
                            </div>
                            <input
                                type="range"
                                min="-50"
                                max="50"
                                value={Math.round(
                                    Math.max(-50, Math.min(50, (material.grayscaleBrightness ?? 0) * 100))
                                )}
                                onChange={(e) =>
                                    updateMaterial(material.id, {
                                        grayscaleBrightness: parseInt(e.target.value, 10) / 100
                                    })
                                }
                                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                            <p className="text-[10px] text-zinc-500 mt-1">左で濃く、右で薄く。</p>
                        </div>
                    )}
                </div>
                
                <div className="pt-2 border-t border-zinc-800">
                    <div className="flex justify-between mb-2">
                        <label className="text-xs text-zinc-400">白飛び除去 (Alpha Threshold)</label>
                        <span className="text-xs text-blue-500 font-mono">{material.whiteAlphaThreshold ?? 250}</span>
                    </div>
                    <input
                        type="range" min="0" max="255"
                        value={material.whiteAlphaThreshold ?? 250}
                        onChange={(e) => updateMaterial(material.id, { whiteAlphaThreshold: parseInt(e.target.value) })}
                        className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <p className="text-[10px] text-zinc-500 mt-1">値を下げると、より暗い白も透明になります。</p>
                </div>
            </div>

            <button
                onClick={() => removeMaterial(material.id)}
                className="w-full py-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/30 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2"
            >
                <Trash2 size={14} />
                素材を削除
            </button>
        </div>
    )
}

export default MaterialSettings
