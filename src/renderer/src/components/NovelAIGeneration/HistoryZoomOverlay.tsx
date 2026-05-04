import React, { useEffect } from 'react'
import { X } from 'lucide-react'
import type { NovelAIHistoryEntry } from '../../store/types'
import { pathFromRelative, toDisplayUrl } from './types'

type Props = {
    relativePath: string
    history: NovelAIHistoryEntry[]
    currentProjectPath: string | null
    adoptedRelativePath: string | null | undefined
    onClose: () => void
    onSelect: (rel: string) => void
}

export const HistoryZoomOverlay: React.FC<Props> = ({
    relativePath,
    history,
    currentProjectPath,
    adoptedRelativePath,
    onClose,
    onSelect
}) => {
    useEffect(() => {
        const onKey = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') {
                e.stopPropagation()
                onClose()
                return
            }
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                const sortedByNew = [...history].reverse()
                const idx = sortedByNew.findIndex((h) => h.relativePath === relativePath)
                if (idx < 0) return
                const nextIdx = e.key === 'ArrowLeft' ? idx - 1 : idx + 1
                if (nextIdx >= 0 && nextIdx < sortedByNew.length) {
                    onSelect(sortedByNew[nextIdx].relativePath)
                }
            }
        }
        window.addEventListener('keydown', onKey, true)
        return () => window.removeEventListener('keydown', onKey, true)
    }, [relativePath, history, onClose, onSelect])

    const entry = history.find((h) => h.relativePath === relativePath)
    if (!entry) return null
    const url = toDisplayUrl(pathFromRelative(currentProjectPath, entry.relativePath))
    const sortedByNew = [...history].reverse()
    const curIdx = sortedByNew.findIndex((h) => h.relativePath === entry.relativePath)
    const prev = curIdx > 0 ? sortedByNew[curIdx - 1] : null
    const next = curIdx >= 0 && curIdx < sortedByNew.length - 1 ? sortedByNew[curIdx + 1] : null

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-sm p-8"
            onClick={onClose}
        >
            <div
                className="relative flex flex-col items-center gap-3 max-w-full max-h-full"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute -top-1 -right-1 translate-x-full p-2 rounded-full bg-zinc-900/90 text-zinc-200 hover:text-white hover:bg-zinc-800 border border-zinc-700"
                    title="閉じる (Esc)"
                >
                    <X size={18} />
                </button>
                {url ? (
                    <img
                        src={url}
                        alt=""
                        className="max-w-[92vw] max-h-[82vh] object-contain rounded-lg shadow-2xl border border-zinc-800"
                    />
                ) : (
                    <div className="text-zinc-500 text-sm">画像を読み込めませんでした</div>
                )}
                <div className="flex items-center gap-3 text-xs text-zinc-300 font-mono bg-zinc-900/80 border border-zinc-800 rounded-full px-4 py-1.5">
                    <button
                        type="button"
                        onClick={() => prev && onSelect(prev.relativePath)}
                        disabled={!prev}
                        className="text-zinc-400 hover:text-white disabled:opacity-30 px-1"
                        title="前（新しい）"
                    >◀</button>
                    <span>seed: {entry.seed}</span>
                    {entry.width && entry.height && (
                        <span className="text-zinc-500">{entry.width}×{entry.height}</span>
                    )}
                    <span className="text-zinc-500 text-[10px]">{new Date(entry.createdAt).toLocaleString()}</span>
                    {adoptedRelativePath === entry.relativePath && (
                        <span className="text-emerald-400 text-[10px] font-sans font-bold">採用中</span>
                    )}
                    <button
                        type="button"
                        onClick={() => next && onSelect(next.relativePath)}
                        disabled={!next}
                        className="text-zinc-400 hover:text-white disabled:opacity-30 px-1"
                        title="次（古い）"
                    >▶</button>
                </div>
            </div>
        </div>
    )
}
