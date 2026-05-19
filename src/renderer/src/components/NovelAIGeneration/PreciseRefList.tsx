import React from 'react'
import { Trash2, Plus, Image as ImageIcon } from 'lucide-react'
import type { PreciseReferenceEntry, PreciseRefType } from '../../store/types'
import { MAX_PRECISE_REFS, type PreciseRefCandidate } from './types'

type Props = {
    preciseList: PreciseReferenceEntry[]
    candidates: PreciseRefCandidate[]
    onAdd: (cand: PreciseRefCandidate) => void
    onRemove: (entry: PreciseReferenceEntry) => void
    onUpdate: (idx: number, patch: Partial<PreciseReferenceEntry>) => void
    resolveUrl: (entry: PreciseReferenceEntry) => string
}

export const PreciseRefList: React.FC<Props> = ({
    preciseList,
    candidates,
    onAdd,
    onRemove,
    onUpdate,
    resolveUrl
}) => {
    const isCandidateSelected = (cand: PreciseRefCandidate): boolean =>
        preciseList.some((r) => r.source === cand.source && r.id === cand.id)

    return (
        <div className="border-t border-zinc-800 pt-4 space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
                    合成出力 精密参照
                </label>
                <span className="text-[10px] text-zinc-500">
                    精密参照 合計 {preciseList.length}/{MAX_PRECISE_REFS} 枚 ・ +5 Anlas/枚
                </span>
            </div>

            {preciseList.length > 0 && (
                <div className="space-y-2">
                    {preciseList.map((entry, idx) => {
                        const url = resolveUrl(entry)
                        return (
                            <div
                                key={`${entry.source}:${entry.id}`}
                                className="flex gap-3 p-2 rounded-lg bg-zinc-800 border border-zinc-700"
                            >
                                <div className="w-20 h-20 bg-zinc-950 rounded overflow-hidden shrink-0">
                                    {url ? (
                                        <img src={url} alt="" className="w-full h-full object-cover" />
                                    ) : null}
                                </div>
                                <div className="flex-1 min-w-0 space-y-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="text-[11px] text-zinc-400 truncate">
                                            {entry.source === 'character-image' ? 'キャラ画像' : '合成出力'}・
                                            {entry.id.split('/').pop()}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => onRemove(entry)}
                                            className="text-zinc-500 hover:text-red-400"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        {(['character', 'style', 'character&style'] as PreciseRefType[]).map((t) => (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() => onUpdate(idx, { type: t })}
                                                className={`py-1 rounded text-[10px] font-bold border ${
                                                    entry.type === t
                                                        ? 'bg-blue-600 border-blue-500 text-white'
                                                        : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-zinc-200'
                                                }`}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                                        <span className="w-14">strength</span>
                                        <input
                                            type="range"
                                            min={0}
                                            max={1}
                                            step={0.05}
                                            value={entry.strength}
                                            onChange={(e) => onUpdate(idx, { strength: Number(e.target.value) })}
                                            className="flex-1"
                                        />
                                        <span className="w-8 text-right font-mono text-zinc-200">{entry.strength.toFixed(2)}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                                        <span className="w-14">fidelity</span>
                                        <input
                                            type="range"
                                            min={0}
                                            max={1}
                                            step={0.05}
                                            value={entry.fidelity}
                                            onChange={(e) => onUpdate(idx, { fidelity: Number(e.target.value) })}
                                            className="flex-1"
                                        />
                                        <span className="w-8 text-right font-mono text-zinc-200">{entry.fidelity.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {preciseList.length < MAX_PRECISE_REFS && (
                <div className="pt-1">
                    <div className="text-[10px] text-zinc-500 mb-1.5">追加できる合成出力</div>
                    {candidates.length === 0 ? (
                        <div className="text-[11px] text-zinc-600">合成出力なし（背景＋人物の合成ツールから出力すると候補に出ます）</div>
                    ) : (
                        <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto pr-1">
                            {candidates.map((cand) => {
                                const selected = isCandidateSelected(cand)
                                return (
                                    <button
                                        key={cand.key}
                                        type="button"
                                        onClick={() => onAdd(cand)}
                                        disabled={selected}
                                        className={`relative rounded border overflow-hidden aspect-square ${
                                            selected
                                                ? 'border-indigo-500 opacity-50 cursor-not-allowed'
                                                : 'border-zinc-700 hover:border-indigo-500'
                                        }`}
                                        title={`${cand.subLabel ?? ''} / ${cand.label}`}
                                    >
                                        {cand.url ? (
                                            <img src={cand.url} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-zinc-600">
                                                <ImageIcon size={14} />
                                            </div>
                                        )}
                                        {!selected && (
                                            <div className="absolute inset-0 flex items-end justify-end p-1 opacity-0 hover:opacity-100 bg-black/50 transition-opacity">
                                                <Plus size={14} className="text-white" />
                                            </div>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
