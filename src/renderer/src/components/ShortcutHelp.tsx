import React, { useEffect } from 'react'
import { create } from 'zustand'
import { Keyboard, X } from 'lucide-react'

const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || navigator.userAgent)
const MOD = isMac ? '⌘' : 'Ctrl'

/** ショートカット一覧（表示用）。キー処理は hooks/useKeyboardShortcuts.ts と CanvasViewport.tsx */
export const SHORTCUT_GROUPS: ReadonlyArray<{ title: string; items: ReadonlyArray<[string, string]> }> = [
    {
        title: '基本',
        items: [
            [`${MOD} + Z`, '元に戻す'],
            [`${MOD} + Shift + Z / ${MOD} + Y`, 'やり直し'],
            [`${MOD} + S`, '保存（通常は自動保存）'],
            ['?', 'このショートカット一覧']
        ]
    },
    {
        title: '選択中のコマ・吹き出し・素材',
        items: [
            ['← ↑ → ↓', '1px 移動'],
            ['Shift + ← ↑ → ↓', '10px 移動'],
            [`${MOD} + D`, '複製（少しずらして作成）'],
            [`${MOD} + C / ${MOD} + V`, 'コピー / 貼り付け（コマ・吹き出し）'],
            ['Delete / Backspace', '削除（画像のあるコマは先に画像を外す）'],
            ['Esc', '選択解除（モザイク描画中は描画モード終了）']
        ]
    },
    {
        title: 'ページ',
        items: [
            [isMac ? 'PageUp / PageDown（fn + ↑ / ↓）' : 'PageUp / PageDown', '前 / 次のページ']
        ]
    },
    {
        title: '表示',
        items: [
            [`${MOD} + ホイール / ピンチ`, 'ズーム（カーソル位置中心）'],
            [`${MOD} + = / ${MOD} + -`, '拡大 / 縮小'],
            [`${MOD} + 0 / ${MOD} + 1`, 'ページ全体 / 100%'],
            ['Space + ドラッグ', '表示位置の移動']
        ]
    },
    {
        title: 'コマ選択中',
        items: [
            ['Shift を押す', '画像編集タブ（移動・拡縮・回転）'],
            ['Shift + ドラッグ（吹き出し）', '文字位置だけを動かす']
        ]
    }
]

export const useShortcutHelp = create<{ open: boolean; setOpen: (v: boolean) => void; toggle: () => void }>((set) => ({
    open: false,
    setOpen: (open) => set({ open }),
    toggle: () => set((s) => ({ open: !s.open }))
}))

/** 上部バーに置く「ショートカット一覧」ボタン */
export const ShortcutHelpButton: React.FC = () => {
    const toggle = useShortcutHelp((s) => s.toggle)
    return (
        <button
            type="button"
            onClick={toggle}
            title="ショートカット一覧（?）"
            className="shrink-0 rounded-md p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-50"
        >
            <Keyboard size={16} />
        </button>
    )
}

export const ShortcutHelp: React.FC = () => {
    const open = useShortcutHelp((s) => s.open)
    const setOpen = useShortcutHelp((s) => s.setOpen)

    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') {
                e.stopImmediatePropagation()
                setOpen(false)
            }
        }
        window.addEventListener('keydown', onKey, true)
        return () => window.removeEventListener('keydown', onKey, true)
    }, [open, setOpen])

    if (!open) return null
    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)}>
            <div
                role="dialog"
                aria-label="ショートカット一覧"
                className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl manga-scrollbar"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-zinc-50">
                        <Keyboard size={18} className="text-blue-400" />
                        <h2 className="text-base font-semibold">ショートカット一覧</h2>
                    </div>
                    <button type="button" onClick={() => setOpen(false)} className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-50" title="閉じる（Esc）">
                        <X size={16} />
                    </button>
                </div>
                <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                    {SHORTCUT_GROUPS.map((g) => (
                        <section key={g.title}>
                            <h3 className="mb-2 text-xs font-bold tracking-wide text-zinc-400">{g.title}</h3>
                            <dl className="space-y-1.5">
                                {g.items.map(([keys, desc]) => (
                                    <div key={keys} className="flex items-baseline justify-between gap-3 text-xs">
                                        <dt className="shrink-0 rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 font-mono text-[11px] text-zinc-200">{keys}</dt>
                                        <dd className="text-right text-zinc-400">{desc}</dd>
                                    </div>
                                ))}
                            </dl>
                        </section>
                    ))}
                </div>
            </div>
        </div>
    )
}
