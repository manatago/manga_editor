import React, { useEffect, useRef, useState } from 'react'
import { Sparkles, X, Loader2, Check, Trash2 } from 'lucide-react'
import type { ReferenceCharacter } from '../store/types'
import { useMangaStore } from '../store/useMangaStore'
import { referenceCharacterAssetsSubpath } from '../utils/assetsLayout'
import { normalizeReferenceImageToBase64Png } from '../utils/novelaiReferenceImage'

type Aspect = 'portrait' | 'square' | 'landscape'

const MAX_REFS = 5

interface SessionCandidate {
    relativePath: string
    seed: number
    width: number
    height: number
    createdAt: number
    registered: boolean
}

interface NovelAIGenerateResponse {
    ok: boolean
    relativePath?: string
    seed?: number
    width?: number
    height?: number
    createdAt?: number
    error?: string
    status?: number
    message?: string
}

interface Props {
    character: ReferenceCharacter
    currentProjectPath: string | null
    onClose: () => void
}

/**
 * 参照キャラ画面のインライン AI 生成パネル。
 * - キャラの positivePrompt / negativePrompt をベースに NovelAI で新しい画像を生成
 * - キャラ既存画像を任意で precise reference として使用
 * - 生成結果をその場で確認、「採用」でキャラの images に登録、「破棄」でファイル削除
 * - 採用されないままパネルを閉じた場合は dust 移動でクリーンアップ
 */
