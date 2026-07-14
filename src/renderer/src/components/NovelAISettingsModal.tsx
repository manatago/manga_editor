import React, { useEffect, useState } from 'react'
import { X, Eye, EyeOff, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { useMangaStore } from '../store/useMangaStore'

interface Props {
    isOpen: boolean
    onClose: () => void
}

export const NovelAISettingsModal: React.FC<Props> = ({ isOpen, onClose }) => {
    const novelaiToken = useMangaStore((s) => s.novelaiToken)
    const connection = useMangaStore((s) => s.novelaiConnection)
    const saveNovelAIToken = useMangaStore((s) => s.saveNovelAIToken)
    const clearNovelAIToken = useMangaStore((s) => s.clearNovelAIToken)
    const testNovelAIConnection = useMangaStore((s) => s.testNovelAIConnection)

    const [draftToken, setDraftToken] = useState(novelaiToken)
    const [reveal, setReveal] = useState(false)
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        if (isOpen) setDraftToken(novelaiToken)
    }, [isOpen, novelaiToken])

    if (!isOpen) return null

    const handleSaveAndTest = async () => {
        setBusy(true)
        try {
            await saveNovelAIToken(draftToken.trim())
            if (draftToken.trim()) {
                await testNovelAIConnection()
            }
        } finally {
            setBusy(false)
        }
    }

    const handleTestOnly = async () => {
        setBusy(true)
        try {
            await testNovelAIConnection(draftToken.trim() || undefined)
        } finally {
            setBusy(false)
        }
    }

    const handleClear = async () => {
        setBusy(true)
        try {
            await clearNovelAIToken()
            setDraftToken('')
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-[520px] max-w-[90vw] p-6 space-y-5"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white">NovelAI 設定</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="space-y-2">
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wide">
                        API トークン
                    </label>
                    <div className="flex items-stretch gap-2">
                        <input
                            type={reveal ? 'text' : 'password'}
                            value={draftToken}
                            onChange={(e) => setDraftToken(e.target.value)}
                            placeholder="pst-..."
                            className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-700 rounded text-sm text-zinc-100 font-mono focus:outline-none focus:border-blue-500"
                            autoComplete="off"
                            spellCheck={false}
                        />
                        <button
                            type="button"
                            onClick={() => setReveal((v) => !v)}
                            className="px-3 rounded border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                            title={reveal ? '隠す' : '表示'}
                        >
                            {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                        NovelAI Web の開発者ツールから取得した <code className="bg-zinc-800 px-1 rounded">pst-</code> で始まるトークンを貼り付けてください。
                        このマシンの OS 暗号化ストレージ（safeStorage）に保存され、プロジェクトファイルには書き込まれません。
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={handleSaveAndTest}
                        disabled={busy}
                        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        保存して疎通確認
                    </button>
                    <button
                        type="button"
                        onClick={handleTestOnly}
                        disabled={busy || !draftToken.trim()}
                        className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        疎通確認のみ
                    </button>
                    <button
                        type="button"
                        onClick={handleClear}
                        disabled={busy || !novelaiToken}
                        className="ml-auto px-4 py-2 rounded-lg bg-red-900/40 hover:bg-red-800/60 border border-red-800/50 text-red-200 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        トークンを削除
                    </button>
                </div>

                <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm">
                    {connection.state === 'idle' && (
                        <div className="text-zinc-500">まだ疎通確認をしていません</div>
                    )}
                    {connection.state === 'testing' && (
                        <div className="flex items-center gap-2 text-zinc-300">
                            <Loader2 size={16} className="animate-spin" />
                            疎通確認中…
                        </div>
                    )}
                    {connection.state === 'ok' && (
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-emerald-400 font-bold">
                                <CheckCircle2 size={16} />
                                接続成功
                            </div>
                            {connection.anlas != null ? (
                                <div className="text-zinc-300 text-xs font-mono">
                                    残 Anlas: <span className="text-white font-bold">{connection.anlas.toLocaleString()}</span>
                                    <span className="text-zinc-500 ml-2">
                                        (fixed {(connection.fixedAnlas ?? 0).toLocaleString()} / purchased {(connection.purchasedAnlas ?? 0).toLocaleString()})
                                    </span>
                                </div>
                            ) : (
                                <div className="text-amber-300/90 text-[11px] leading-relaxed">
                                    トークンは有効です（生成に使えます）。ただし残高（Anlas）は取得できませんでした。
                                    <br />
                                    <span className="text-zinc-500">
                                        永続 API トークン（pst-…）は NovelAI の仕様上、残高照会エンドポイントに非対応です。
                                        Anlas 残高も表示したい場合はログイン由来の JWT アクセストークンを入力してください。
                                    </span>
                                </div>
                            )}
                            <div className="text-[10px] text-zinc-500">
                                確認日時: {new Date(connection.checkedAt).toLocaleString()}
                            </div>
                        </div>
                    )}
                    {connection.state === 'error' && (
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-red-400 font-bold">
                                <XCircle size={16} />
                                接続失敗
                            </div>
                            <div className="text-zinc-300 text-xs break-all">{connection.message}</div>
                            <div className="text-[10px] text-zinc-500">
                                確認日時: {new Date(connection.checkedAt).toLocaleString()}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
