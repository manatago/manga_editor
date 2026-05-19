import React from 'react'
import { X, Image as ImageIcon, Check, ChevronDown, ChevronUp } from 'lucide-react'
import type {
    PreciseReferenceEntry,
    PreciseRefType,
    ReferenceCharacter
} from '../../store/types'
import { MAX_CHARACTER_REFS, MAX_PRECISE_REFS, pathFromRelative, toDisplayUrl } from './types'

type Props = {
    referenceCharacters: ReferenceCharacter[]
    selectedCharacterIds: string[]
    preciseRefs: PreciseReferenceEntry[]
    currentProjectPath: string | null
    onToggle: (id: string) => void
    onMove: (id: string, dir: -1 | 1) => void
    onTogglePreciseRef: (source: 'character-image', id: string) => void
    onUpdatePreciseRef: (source: 'character-image', id: string, patch: Partial<PreciseReferenceEntry>) => void
}

/**
 * キャラクター参照と「そのキャラの画像を精密参照に使う」を統合したセクション。
 * 1) 候補グリッドからキャラを選択 → characterRefIds に追加
 * 2) 選択中キャラのカードが下に出る → そのキャラの画像をクリックして精密参照に追加/除外
 * 3) 追加した画像は strength/fidelity/type の inline コントロールで微調整可能
 */