export const ReferenceCharacterAIGenerationPanel: React.FC<Props> = ({
    character,
    currentProjectPath,
    onClose
}) => {
    const registerReferenceCharacterImage = useMangaStore((s) => s.registerReferenceCharacterImage)

    const [supplementary, setSupplementary] = useState('')
    const [aspect, setAspect] = useState<Aspect>('portrait')
    const [selectedRefIds, setSelectedRefIds] = useState<Set<string>>(new Set())
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [candidates, setCandidates] = useState<SessionCandidate[]>([])

    const candidatesRef = useRef<SessionCandidate[]>([])
    useEffect(() => {
        candidatesRef.current = candidates
    }, [candidates])

    // アンマウント時に未採用の生成画像を dust に退避
    useEffect(() => {
        return () => {
            if (!currentProjectPath || !window.electron) return
            for (const c of candidatesRef.current) {
                if (c.registered) continue
                window.electron
                    .novelaiDeleteGeneration(currentProjectPath, c.relativePath)
                    .catch((e) => console.warn('character AI cleanup failed', e))
            }
        }
    }, [currentProjectPath])

    const toggleRef = (id: string): void => {
        setSelectedRefIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) {
                next.delete(id)
            } else if (next.size < MAX_REFS) {
                next.add(id)
            }
            return next
        })
    }

    const handleGenerate = async (): Promise<void> => {
        if (!currentProjectPath || !window.electron || busy) return
        setError(null)
        setBusy(true)
        try {
            const preciseRefsPayload: Array<{
                imageBase64Png: string
                strength: number
                fidelity: number
                type: 'character' | 'style' | 'character&style'
            }> = []
            for (const im of character.images) {
                if (!selectedRefIds.has(im.id)) continue
                const abs = window.electron.resolveAssetPath(currentProjectPath, im.relativePath)
                const url = window.electron.pathToUrl(abs)
                if (!url) continue
                try {
                    const base64 = await normalizeReferenceImageToBase64Png(url)
                    preciseRefsPayload.push({
                        imageBase64Png: base64,
                        strength: 0.7,
                        fidelity: 0.7,
                        type: 'character'
                    })
                } catch (e) {
                    console.warn('failed to encode reference image', im.relativePath, e)
                }
            }

            const positive = (character.positivePrompt ?? '').trim()
            const negative = (character.negativePrompt ?? '').trim()
            const characterPromptsPayload = positive
                ? [{ name: character.name, prompt: positive, uc: negative }]
                : []

            const resp = (await window.electron.novelaiGenerate({
                projectPath: currentProjectPath,
                outputSubPath: referenceCharacterAssetsSubpath(character.id),
                aspect,
                situationPrompt: supplementary.trim(),
                supplementaryPrompt: '',
                characterPrompts: characterPromptsPayload,
                negativeOverride: undefined,
                seed: null,
                preciseRefs: preciseRefsPayload
            })) as NovelAIGenerateResponse

            if (!resp.ok || !resp.relativePath) {
                const tail =
                    (resp.status ? ` (${resp.status})` : '') +
                    (resp.message ? ` ${resp.message}` : '')
                setError(`生成失敗: ${resp.error ?? 'unknown'}${tail}`)
                return
            }

            setCandidates((prev) => [
                ...prev,
                {
                    relativePath: resp.relativePath as string,
                    seed: resp.seed ?? 0,
                    width: resp.width ?? 0,
                    height: resp.height ?? 0,
                    createdAt: resp.createdAt ?? Date.now(),
                    registered: false
                }
            ])
        } catch (e) {
            setError(`例外: ${e instanceof Error ? e.message : String(e)}`)
        } finally {
            setBusy(false)
        }
    }

    const handleAdopt = (cand: SessionCandidate): void => {
        registerReferenceCharacterImage(character.id, cand.relativePath)
        setCandidates((prev) =>
            prev.map((c) => (c.relativePath === cand.relativePath ? { ...c, registered: true } : c))
        )
    }

    const handleDiscard = async (cand: SessionCandidate): Promise<void> => {
        if (cand.registered) return
        if (!currentProjectPath || !window.electron) return
        try {
            await window.electron.novelaiDeleteGeneration(currentProjectPath, cand.relativePath)
        } catch (e) {
            console.error('failed to discard generated image', e)
        }
        setCandidates((prev) => prev.filter((c) => c.relativePath !== cand.relativePath))
    }

    const resolveUrl = (relativePath: string): string => {
        if (!currentProjectPath || !window.electron) return ''
        const abs = window.electron.resolveAssetPath(currentProjectPath, relativePath)
        return window.electron.pathToUrl(abs)
    }

    const aspectButtonClass = (target: Aspect): string =>
        `py-1.5 rounded-md border text-[11px] font-bold transition-colors ${
            aspect === target
                ? 'bg-violet-600 border-violet-500 text-white'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'
        }`

    const positivePreview = (character.positivePrompt ?? '').trim()
    const noPositive = positivePreview.length === 0

    return (
        <div className="rounded-xl border border-violet-700/40 bg-violet-950/20 p-3 mb-4 space-y-3">
            <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-violet-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles size={14} />
                    NovelAI で新しい画像を生成
                </h4>
                <button
                    type="button"
                    onClick={onClose}
                    className="p-1 text-zinc-400 hover:text-white"
                    title="閉じる"
                >
                    <X size={14} />
                </button>
            </div>

            {noPositive && (
                <div className="text-[11px] text-amber-300 bg-amber-900/20 border border-amber-900/40 rounded px-2 py-1.5">
                    上の Positive プロンプトが空です。先にキャラの positive を埋めてください。
                </div>
            )}

            <div className="grid grid-cols-3 gap-1.5">
                <button type="button" onClick={() => setAspect('portrait')} className={aspectButtonClass('portrait')}>
                    縦 832×1216
                </button>
                <button type="button" onClick={() => setAspect('square')} className={aspectButtonClass('square')}>
                    正方 1024
                </button>
                <button type="button" onClick={() => setAspect('landscape')} className={aspectButtonClass('landscape')}>
                    横 1216×832
                </button>
            </div>

            <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                    追加プロンプト（任意）
                </label>
                <textarea
                    value={supplementary}
                    onChange={(e) => setSupplementary(e.target.value)}
                    rows={2}
                    placeholder="e.g. smiling, looking at viewer, from behind"
                    className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-700 rounded text-xs text-zinc-100 font-mono focus:outline-none focus:border-violet-500 resize-none"
                />
            </div>

            {character.images.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                            参照画像 (precise) — クリックで選択 / 最大 {MAX_REFS} 枚
                        </label>
                        <span className="text-[10px] text-zinc-500">{selectedRefIds.size}/{MAX_REFS}</span>
                    </div>
                    <div className="grid grid-cols-6 gap-1.5">
                        {character.images.map((im) => {
                            const url = resolveUrl(im.relativePath)
                            const selected = selectedRefIds.has(im.id)
                            const disabled = !selected && selectedRefIds.size >= MAX_REFS
                            return (
                                <button
                                    key={im.id}
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => toggleRef(im.id)}
                                    className={`relative aspect-square rounded border overflow-hidden ${
                                        selected
                                            ? 'border-violet-400 ring-2 ring-violet-500/60'
                                            : disabled
                                              ? 'border-zinc-800 opacity-30 cursor-not-allowed'
                                              : 'border-zinc-700 hover:border-zinc-500'
                                    }`}
                                    title={im.relativePath}
                                >
                                    {url ? (
                                        <img src={url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-zinc-800" />
                                    )}
                                    {selected && (
                                        <div className="absolute top-0.5 right-0.5 bg-violet-500 rounded-full p-0.5">
                                            <Check size={10} className="text-white" />
                                        </div>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}

            <button
                type="button"
                onClick={handleGenerate}
                disabled={busy || noPositive}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
            >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {busy ? '生成中…（10〜30秒）' : '生成'}
            </button>

            {error && (
                <div className="text-[11px] text-red-400 bg-red-900/20 border border-red-900/40 rounded px-2 py-1.5 break-all">
                    {error}
                </div>
            )}

            {candidates.length > 0 && (
                <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                        生成結果（採用するとキャラに登録 / 破棄するとファイル削除）
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        {candidates.map((c) => {
                            const url = resolveUrl(c.relativePath)
                            return (
                                <div
                                    key={c.relativePath}
                                    className="rounded border border-zinc-700 bg-zinc-900 overflow-hidden flex flex-col"
                                >
                                    {url ? (
                                        <img src={url} alt="" className="w-full aspect-[3/4] object-cover" />
                                    ) : (
                                        <div className="w-full aspect-[3/4] bg-zinc-800" />
                                    )}
                                    <div className="text-[9px] text-zinc-500 font-mono px-1.5 py-0.5 truncate">
                                        seed: {c.seed}
                                    </div>
                                    {c.registered ? (
                                        <div className="px-1.5 py-1 text-[10px] text-emerald-400 font-bold flex items-center gap-1 border-t border-zinc-800">
                                            <Check size={11} />
                                            登録済み
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 border-t border-zinc-800">
                                            <button
                                                type="button"
                                                onClick={() => handleAdopt(c)}
                                                className="flex items-center justify-center gap-1 py-1 text-[10px] font-bold bg-emerald-700/40 hover:bg-emerald-600/60 text-emerald-200"
                                            >
                                                <Check size={11} />
                                                採用
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => void handleDiscard(c)}
                                                className="flex items-center justify-center gap-1 py-1 text-[10px] font-bold bg-zinc-800 hover:bg-red-900/50 text-zinc-300 hover:text-red-300 border-l border-zinc-800"
                                            >
                                                <Trash2 size={11} />
                                                破棄
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
