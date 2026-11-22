import React from 'react'
import { Trash2, Scissors } from 'lucide-react'
import { useMangaStore, Material } from '../../store/useMangaStore'
import { findTargetPanel } from '../utils/geometry'
import { SliderField } from './SliderField'

interface MaterialSettingsProps {
    material: Material
    updateMaterial: (id: string, updates: Partial<Material>) => void
    removeMaterial: (id: string) => void
    currentPageId: string
    currentProjectPath: string | null
}

const MaterialSettings: React.FC<MaterialSettingsProps> = ({ material, updateMaterial, removeMaterial, currentPageId, currentProjectPath }) => {
    const pages = useMangaStore((s) => s.pages)

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
                    <SliderField
                        label="回転"
                        display={<>{Math.round(material.rotation || 0)}°</>}
                        value={material.rotation || 0}
                        min={-180}
                        max={180}
                        onChange={(v) => updateMaterial(material.id, { rotation: v })}
                        variant="normal"
                        headerClassName="mb-2"
                    />
                </div>

                <div>
                    <SliderField
                        label="不透明度"
                        display={<>{Math.round((material.opacity ?? 1) * 100)}%</>}
                        value={(material.opacity ?? 1) * 100}
                        min={0}
                        max={100}
                        onChange={(v) => updateMaterial(material.id, { opacity: v / 100 })}
                        variant="normal"
                        headerClassName="mb-2"
                    />
                </div>

                <div className="pt-2 border-t border-zinc-800 space-y-3">
                    <button
                        onClick={() => updateMaterial(material.id, { aboveMosaic: !material.aboveMosaic })}
                        className={`w-full py-2 px-3 rounded-lg border text-[10px] font-bold transition-all flex items-center justify-between ${material.aboveMosaic ? 'bg-zinc-100 border-zinc-200 text-zinc-900' : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'} `}
                    >
                        <span>モザイクより前面</span>
                        <div className={`w-2 h-2 rounded-full ${material.aboveMosaic ? 'bg-zinc-900' : 'bg-zinc-700'} `} />
                    </button>
                    <button
                        onClick={() => updateMaterial(material.id, { isGrayscale: !material.isGrayscale })}
                        className={`w-full py-2 px-3 rounded-lg border text-[10px] font-bold transition-all flex items-center justify-between ${material.isGrayscale ? 'bg-zinc-100 border-zinc-200 text-zinc-900' : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'} `}
                    >
                        <span>グレースケール</span>
                        <div className={`w-2 h-2 rounded-full ${material.isGrayscale ? 'bg-zinc-900' : 'bg-zinc-700'} `} />
                    </button>
                    {material.isGrayscale && (
                        <div>
                            <SliderField
                                label="グレーの明るさ"
                                display={Math.round((material.grayscaleBrightness ?? 0) * 100)}
                                value={Math.round( Math.max(-100, Math.min(100, (material.grayscaleBrightness ?? 0) * 100)) )}
                                min={-100}
                                max={100}
                                onChange={(v) => updateMaterial(material.id, { grayscaleBrightness: v / 100 })}
                                variant="normal"
                                headerClassName="mb-2"
                            />
                            <p className="text-[10px] text-zinc-500 mt-1">左で濃く、右で薄く。右端で真っ白、左端で真っ黒。</p>
                        </div>
                    )}
                </div>
                
                <div className="pt-2 border-t border-zinc-800 space-y-3">
                    <button
                        onClick={() => updateMaterial(material.id, { outlineEnabled: !material.outlineEnabled })}
                        className={`w-full py-2 px-3 rounded-lg border text-[10px] font-bold transition-all flex items-center justify-between ${material.outlineEnabled ? 'bg-zinc-100 border-zinc-200 text-zinc-900' : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'} `}
                    >
                        <span>縁取り（アウトライン）</span>
                        <div className={`w-2 h-2 rounded-full ${material.outlineEnabled ? 'bg-zinc-900' : 'bg-zinc-700'} `} />
                    </button>
                    {material.outlineEnabled && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-zinc-400 w-10 shrink-0">色</span>
                                {(['#ffffff', '#000000'] as const).map((c) => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => updateMaterial(material.id, { outlineColor: c })}
                                        className={`flex-1 py-1 rounded text-[10px] font-bold border transition-colors ${
                                            (material.outlineColor ?? '#ffffff').toLowerCase() === c
                                                ? 'bg-blue-600 border-blue-500 text-white'
                                                : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'
                                        }`}
                                    >
                                        {c === '#ffffff' ? '白' : '黒'}
                                    </button>
                                ))}
                                <input
                                    type="color"
                                    value={material.outlineColor ?? '#ffffff'}
                                    onChange={(e) => updateMaterial(material.id, { outlineColor: e.target.value })}
                                    title="好きな色"
                                    className="w-8 h-7 shrink-0 rounded border border-zinc-700 bg-zinc-800 cursor-pointer"
                                />
                            </div>
                            <SliderField
                                label="太さ"
                                display={<>{Math.round(material.outlineWidth ?? 4)}px</>}
                                value={Math.round(material.outlineWidth ?? 4)}
                                min={1}
                                max={20}
                                onChange={(v) => updateMaterial(material.id, { outlineWidth: v })}
                                variant="normal"
                                headerClassName="mb-2"
                            />
                        </div>
                    )}
                </div>

                <div className="pt-2 border-t border-zinc-800">
                    <SliderField
                        label="白飛び除去 (Alpha Threshold)"
                        display={material.whiteAlphaThreshold ?? 250}
                        value={material.whiteAlphaThreshold ?? 250}
                        min={0}
                        max={255}
                        onChange={(v) => updateMaterial(material.id, { whiteAlphaThreshold: v })}
                        variant="normal"
                        headerClassName="mb-2"
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