export const CharacterRefSelector: React.FC<Props> = ({
    referenceCharacters,
    selectedCharacterIds,
    preciseRefs,
    currentProjectPath,
    onToggle,
    onMove,
    onTogglePreciseRef,
    onUpdatePreciseRef
}) => {
    const [expanded, setExpanded] = React.useState<Set<string>>(new Set())

    const selectedCharacters: ReferenceCharacter[] = []
    for (const id of selectedCharacterIds) {
        const hit = referenceCharacters.find((c) => c.id === id)
        if (hit) selectedCharacters.push(hit)
    }

    const charImagePreciseCount = preciseRefs.filter((r) => r.source === 'character-image').length
    const totalPrecise = preciseRefs.length

    const findEntry = (charId: string, imgId: string): PreciseReferenceEntry | undefined =>
        preciseRefs.find((r) => r.source === 'character-image' && r.id === `${charId}/${imgId}`)

    const toggleExpanded = (id: string): void => {
        setExpanded((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    // 初めて選択されたキャラは展開状態にしておく（一度閉じたら以降は記憶する）
    const everSeenRef = React.useRef<Set<string>>(new Set())
    React.useEffect(() => {
        const next = new Set(everSeenRef.current)
        let changed = false
        for (const id of selectedCharacterIds) {
            if (!next.has(id)) {
                next.add(id)
                changed = true
                setExpanded((prev) => {
                    const p = new Set(prev)
                    p.add(id)
                    return p
                })
            }
        }
        if (changed) everSeenRef.current = next
    }, [selectedCharacterIds])

    return (
        <div className="border-t border-zinc-800 pt-4 space-y-3">
            <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
                    キャラクター参照（最大 {MAX_CHARACTER_REFS}、左→右に並ぶ）
                </label>
                <div className="text-[10px] text-zinc-500 flex items-center gap-2">
                    <span>{selectedCharacterIds.length}/{MAX_CHARACTER_REFS} 人</span>
                    <span className="text-zinc-700">・</span>
                    <span>精密参照: {charImagePreciseCount} 枚（合計 {totalPrecise}/{MAX_PRECISE_REFS}）</span>
                </div>
            </div>

            {selectedCharacters.length > 0 && (
                <div className="space-y-2">
                    {selectedCharacters.map((c, idx) => {
                        const isExpanded = expanded.has(c.id)
                        const selectedImgEntries = preciseRefs.filter(
                            (r) => r.source === 'character-image' && r.id.startsWith(`${c.id}/`)
                        )
                        const headerThumbUrl = (() => {
                            const first = c.images[0]
                            if (!first) return ''
                            const abs = pathFromRelative(currentProjectPath, first.relativePath)
                            return toDisplayUrl(abs)
                        })()
                        return (
                            <div
                                key={c.id}
                                className="rounded-lg bg-zinc-950 border border-indigo-500/40"
                            >
                                <div className="flex items-center gap-2 px-2 py-1.5">
                                    <span className="text-[10px] text-indigo-200 font-mono w-4 text-center">{idx + 1}</span>
                                    <div className="w-7 h-7 bg-zinc-900 rounded overflow-hidden shrink-0">
                                        {headerThumbUrl ? (
                                            <img src={headerThumbUrl} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <ImageIcon size={12} className="text-zinc-600" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-bold text-white truncate">{c.name}</div>
                                        <div className="text-[10px] text-zinc-500 truncate">
                                            {selectedImgEntries.length > 0
                                                ? `精密参照 ${selectedImgEntries.length} 枚`
                                                : c.images.length > 0
                                                  ? `画像 ${c.images.length} 枚（クリックで精密参照に追加）`
                                                  : '画像なし'}
                                        </div>
                                    </div>
                                    {c.images.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => toggleExpanded(c.id)}
                                            className="p-1 text-zinc-400 hover:text-white"
                                            title={isExpanded ? '折りたたむ' : '画像を表示'}
                                        >
                                            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                        </button>
                                    )}
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
                                        className="text-zinc-400 hover:text-red-400 p-0.5"
                                        title="外す"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>

                                {isExpanded && c.images.length > 0 && (
                                    <div className="px-2 pb-2 space-y-2">
                                        <div className="grid grid-cols-6 gap-1.5">
                                            {c.images.map((im) => {
                                                const abs = pathFromRelative(currentProjectPath, im.relativePath)
                                                const url = toDisplayUrl(abs)
                                                const entry = findEntry(c.id, im.id)
                                                const selected = !!entry
                                                const limitReached = !selected && totalPrecise >= MAX_PRECISE_REFS
                                                return (
                                                    <button
                                                        key={im.id}
                                                        type="button"
                                                        disabled={limitReached}
                                                        onClick={() => onTogglePreciseRef('character-image', `${c.id}/${im.id}`)}
                                                        className={`relative aspect-square rounded border overflow-hidden transition-colors ${
                                                            selected
                                                                ? 'border-violet-400 ring-2 ring-violet-500/60'
                                                                : limitReached
                                                                  ? 'border-zinc-800 opacity-30 cursor-not-allowed'
                                                                  : 'border-zinc-700 hover:border-violet-400'
                                                        }`}
                                                        title={im.relativePath}
                                                    >
                                                        {url ? (
                                                            <img src={url} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                                                                <ImageIcon size={12} className="text-zinc-600" />
                                                            </div>
                                                        )}
                                                        {selected && (
                                                            <div className="absolute top-0.5 right-0.5 bg-violet-500 rounded-full p-0.5">
                                                                <Check size={9} className="text-white" />
                                                            </div>
                                                        )}
                                                    </button>
                                                )
                                            })}
                                        </div>

                                        {selectedImgEntries.length > 0 && (
                                            <div className="space-y-1.5 pt-1 border-t border-zinc-800">
                                                {selectedImgEntries.map((entry) => {
                                                    const imgId = entry.id.split('/')[1]
                                                    const im = c.images.find((i) => i.id === imgId)
                                                    const url = im
                                                        ? toDisplayUrl(pathFromRelative(currentProjectPath, im.relativePath))
                                                        : ''
                                                    return (
                                                        <div
                                                            key={entry.id}
                                                            className="flex items-center gap-2 px-1.5 py-1 rounded bg-zinc-900/80"
                                                        >
                                                            <div className="w-7 h-7 rounded overflow-hidden bg-zinc-950 shrink-0">
                                                                {url && <img src={url} alt="" className="w-full h-full object-cover" />}
                                                            </div>
                                                            <div className="grid grid-cols-3 gap-0.5 shrink-0">
                                                                {(['character', 'style', 'character&style'] as PreciseRefType[]).map((t) => (
                                                                    <button
                                                                        key={t}
                                                                        type="button"
                                                                        onClick={() => onUpdatePreciseRef('character-image', entry.id, { type: t })}
                                                                        className={`px-1 py-0.5 rounded text-[9px] font-bold border ${
                                                                            entry.type === t
                                                                                ? 'bg-blue-600 border-blue-500 text-white'
                                                                                : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'
                                                                        }`}
                                                                    >
                                                                        {t === 'character' ? 'char' : t === 'style' ? 'style' : 'char+style'}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                            <div className="flex-1 min-w-0 grid grid-cols-2 gap-2 text-[10px] text-zinc-400">
                                                                <label className="flex items-center gap-1">
                                                                    <span className="w-9 shrink-0">str</span>
                                                                    <input
                                                                        type="range"
                                                                        min={0}
                                                                        max={1}
                                                                        step={0.05}
                                                                        value={entry.strength}
                                                                        onChange={(e) => onUpdatePreciseRef('character-image', entry.id, { strength: Number(e.target.value) })}
                                                                        className="flex-1"
                                                                    />
                                                                    <span className="w-7 text-right font-mono text-zinc-200">{entry.strength.toFixed(2)}</span>
                                                                </label>
                                                                <label className="flex items-center gap-1">
                                                                    <span className="w-9 shrink-0">fid</span>
                                                                    <input
                                                                        type="range"
                                                                        min={0}
                                                                        max={1}
                                                                        step={0.05}
                                                                        value={entry.fidelity}
                                                                        onChange={(e) => onUpdatePreciseRef('character-image', entry.id, { fidelity: Number(e.target.value) })}
                                                                        className="flex-1"
                                                                    />
                                                                    <span className="w-7 text-right font-mono text-zinc-200">{entry.fidelity.toFixed(2)}</span>
                                                                </label>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
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
                <div>
                    <div className="text-[10px] text-zinc-500 mb-1.5">追加するキャラを選択</div>
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
                                    disabled={limitReached || active}
                                    className={`p-2 rounded-lg border flex items-center gap-2 transition-colors ${
                                        active
                                            ? 'bg-indigo-900/30 border-indigo-700/40 text-zinc-500 cursor-default'
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
                                            {active
                                                ? '追加済み'
                                                : c.positivePrompt
                                                    ? c.positivePrompt.slice(0, 40)
                                                    : '(prompt 未設定)'}
                                        </div>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
