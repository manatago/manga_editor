import React, { useState, useEffect, useRef } from 'react'
import { useMangaStore } from '../store/useMangaStore'
import { FileText, ChevronDown, ChevronUp } from 'lucide-react'

const STORAGE_KEY = 'manga-yarou-manuscript-panel-open'

export const ManuscriptPanel: React.FC = () => {
    const manuscript = useMangaStore((s) => s.manuscript)
    const manuscriptSelection = useMangaStore((s) => s.manuscriptSelection)
    const setManuscript = useMangaStore((s) => s.setManuscript)
    const setManuscriptSelection = useMangaStore((s) => s.setManuscriptSelection)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    const [open, setOpen] = useState(() => {
        try {
            return localStorage.getItem(STORAGE_KEY) === 'true'
        } catch {
            return false
        }
    })

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, open ? 'true' : 'false')
        } catch {
            /* ignore */
        }
    }, [open])

    const syncSelection = (): void => {
        const el = textareaRef.current
        if (!el) return
        const { selectionStart, selectionEnd } = el
        if (selectionStart != null && selectionEnd != null && selectionEnd > selectionStart) {
            setManuscriptSelection({ start: selectionStart, end: selectionEnd })
        } else {
            setManuscriptSelection(null)
        }
    }

    const selectedLen = manuscriptSelection ? manuscriptSelection.end - manuscriptSelection.start : 0

    return (
        <div className="shrink-0 border-t border-zinc-800 bg-zinc-900">
            <div className="h-9 flex items-center justify-between px-3">
                <button
                    type="button"
                    onClick={() => setOpen((v) => !v)}
                    className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white transition-colors"
                >
                    <FileText size={14} />
                    原稿メモ
                    {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </button>
                {open && (
                    <span className="text-[10px] text-zinc-500">
                        {selectedLen > 0
                            ? `${selectedLen} 文字選択中 — コマを選んで吹き出しボタンを押すと流し込み`
                            : 'テキストを選択 → コマ選択 → 吹き出しボタン'}
                    </span>
                )}
            </div>
            {open && (
                <div className="px-3 pb-3">
                    <textarea
                        ref={textareaRef}
                        value={manuscript}
                        onChange={(e) => setManuscript(e.target.value)}
                        onSelect={syncSelection}
                        onKeyUp={syncSelection}
                        onMouseUp={syncSelection}
                        placeholder="ここに原稿全体を書いておけます。一部を選択した状態でコマを選び吹き出しを追加すると、その文字が吹き出しに入ります（流し込んだ文字は原稿から削除されます）。"
                        className="w-full h-40 resize-y bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-200 leading-relaxed focus:outline-none focus:border-blue-500/50"
                    />
                </div>
            )}
        </div>
    )
}
