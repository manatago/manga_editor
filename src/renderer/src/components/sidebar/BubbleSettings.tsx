import React from 'react'
import { Trash2, Layers, Zap, Square, MessageSquare, Type, Palette, Move, Scissors, Ghost, Maximize, Volume2, Grid, Megaphone } from 'lucide-react'
import { useMangaStore } from '../../store/useMangaStore'
import { findTargetPanel } from '../utils/geometry'

interface BubbleSettingsProps {
    bubble: any
    updateBubble: (id: string, updates: any) => void
    removeBubble: (id: string) => void
    currentPageId: string
}

const BubbleSettings: React.FC<BubbleSettingsProps> = ({ bubble, updateBubble, removeBubble, currentPageId }) => {
    const { pages } = useMangaStore()

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Bubble Settings</h2>
                <button
                    onClick={() => {
                        const nextClipped = !bubble.isClipped
                        let updates: any = { isClipped: nextClipped }
                        
                        // If enabling clipping and no panelId is set, find the panel under the bubble center
                        if (nextClipped && !bubble.panelId && pages.find(p => p.id === currentPageId)?.panels) {
                            const panels = pages.find(p => p.id === currentPageId)!.panels
                            // Use visual center for more stable detection
                            const centerX = bubble.x + (bubble.width || 100) / 2
                            const centerY = bubble.y + (bubble.height || 100) / 2
                            const foundPanel = findTargetPanel(centerX, centerY, panels)
                            if (foundPanel) {
                                updates.panelId = foundPanel.id
                            }
                        }
                        updateBubble(bubble.id, updates)
                    }}
                    className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all flex items-center gap-2 ${bubble.isClipped ? 'bg-blue-600/10 border-blue-600/50 text-blue-400' : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'} `}
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
                            onClick={() => updateBubble(bubble.id, { type })}
                            className={`py-2 flex flex-col items-center gap-1 rounded border transition-all ${bubble.type === type ? 'bg-blue-600 border-blue-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'} `}
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
                        onClick={() => updateBubble(bubble.id, { isVertical: !bubble.isVertical })}
                        className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${bubble.isVertical ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'} `}
                    >
                        {bubble.isVertical ? '縦書き' : '横書き'}
                    </button>
                </div>
                <textarea
                    value={bubble.text}
                    onChange={(e) => updateBubble(bubble.id, { text: e.target.value })}
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
                            value={bubble.fontSize}
                            onChange={(e) => updateBubble(bubble.id, { fontSize: parseInt(e.target.value) })}
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
                            value={bubble.fontColor}
                            onChange={(e) => updateBubble(bubble.id, { fontColor: e.target.value })}
                            className="w-full h-5 bg-transparent border-none p-0 cursor-pointer"
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-xs text-zinc-400 block mb-2">太さ</label>
                    <button
                        onClick={() => updateBubble(bubble.id, { fontWeight: bubble.fontWeight === 'bold' ? 'normal' : 'bold' })}
                        className={`w-full py-2 rounded text-xs font-bold transition-colors ${bubble.fontWeight === 'bold' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'} `}
                    >
                        {bubble.fontWeight === 'bold' ? '太字 (Bold)' : '標準 (Normal)'}
                    </button>
                </div>
                <div>
                    <label className="text-xs text-zinc-400 block mb-2">フォント</label>
                    <select
                        value={bubble.fontFamily}
                        onChange={(e) => updateBubble(bubble.id, { fontFamily: e.target.value })}
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
                        <span className="text-[10px] text-blue-500 font-mono">{(bubble.lineHeight ?? 1.0).toFixed(1)}</span>
                    </div>
                    <input
                        type="range" min="0.0" max="2.0" step="0.1"
                        value={bubble.lineHeight ?? 1.0}
                        onChange={(e) => updateBubble(bubble.id, { lineHeight: parseFloat(e.target.value) })}
                        className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                </div>
                {bubble.type === 'megaphone' && (
                    <div className="col-span-2">
                        <div className="flex justify-between mb-1">
                            <label className="text-xs text-zinc-400">窄まり具合 (Narrowing)</label>
                            <span className="text-xs text-blue-500 font-mono">{Math.round((1 - (bubble.narrowRatio ?? 0.3)) * 100)}%</span>
                        </div>
                        <input
                            type="range" min="0.1" max="0.9" step="0.05"
                            value={bubble.narrowRatio ?? 0.3}
                            onChange={(e) => updateBubble(bubble.id, { narrowRatio: parseFloat(e.target.value) })}
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
                            value={bubble.borderWidth ?? 2}
                            onChange={(e) => updateBubble(bubble.id, { borderWidth: parseFloat(e.target.value) })}
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
                            value={bubble.backgroundColor}
                            onChange={(e) => updateBubble(bubble.id, { backgroundColor: e.target.value })}
                            className="w-full h-8 bg-transparent border-none p-0 cursor-pointer"
                        />
                        <div className="mt-2">
                            <div className="flex justify-between mb-1">
                                <span className="text-[10px] text-zinc-500 uppercase">不透明度</span>
                                <span className="text-[10px] text-blue-500 font-mono">{Math.round((bubble.backgroundOpacity ?? 1) * 100)}%</span>
                            </div>
                            <input
                                type="range" min="0" max="1" step="0.05"
                                value={bubble.backgroundOpacity ?? 1}
                                onChange={(e) => updateBubble(bubble.id, { backgroundOpacity: parseFloat(e.target.value) })}
                                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-zinc-400 block mb-2">枠線色</label>
                        <input
                            type="color"
                            value={bubble.borderColor}
                            onChange={(e) => updateBubble(bubble.id, { borderColor: e.target.value })}
                            className="w-full h-6 bg-transparent border-none p-0 cursor-pointer"
                        />
                    </div>
                </div>
                <div>
                    <div className="flex justify-between mb-2">
                        <label className="text-xs text-zinc-400">不透明度</label>
                        <span className="text-xs text-blue-500 font-mono">{Math.round(bubble.opacity * 100)}%</span>
                    </div>
                    <input
                        type="range" min="0" max="1" step="0.05"
                        value={bubble.opacity}
                        onChange={(e) => updateBubble(bubble.id, { opacity: parseFloat(e.target.value) })}
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
                                <span className="text-[10px] text-blue-500 font-mono">{bubble.textOffsetX}px</span>
                            </div>
                            <input
                                type="range" min="-100" max="100" step="1"
                                value={bubble.textOffsetX}
                                onChange={(e) => updateBubble(bubble.id, { textOffsetX: parseInt(e.target.value) })}
                                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                        </div>
                        <div>
                            <div className="flex justify-between mb-1">
                                <span className="text-[10px] text-zinc-500">Y Offset</span>
                                <span className="text-[10px] text-blue-500 font-mono">{bubble.textOffsetY}px</span>
                            </div>
                            <input
                                type="range" min="-100" max="100" step="1"
                                value={bubble.textOffsetY}
                                onChange={(e) => updateBubble(bubble.id, { textOffsetY: parseInt(e.target.value) })}
                                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                        </div>
                        <div>
                            <div className="flex justify-between mb-1">
                                <span className="text-[10px] text-zinc-500">Deformation</span>
                                <span className="text-[10px] text-blue-500 font-mono">{Math.round((bubble.deformation ?? 1) * 100)}%</span>
                            </div>
                            <input
                                type="range" min="0" max="3" step="0.1"
                                value={bubble.deformation ?? 1}
                                onChange={(e) => updateBubble(bubble.id, { deformation: parseFloat(e.target.value) })}
                                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                        </div>
                        {(bubble.type === 'jagged' || bubble.type === 'flash') && (
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <span className="text-[10px] text-zinc-500">Spikes</span>
                                        <span className="text-[10px] text-blue-500 font-mono">{bubble.spikeCount ?? 36}</span>
                                    </div>
                                    <input
                                        type="range" min="8" max="100" step="1"
                                        value={bubble.spikeCount ?? 36}
                                        onChange={(e) => updateBubble(bubble.id, { spikeCount: parseInt(e.target.value) })}
                                        className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                    />
                                </div>
                                {bubble.type === 'flash' && (
                                    <>
                                        <div>
                                            <div className="flex justify-between mb-1">
                                                <span className="text-[10px] text-zinc-500">Thickness</span>
                                                <span className="text-[10px] text-blue-500 font-mono">{bubble.borderWidth ?? 0.5}px</span>
                                            </div>
                                            <input
                                                type="range" min="0.1" max="10" step="0.1"
                                                value={bubble.borderWidth ?? 0.5}
                                                onChange={(e) => updateBubble(bubble.id, { borderWidth: parseFloat(e.target.value) })}
                                                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <div className="flex justify-between mb-1">
                                                <span className="text-[10px] text-zinc-500">Length</span>
                                                <span className="text-[10px] text-blue-500 font-mono">{Math.round((bubble.flashLength ?? 1) * 100)}%</span>
                                            </div>
                                            <input
                                                type="range" min="0.1" max="5" step="0.1"
                                                value={bubble.flashLength ?? 1}
                                                onChange={(e) => updateBubble(bubble.id, { flashLength: parseFloat(e.target.value) })}
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
                                    onClick={() => updateBubble(bubble.id, { tailX: 0, tailY: 0, tailControlX: 0, tailControlY: 0 })}
                                    className="text-[9px] text-zinc-500 hover:text-white transition-colors"
                                >
                                    Reset
                                </button>
                            </div>
                            <div className="space-y-3">
                                {bubble.type === 'rounded' && (
                                    <div className="pb-2 border-b border-zinc-900">
                                        <label className="text-[10px] text-zinc-500 block mb-2 uppercase tracking-tight">しっぽの形状</label>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => updateBubble(bubble.id, { tailType: 'point' })}
                                                className={`flex-1 py-1.5 rounded text-[10px] font-bold transition-all ${bubble.tailType !== 'thought' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'} `}
                                            >
                                                通常
                                            </button>
                                            <button
                                                onClick={() => updateBubble(bubble.id, { tailType: 'thought' })}
                                                className={`flex-1 py-1.5 rounded text-[10px] font-bold transition-all ${bubble.tailType === 'thought' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'} `}
                                            >
                                                考え事
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <span className="text-[10px] text-zinc-500">Tip Pos (X/Y)</span>
                                        <span className="text-[10px] text-blue-500 font-mono">{bubble.tailX || 0}, {bubble.tailY || 0}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            type="range" min="-300" max="300" step="1"
                                            value={bubble.tailX || 0}
                                            onChange={(e) => updateBubble(bubble.id, { tailX: parseInt(e.target.value) })}
                                            className="flex-1 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                        />
                                        <input
                                            type="range" min="-300" max="300" step="1"
                                            value={bubble.tailY || 0}
                                            onChange={(e) => updateBubble(bubble.id, { tailY: parseInt(e.target.value) })}
                                            className="flex-1 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <span className="text-[10px] text-zinc-500">Curvature (X/Y)</span>
                                        <span className="text-[10px] text-emerald-500 font-mono">{bubble.tailControlX || 0}, {bubble.tailControlY || 0}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            type="range" min="-300" max="300" step="1"
                                            value={bubble.tailControlX || 0}
                                            onChange={(e) => updateBubble(bubble.id, { tailControlX: parseInt(e.target.value) })}
                                            className="flex-1 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                        />
                                        <input
                                            type="range" min="-300" max="300" step="1"
                                            value={bubble.tailControlY || 0}
                                            onChange={(e) => updateBubble(bubble.id, { tailControlY: parseInt(e.target.value) })}
                                            className="flex-1 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <span className="text-[10px] text-zinc-500">Base Width</span>
                                        <span className="text-[10px] text-zinc-400 font-mono">{bubble.tailWidth || 20}px</span>
                                    </div>
                                    <input
                                        type="range" min="2" max="100" step="1"
                                        value={bubble.tailWidth || 20}
                                        onChange={(e) => updateBubble(bubble.id, { tailWidth: parseInt(e.target.value) })}
                                        className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-500"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <button
                onClick={() => removeBubble(bubble.id)}
                className="w-full py-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/30 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2"
            >
                <Trash2 size={14} />
                吹き出しを削除
            </button>
        </div>
    )
}

export default BubbleSettings
