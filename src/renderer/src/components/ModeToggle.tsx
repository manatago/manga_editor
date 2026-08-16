import React from 'react'
import { Pencil, FileText } from 'lucide-react'
import { useMangaStore } from '../store/useMangaStore'

/** 作画モード ⇄ 台本モードの切替（セグメント） */
export const ModeToggle: React.FC = () => {
    const open = useMangaStore((s) => s.scriptEditorOpen)
    const openScriptEditor = useMangaStore((s) => s.openScriptEditor)
    const closeScriptEditor = useMangaStore((s) => s.closeScriptEditor)

    const seg = (active: boolean) =>
        `flex items-center gap-1.5 px-3 py-1 rounded-md text-sm transition-all ${
            active ? 'bg-indigo-600 text-white shadow' : 'text-zinc-400 hover:text-white'
        }`

    return (
        <div className="flex bg-zinc-800/60 p-0.5 rounded-lg border border-zinc-800 shrink-0">
            <button type="button" onClick={closeScriptEditor} className={seg(!open)} title="作画モード">
                <Pencil size={14} />
                <span className="hidden sm:inline">作画</span>
            </button>
            <button type="button" onClick={openScriptEditor} className={seg(open)} title="台本モード">
                <FileText size={14} />
                <span className="hidden sm:inline">台本</span>
            </button>
        </div>
    )
}

export default ModeToggle
