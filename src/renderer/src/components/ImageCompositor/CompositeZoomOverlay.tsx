import React, { useEffect } from 'react'
import { X, Trash2 } from 'lucide-react'

type Props = {
    relativePath: string
    compositesList: string[]
    currentProjectPath: string | null
    onClose: () => void
    onSelect: (rel: string) => void
    onDelete: (rel: string) => void
}

export const CompositeZoomOverlay: React.FC<Props> = ({
    relativePath,
    compositesList,
    currentProjectPath,
    onClose,
    onSelect,
    onDelete
}) => {
    useEffect(() => {
        const onKey = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') {
                e.stopPropagation()
                onClose()
                return
            }
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                const idx = compositesList.findIndex((r) => r === relativePath)
                if (idx < 0) return
                const nextIdx = e.key === 'ArrowLeft' ? idx - 1 : idx + 1
                if (nextIdx >= 0 && nextIdx < compositesList.length) {
                    onSelect(compositesList[nextIdx])
                }
            }
        }
        window.addEventListener('keydown', onKey, true)
        return () => window.removeEventListener('keydown', onKey, true)
    }, [relativePath, compositesList, onClose, onSelect])

    const abs = currentProjectPath && window.electron
        ? window.electron.resolveAssetPath(currentProjectPath, relativePath)
        : ''
    const url = abs && window.electron ? window.electron.pathToUrl(abs) : ''
    const base = relativePath.split('/').pop() ?? relativePath
    const curIdx = compositesList.findIndex((r) => r === relativePath)
    const prev = curIdx > 0 ? compositesList[curIdx - 1] : null
    const next = curIdx >= 0 && curIdx < compositesList.length - 1 ? compositesList[curIdx + 1] : null

    return (
        <div
            className="fixed inset-0 z-[10010] flex items-center justify-center bg-black/85 backdrop-blur-sm p-8"
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
                        className="max-w-[92vw] max-h-[78vh] object-contain rounded-lg shadow-2xl border border-zinc-800"
                    />
                ) : (
                    <div className="text-zinc-500 text-sm">画像を読み込めませんでした</div>
                )}
                <div className="flex items-center gap-3 text-xs text-zinc-300 font-mono bg-zinc-900/80 border border-zinc-800 rounded-full px-4 py-1.5">
                    <button
                        type="button"
                        onClick={() => prev && onSelect(prev)}
                        disabled={!prev}
                        className="text-zinc-400 hover:text-white disabled:opacity-30 px-1"
                        title="前（新しい）"
                    >◀</button>
                    <span className="truncate max-w-[50vw]">{base}</span>
                    <button
                        type="button"
                        onClick={() => next && onSelect(next)}
                        disabled={!next}
                        className="text-zinc-400 hover:text-white disabled:opacity-30 px-1"
                        title="次（古い）"
                    >▶</button>
                    <button
                        type="button"
                        onClick={() => onDelete(relativePath)}
                        className="ml-2 text-zinc-500 hover:text-red-400"
                        title="削除"
                    >
                        <Trash2 size={13} />
                    </button>
                </div>
            </div>
        </div>
    )
}
