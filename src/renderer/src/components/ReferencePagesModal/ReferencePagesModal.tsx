import React, { useCallback, useEffect, useState } from 'react'
import {
    X,
    BookOpen,
    ChevronLeft,
    ChevronRight,
    ImagePlus,
    FolderOpen,
    RefreshCw,
    Trash2,
    Loader2
} from 'lucide-react'
import { useMangaStore } from '../../store/useMangaStore'
import { showError, confirmMessage } from '../../utils/dialogs'

interface ReferencePagesModalProps {
    isOpen: boolean
    onClose: () => void
}

interface RefPage {
    name: string
    path: string
}

export const ReferencePagesModal: React.FC<ReferencePagesModalProps> = ({ isOpen, onClose }) => {
    const currentProjectPath = useMangaStore((s) => s.currentProjectPath)
    const [pages, setPages] = useState<RefPage[]>([])
    const [index, setIndex] = useState(0)
    const [busy, setBusy] = useState(false)

    const toUrl = (p: string): string => (window.electron ? window.electron.pathToUrl(p) : p)

    const load = useCallback(async () => {
        if (!currentProjectPath || !window.electron) return
        try {
            const list = await window.electron.referencePagesList(currentProjectPath)
            setPages(list)
            setIndex((i) => Math.min(i, Math.max(0, list.length - 1)))
        } catch (e) {
            await showError('参考資料の読み込みに失敗しました:\n' + (e instanceof Error ? e.message : String(e)))
        }
    }, [currentProjectPath])

    useEffect(() => {
        if (isOpen) {
            setIndex(0)
            void load()
        }
    }, [isOpen, load])

    const go = useCallback(
        (delta: number) => {
            setIndex((i) => {
                if (pages.length === 0) return 0
                return (i + delta + pages.length) % pages.length
            })
        },
        [pages.length]
    )

    useEffect(() => {
        if (!isOpen) return
        const onKey = (e: KeyboardEvent): void => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') go(1)
            else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') go(-1)
            else if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [isOpen, go, onClose])

    if (!isOpen) return null

    const handleAdd = async (): Promise<void> => {
        if (!currentProjectPath || !window.electron) return
        setBusy(true)
        try {
            const list = await window.electron.referencePagesAdd(currentProjectPath)
            setPages(list)
        } catch (e) {
            await showError('画像の追加に失敗しました:\n' + (e instanceof Error ? e.message : String(e)))
        } finally {
            setBusy(false)
        }
    }

    const handleReveal = async (): Promise<void> => {
        if (!currentProjectPath || !window.electron) return
        try {
            await window.electron.referencePagesReveal(currentProjectPath)
        } catch (e) {
            await showError('フォルダを開けませんでした:\n' + (e instanceof Error ? e.message : String(e)))
        }
    }

    const handleDelete = async (): Promise<void> => {
        if (!currentProjectPath || !window.electron || pages.length === 0) return
        const cur = pages[index]
        const ok = await confirmMessage(`「${cur.name}」を参考資料から削除します。よろしいですか？`)
        if (!ok) return
        try {
            const list = await window.electron.referencePagesDelete(currentProjectPath, cur.name)
            setPages(list)
            setIndex((i) => Math.min(i, Math.max(0, list.length - 1)))
        } catch (e) {
            await showError('削除に失敗しました:\n' + (e instanceof Error ? e.message : String(e)))
        }
    }

    const current = pages[index]

    return (
        <div className="fixed inset-0 z-[70] flex flex-col bg-black/90">
            {/* ヘッダ */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 bg-zinc-900/80">
                <div className="flex items-center gap-2 text-white">
                    <BookOpen size={18} className="text-amber-400" />
                    <h2 className="text-base font-semibold">参考資料</h2>
                    {pages.length > 0 && (
                        <span className="text-xs text-zinc-400 ml-2">
                            {index + 1} / {pages.length}
                            {current && <span className="ml-2 text-zinc-500">{current.name}</span>}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleAdd}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 disabled:opacity-40"
                    >
                        {busy ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                        画像を追加
                    </button>
                    <button
                        type="button"
                        onClick={handleReveal}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700"
                    >
                        <FolderOpen size={14} />
                        フォルダを開く
                    </button>
                    <button
                        type="button"
                        onClick={() => void load()}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700"
                    >
                        <RefreshCw size={14} />
                        再読み込み
                    </button>
                    {pages.length > 0 && (
                        <button
                            type="button"
                            onClick={handleDelete}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs bg-zinc-800 hover:bg-red-900/60 text-zinc-300 hover:text-white border border-zinc-700"
                        >
                            <Trash2 size={14} />
                            削除
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white ml-1"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* 本体（スライドショー） */}
            {pages.length === 0 ? (
                <div className="flex-1 flex items-center justify-center p-8">
                    <div className="text-center max-w-md">
                        <BookOpen size={40} className="text-zinc-700 mx-auto mb-4" />
                        <p className="text-sm text-zinc-400 leading-relaxed">
                            参考資料がまだありません。「画像を追加」で登録するか、プロジェクト直下の
                            <code className="text-zinc-200 mx-1">参考資料</code>フォルダに画像を入れてください。
                        </p>
                        <p className="text-xs text-zinc-600 mt-3 leading-relaxed">
                            別のプロジェクトへは、この<code className="text-zinc-400 mx-1">参考資料</code>
                            フォルダをコピーして所定の位置（プロジェクト直下）に置けば、同じように表示されます。
                            並び順はファイル名順です。
                        </p>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex items-center justify-center relative min-h-0">
                    <button
                        type="button"
                        onClick={() => go(-1)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-zinc-900/70 hover:bg-zinc-800 text-white border border-zinc-700"
                        aria-label="前へ"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    {current && (
                        <img
                            key={current.path}
                            src={toUrl(current.path)}
                            alt={current.name}
                            className="max-h-[calc(100vh-180px)] max-w-[calc(100vw-140px)] object-contain select-none"
                            draggable={false}
                        />
                    )}
                    <button
                        type="button"
                        onClick={() => go(1)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-zinc-900/70 hover:bg-zinc-800 text-white border border-zinc-700"
                        aria-label="次へ"
                    >
                        <ChevronRight size={24} />
                    </button>
                </div>
            )}

            {/* サムネイル列 */}
            {pages.length > 0 && (
                <div className="shrink-0 border-t border-zinc-800 bg-zinc-900/80 px-3 py-2 overflow-x-auto">
                    <div className="flex gap-2">
                        {pages.map((p, i) => (
                            <button
                                key={p.path}
                                type="button"
                                onClick={() => setIndex(i)}
                                className={`shrink-0 rounded border overflow-hidden ${
                                    i === index ? 'border-amber-400 ring-1 ring-amber-400' : 'border-zinc-700 hover:border-zinc-500'
                                }`}
                                title={p.name}
                            >
                                <img
                                    src={toUrl(p.path)}
                                    alt={p.name}
                                    className="h-16 w-12 object-cover"
                                    draggable={false}
                                />
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

export default ReferencePagesModal
