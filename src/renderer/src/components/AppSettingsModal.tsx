import React from 'react'
import { X, GitBranch, Sparkles, Monitor, Moon, Sun, ChevronRight } from 'lucide-react'
import { useMangaStore } from '../store/useMangaStore'
import type { ThemeMode } from '../store/useMangaStore'

/**
 * アプリ全体の設定ハブ。あちこちに散っていた「設定」をここへ集約する。
 * 上部バーの歯車、または Properties パネル見出しの歯車から開く。
 * 各項目は専用モーダル（Git 同期・NovelAI）へ橋渡しする薄いハブ。
 */
interface Props {
    isOpen: boolean
    onClose: () => void
    /** 「同期（Git / LFS）」を開く。接続設定もこの中にある。 */
    onOpenGitSync: () => void
    /** 「NovelAI 設定」（トークン・疎通確認）を開く。 */
    onOpenNovelai: () => void
}

export const AppSettingsModal: React.FC<Props> = ({ isOpen, onClose, onOpenGitSync, onOpenNovelai }) => {
    const novelaiConnection = useMangaStore((s) => s.novelaiConnection)
    const novelaiOk = novelaiConnection.state === 'ok'
    const theme = useMangaStore((s) => s.theme)
    const setTheme = useMangaStore((s) => s.setTheme)

    const THEME_OPTIONS: ReadonlyArray<{ value: ThemeMode; label: string; icon: React.ReactNode }> = [
        { value: 'dark', label: 'ダーク', icon: <Moon size={14} /> },
        { value: 'light', label: 'ライト', icon: <Sun size={14} /> }
    ]

    if (!isOpen) return null

    // ハブ項目を押したらこのモーダルは閉じ、対象モーダルを開く（重ね表示を避ける）
    const go = (open: () => void) => () => {
        onClose()
        open()
    }

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-6"
            onClick={onClose}
        >
            <div
                className="w-[460px] max-w-full max-h-[85vh] overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl manga-scrollbar"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
                    <h2 className="text-sm font-bold text-zinc-100">設定</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-50"
                        title="閉じる"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="p-4 space-y-2">
                    {/* 同期（Git / LFS）。接続設定はこの中にある */}
                    <button
                        type="button"
                        onClick={go(onOpenGitSync)}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-zinc-800/60 border border-zinc-800 hover:bg-zinc-800 text-left transition-colors"
                    >
                        <span className="w-9 h-9 shrink-0 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                            <GitBranch size={17} />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block text-sm font-bold text-zinc-100">同期（Git / LFS）</span>
                            <span className="block text-[11px] text-zinc-500">プッシュ・プル・履歴、リモート/LFS の接続設定</span>
                        </span>
                        <ChevronRight size={16} className="text-zinc-600 shrink-0" />
                    </button>

                    {/* NovelAI 設定（トークン・疎通確認） */}
                    <button
                        type="button"
                        onClick={go(onOpenNovelai)}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-zinc-800/60 border border-zinc-800 hover:bg-zinc-800 text-left transition-colors"
                    >
                        <span className="w-9 h-9 shrink-0 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-300">
                            <Sparkles size={17} />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block text-sm font-bold text-zinc-100">NovelAI</span>
                            <span className="block text-[11px] text-zinc-500">API トークンの登録・疎通確認</span>
                        </span>
                        <span
                            className={`w-2 h-2 rounded-full shrink-0 ${novelaiOk ? 'bg-emerald-400' : 'bg-zinc-600'}`}
                            title={novelaiOk ? '接続 OK' : '未接続'}
                        />
                        <ChevronRight size={16} className="text-zinc-600 shrink-0" />
                    </button>

                    {/* 外観（テーマ）。ダーク / ライトを即時切替（端末ローカルに保存） */}
                    <div className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-zinc-800/60 border border-zinc-800">
                        <span className="w-9 h-9 shrink-0 rounded-lg bg-zinc-500/10 border border-zinc-500/20 flex items-center justify-center text-zinc-400">
                            <Monitor size={17} />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block text-sm font-bold text-zinc-100">外観テーマ</span>
                            <span className="block text-[11px] text-zinc-500">画面全体の明るさ。この端末だけに保存されます</span>
                        </span>
                        <div className="shrink-0 flex items-center gap-1 p-1 rounded-lg bg-zinc-900 border border-zinc-800">
                            {THEME_OPTIONS.map((opt) => {
                                const active = theme === opt.value
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setTheme(opt.value)}
                                        aria-pressed={active}
                                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                                            active
                                                ? 'bg-blue-600 text-white'
                                                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
                                        }`}
                                    >
                                        {opt.icon}
                                        {opt.label}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default AppSettingsModal
