import React from 'react'
import { X, Image as ImageIcon } from 'lucide-react'
import type { ReferenceCharacter } from '../../store/types'
import { MAX_CHARACTER_REFS, pathFromRelative, toDisplayUrl } from './types'

type Props = {
    referenceCharacters: ReferenceCharacter[]
    selectedCharacterIds: string[]
    currentProjectPath: string | null
    onToggle: (id: string) => void
    onMove: (id: string, dir: -1 | 1) => void
}

export const CharacterRefSelector: React.FC<Props> = ({
    referenceCharacters,
    selectedCharacterIds,
    currentProjectPath,
    onToggle,
    onMove
}) => {
    const selectedCharacters: ReferenceCharacter[] = []
    for (const id of selectedCharacterIds) {
        const hit = referenceCharacters.find((c) => c.id === id)
        if (hit) selectedCharacters.push(hit)
    }

    return (
        <div className="border-t border-zinc-800 pt-4 space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
                    キャラクター参照（最大 {MAX_CHARACTER_REFS}、左→右に並ぶ）
                </label>
                <span className="text-[10px] text-zinc-500">
                    {selectedCharacterIds.length}/{MAX_CHARACTER_REFS} 人
                </span>
            </div>
            {selectedCharacters.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-zinc-950 border border-zinc-800">
                    {selectedCharacters.map((c, idx) => {
                        const first = c.images[0]
                        const abs = first ? pathFromRelative(currentProjectPath, first.relativePath) : null
                        const url = toDisplayUrl(abs)
                        return (
                            <div key={c.id} className="flex items-center gap-1 bg-indigo-700/30 border border-indigo-500/60 rounded pl-1 pr-1 py-1">
                                <span className="text-[10px] text-indigo-200 font-mono w-4 text-center">{idx + 1}</span>
                                <div className="w-5 h-5 bg-zinc-900 rounded overflow-hidden shrink-0">
                                    {url && <img src={url} alt="" className="w-full h-full object-cover" />}
                                </div>
                                <span className="text-[11px] text-white max-w-[90px] truncate">{c.name}</span>
                                <button
                                    type="button"
                                    disabled={idx === 0}
                                    onClick={() => onMove(c.id, -1)}
                                    className="text-indigo-300 hover:text-white disabled:opacity-30 text-[10px] px-0.5"
                                    title="左に移動"
                                >◂</button>
                                <button
                                    type="button"
                                    disabled={idx === selectedCharacters.length - 1}
                                    onClick={() => onMove(c.id, 1)}
                                    className="text-indigo-300 hover:text-white disabled:opacity-30 text-[10px] px-0.5"
                                    title="右に移動"
                                >▸</button>
                                <button
                                    type="button"
                                    onClick={() => onToggle(c.id)}
                                    className="text-zinc-400 hover:text-red-400"
                                    title="外す"
                                >
                                    <X size={11} />
                                </button>
                            </div>
                        )
                    })}
                </div>
            )}
            {referenceCharacters.length === 0 ? (
                <div className="text-[11px] text-zinc-500 py-2">
                    参照キャラクターが登録されていません（左サイドバー → ツール → 参照キャラクター）
                </div>
            ) : (
                <div className="grid grid-cols-3 gap-2">
                    {referenceCharacters.map((c) => {
                        const first = c.images[0]
                        const abs = first ? pathFromRelative(currentProjectPath, first.relativePath) : null
                        const url = toDisplayUrl(abs)
                        const active = selectedCharacterIds.includes(c.id)
                        const limitReached = !active && selectedCharacterIds.length >= MAX_CHARACTER_REFS
                        return (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => onToggle(c.id)}
                                disabled={limitReached}
                                className={`p-2 rounded-lg border flex items-center gap-2 transition-colors ${
                                    active
                                        ? 'bg-indigo-700/40 border-indigo-500 text-white'
                                        : limitReached
                                            ? 'bg-zinc-800 border-zinc-800 text-zinc-600 cursor-not-allowed'
                                            : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white'
                                }`}
                            >
                                <div className="w-10 h-10 bg-zinc-950 rounded overflow-hidden shrink-0 flex items-center justify-center">
                                    {url ? (
                                        <img src={url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <ImageIcon size={14} className="text-zinc-600" />
                                    )}
                                </div>
                                <div className="text-left min-w-0">
                                    <div className="text-xs font-bold truncate">{c.name}</div>
                                    <div className="text-[10px] text-zinc-500 truncate">
                                        {c.positivePrompt ? c.positivePrompt.slice(0, 40) : '(prompt 未設定)'}
                                    </div>
                                </div>
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
