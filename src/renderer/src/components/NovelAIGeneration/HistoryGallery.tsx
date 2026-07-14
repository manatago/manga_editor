import React from 'react'
import { Trash2, ImagePlus, Upload } from 'lucide-react'
import type { NovelAIHistoryEntry } from '../../store/types'
import { pathFromRelative, toDisplayUrl } from './types'

type Props = {
    history: NovelAIHistoryEntry[]
    currentProjectPath: string | null
    selectedRelativePath: string | null
    adoptedRelativePath: string | null | undefined
    busy: boolean
    /** 現在コマに乗っている画像をまだ履歴に取り込んでいないか（取り込みボタンの表示判定） */
    canImportCurrent?: boolean
    onSelect: (rel: string) => void
    onZoom: (rel: string) => void
    onDelete: (entry: NovelAIHistoryEntry) => void
    /** 現在のコマ画像（ドロップ画像など）を履歴に取り込む */
    onImportCurrent?: () => void
    /** ファイル選択で外部画像を履歴に取り込む */
    onImportFile?: () => void
}

export const HistoryGallery: React.FC<Props> = ({
    history,
    currentProjectPath,
    selectedRelativePath,
    adoptedRelativePath,
    busy,
    canImportCurrent,
    onSelect,
    onZoom,
    onDelete,
    onImportCurrent,
    onImportFile
}) => {
    return (
        <div className="border-t border-zinc-800 pt-3 space-y-2 shrink-0">
            <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-zinc-400 uppercase tracking-wide">このコマの生成履歴</div>
                <div className="flex items-center gap-1.5">
                    {onImportCurrent && canImportCurrent && (
                        <button
                            type="button"
                            onClick={onImportCurrent}
                            disabled={busy}
                            className="flex items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-[10px] font-bold text-zinc-200 hover:bg-zinc-700 disabled:opacity-40"
                            title="このコマに乗っている画像（ドロップ画像など）を履歴に取り込む"
                        >
                            <ImagePlus size={12} /> コマ画像を取り込む
                        </button>
                    )}
                    {onImportFile && (
                        <button
                            type="button"
                            onClick={onImportFile}
                            disabled={busy}
                            className="flex items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-[10px] font-bold text-zinc-200 hover:bg-zinc-700 disabled:opacity-40"
                            title="外部の画像ファイルを選んで履歴に取り込む"
                        >
                            <Upload size={12} /> 読込
                        </button>
                    )}
                    <span className="text-[10px] text-zinc-500">{history.length} 枚</span>
                </div>
            </div>
            {history.length === 0 ? (
                <div className="text-[11px] text-zinc-600">まだ生成されていません。</div>
            ) : (
                <div className="grid grid-cols-3 gap-1.5">
                    {[...history].reverse().map((h) => {
                        const isSel = selectedRelativePath === h.relativePath
                        const isAdopted = adoptedRelativePath === h.relativePath
                        const url = toDisplayUrl(pathFromRelative(currentProjectPath, h.relativePath))
                        return (
                            <div
                                key={h.relativePath}
                                className={`relative aspect-square rounded overflow-hidden border ${
                                    isSel ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-zinc-700 hover:border-zinc-500'
                                }`}
                            >
                                <button
                                    type="button"
                                    onClick={() => {
                                        onSelect(h.relativePath)
                                        onZoom(h.relativePath)
                                    }}
                                    className="absolute inset-0"
                                    title={`クリックで拡大 / ${h.imported ? '外部読込' : `seed: ${h.seed}`} / ${new Date(h.createdAt).toLocaleString()}`}
                                >
                                    {url ? (
                                        <img src={url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-zinc-800" />
                                    )}
                                </button>
                                {isAdopted && (
                                    <div className="absolute top-0 left-0 px-1 py-0.5 bg-emerald-600/90 text-white text-[8px] font-bold rounded-br">
                                        採用中
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onDelete(h) }}
                                    disabled={busy}
                                    className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black/60 text-zinc-300 hover:text-red-400 disabled:opacity-40"
                                    title="この生成を削除（assets/dust/ へ移動）"
                                >
                                    <Trash2 size={10} />
                                </button>
                                <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 bg-black/60 text-[8px] font-mono text-zinc-300 truncate">
                                    {h.imported ? '外部' : h.seed}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
