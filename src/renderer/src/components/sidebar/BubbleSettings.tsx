import React from 'react'
import { Trash2, Type, Palette, Move, Scissors } from 'lucide-react'
import { BubbleTypeIcon } from '../icons/BubbleTypeIcon'
import { BUBBLE_TYPE_LABELS, BUBBLE_TYPE_ORDER } from '../icons/bubbleTypeMeta'
import { useMangaStore } from '../../store/useMangaStore'
import { findTargetPanel } from '../utils/geometry'

const SECTION_TITLE_CLASS =
    'text-xs font-bold text-zinc-100 tracking-wide bg-zinc-800/70 border border-zinc-700 rounded-md px-2 py-1 inline-block'

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

                        if (nextClipped && !bubble.panelId && pages.find((p) => p.id === currentPageId)?.panels) {
                            const panels = pages.find((p) => p.id === currentPageId)!.panels
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

            <div className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                <h3 className={SECTION_TITLE_CLASS}>吹き出しの形状</h3>

                <div>
                    <label className="text-xs text-zinc-400 block mb-2">種類</label>
                    <div className="grid grid-cols-3 gap-1">
                        {BUBBLE_TYPE_ORDER.map((type) => (
                            <button
                                key={type}
                                onClick={() => updateBubble(bubble.id, { type })}
                                className={`py-2 flex flex-col items-center gap-1 rounded border transition-all ${bubble.type === type ? 'bg-blue-600 border-blue-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'} `}
                            >
                                <BubbleTypeIcon type={type} size={14} />
                                <span className="text-[7px] tracking-tighter leading-tight text-center px-0.5">
                                    {BUBBLE_TYPE_LABELS[type]}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

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

                <div>
                    <div className="flex justify-between mb-1">
                        <label className="text-xs text-zinc-400">変形の強さ</label>
                        <span className="text-xs text-blue-500 font-mono">{Math.round((bubble.deformation ?? 1) * 100)}%</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="3"
                        step="0.1"
                        value={bubble.deformation ?? 1}
                        onChange={(e) => updateBubble(bubble.id, { deformation: parseFloat(e.target.value) })}
                        className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                </div>

                {(bubble.type === 'jagged' || bubble.type === 'flash') && (
                    <div>
                        <div className="flex justify-between mb-1">
                            <label className="text-xs text-zinc-400">ギザの数</label>
                            <span className="text-xs text-blue-500 font-mono">{bubble.spikeCount ?? 36}</span>
                        </div>
                        <input
                            type="range"
                            min="8"
                            max="100"
                            step="1"
                            value={bubble.spikeCount ?? 36}
                            onChange={(e) => updateBubble(bubble.id, { spikeCount: parseInt(e.target.value) })}
                            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                    </div>
                )}

                {bubble.type === 'flash' && (
                    <div>
                        <div className="flex justify-between mb-1">
                            <label className="text-xs text-zinc-400">集中線の長さ</label>
                            <span className="text-xs text-blue-500 font-mono">{Math.round((bubble.flashLength ?? 1) * 100)}%</span>
                        </div>
                        <input
                            type="range"
                            min="0.1"
                            max="5"
                            step="0.1"
                            value={bubble.flashLength ?? 1}
                            onChange={(e) => updateBubble(bubble.id, { flashLength: parseFloat(e.target.value) })}
                            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                    </div>
                )}

                {bubble.type === 'megaphone' && (
                    <div>
                        <div className="flex justify-between mb-1">
                            <label className="text-xs text-zinc-400">下辺の狭さ</label>
                            <span className="text-xs text-blue-500 font-mono">{Math.round((1 - (bubble.narrowRatio ?? 0.3)) * 100)}%</span>
                        </div>
                        <input
                            type="range"
                            min="0.1"
                            max="0.9"
                            step="0.05"
                            value={bubble.narrowRatio ?? 0.3}
                            onChange={(e) => updateBubble(bubble.id, { narrowRatio: parseFloat(e.target.value) })}
                            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                    </div>
                )}

                <div className="pt-2 border-t border-zinc-800 space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-zinc-300">しっぽの設定</span>
                        <button
                            type="button"
                            onClick={() => updateBubble(bubble.id, { tailX: 0, tailY: 0, tailControlX: 0, tailControlY: 0 })}
                            className="text-[10px] text-zinc-500 hover:text-white transition-colors"
                        >
                            リセット
                        </button>
                    </div>

                    {bubble.type === 'rounded' && (
                        <div className="pb-2 border-b border-zinc-900">
                            <label className="text-[10px] text-zinc-500 block mb-2">しっぽの形状</label>
                            <div className="flex gap-1">
                                <button
                                    type="button"
                                    onClick={() => updateBubble(bubble.id, { tailType: 'point' })}
                                    className={`flex-1 py-1.5 rounded text-[10px] font-bold transition-all ${bubble.tailType !== 'thought' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'} `}
                                >
                                    通常
                                </button>
                                <button
                                    type="button"
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
                            <span className="text-[10px] text-zinc-500">根元の幅</span>
                            <span className="text-[10px] text-zinc-400 font-mono">{bubble.tailWidth || 20}px</span>
                        </div>
                        <input
                            type="range"
                            min="2"
                            max="100"
                            step="1"
                            value={bubble.tailWidth || 20}
                            onChange={(e) => updateBubble(bubble.id, { tailWidth: parseInt(e.target.value) })}
                            className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-500"
                        />
                    </div>
                </div>
            </div>

            <div className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                <div className="flex items-center justify-between gap-3">
                    <h3 className={SECTION_TITLE_CLASS}>テキスト</h3>
                    <button
                        type="button"
                        onClick={() => updateBubble(bubble.id, { isVertical: !bubble.isVertical })}
                        className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${bubble.isVertical ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'} `}
                    >
                        {bubble.isVertical ? '縦書き' : '横書き'}
                    </button>
                </div>

                <div>
                    <label className="text-xs text-zinc-400 block mb-2">本文</label>
                    <textarea
                        value={bubble.text}
                        onChange={(e) => updateBubble(bubble.id, { text: e.target.value })}
                        className="w-full h-24 bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-blue-500/50 resize-none"
                        placeholder="セリフを入力..."
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs text-zinc-400 block mb-2">文字サイズ</label>
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
                        <label className="text-xs text-zinc-400 block mb-2">縁取りの太さ</label>
                        <div className="flex justify-between mb-1">
                            <span className="text-[10px] text-zinc-500">太さ</span>
                            <span className="text-[10px] text-blue-500 font-mono">{bubble.textStrokeWidth ?? 0}px</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="10"
                            step="0.5"
                            value={bubble.textStrokeWidth ?? 0}
                            onChange={(e) => updateBubble(bubble.id, { textStrokeWidth: parseFloat(e.target.value) })}
                            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-zinc-400 block mb-2">縁取りの色</label>
                        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded px-2 h-[34px]">
                            <input
                                type="color"
                                value={bubble.textStrokeColor ?? '#ffffff'}
                                onChange={(e) => updateBubble(bubble.id, { textStrokeColor: e.target.value })}
                                className="w-full h-5 bg-transparent border-none p-0 cursor-pointer"
                            />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs text-zinc-400 block mb-2">太さ</label>
                        <button
                            type="button"
                            onClick={() => {
                                const cur = (bubble.textWeightLevel ?? (bubble.fontWeight === 'bold' ? 1 : 0)) as 0 | 1 | 2
                                const next = ((cur + 1) % 3) as 0 | 1 | 2
                                updateBubble(bubble.id, { textWeightLevel: next, fontWeight: next === 0 ? 'normal' : 'bold' })
                            }}
                            className={`w-full py-2 rounded text-xs font-bold transition-colors ${(bubble.textWeightLevel ?? (bubble.fontWeight === 'bold' ? 1 : 0)) > 0 ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'} `}
                        >
                            {((bubble.textWeightLevel ?? (bubble.fontWeight === 'bold' ? 1 : 0)) as 0 | 1 | 2) === 2
                                ? '極太'
                                : ((bubble.textWeightLevel ?? (bubble.fontWeight === 'bold' ? 1 : 0)) as 0 | 1 | 2) === 1
                                    ? '太字'
                                    : '標準'}
                        </button>
                    </div>
                    <div>
                        <label className="text-xs text-zinc-400 block mb-2">掠れ</label>
                        <div className="flex justify-between mb-1">
                            <span className="text-[10px] text-zinc-500">強さ</span>
                            <span className="text-[10px] text-blue-500 font-mono">{Math.round((bubble.textRoughness ?? 0) * 100)}%</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={bubble.textRoughness ?? 0}
                            onChange={(e) => updateBubble(bubble.id, { textRoughness: parseFloat(e.target.value) })}
                            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
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
                    <div className="col-span-2 grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-zinc-400 block mb-2">行間</label>
                            <div className="flex justify-between mb-1">
                                <span className="text-[10px] text-zinc-500">間隔</span>
                                <span className="text-[10px] text-blue-500 font-mono">{(bubble.lineHeight ?? 1.0).toFixed(1)}</span>
                            </div>
                            <input
                                type="range"
                                min="0.0"
                                max="2.0"
                                step="0.1"
                                value={bubble.lineHeight ?? 1.0}
                                onChange={(e) => updateBubble(bubble.id, { lineHeight: parseFloat(e.target.value) })}
                                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-zinc-400 block mb-2">文字間</label>
                            <div className="flex justify-between mb-1">
                                <span className="text-[10px] text-zinc-500">間隔</span>
                                <span className="text-[10px] text-blue-500 font-mono">{bubble.letterSpacing ?? 0}px</span>
                            </div>
                            <input
                                type="range"
                                min="-5"
                                max="20"
                                step="1"
                                value={bubble.letterSpacing ?? 0}
                                onChange={(e) => updateBubble(bubble.id, { letterSpacing: parseInt(e.target.value) })}
                                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                <h3 className={SECTION_TITLE_CLASS}>背景・透明度</h3>
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
                                <span className="text-[10px] text-zinc-500">背景の不透明度</span>
                                <span className="text-[10px] text-blue-500 font-mono">{Math.round((bubble.backgroundOpacity ?? 1) * 100)}%</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={bubble.backgroundOpacity ?? 1}
                                onChange={(e) => updateBubble(bubble.id, { backgroundOpacity: parseFloat(e.target.value) })}
                                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-zinc-400 block mb-2">枠線の色</label>
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
                        <label className="text-xs text-zinc-400">全体の不透明度</label>
                        <span className="text-xs text-blue-500 font-mono">{Math.round(bubble.opacity * 100)}%</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={bubble.opacity}
                        onChange={(e) => updateBubble(bubble.id, { opacity: parseFloat(e.target.value) })}
                        className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                </div>
            </div>

            <button
                type="button"
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
