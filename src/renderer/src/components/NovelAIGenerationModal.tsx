import React, { useEffect, useMemo, useState } from 'react'
import { X, Sparkles, Loader2, RefreshCw, Check, Trash2, Plus, Image as ImageIcon } from 'lucide-react'
import { useMangaStore } from '../store/useMangaStore'
import type {
    NovelAIAspect,
    NovelAIHistoryEntry,
    NovelAIPanelConfig,
    Panel,
    PreciseReferenceEntry,
    PreciseRefType,
    PreciseRefSource,
    ReferenceCharacter
} from '../store/types'
import { normalizeReferenceImageToBase64Png } from '../utils/novelaiReferenceImage'
import { showError } from '../utils/dialogs'

type PreciseRefCandidate = {
    key: string
    source: PreciseRefSource
    id: string
    /** 解決済み絶対パス（無い場合は未解決） */
    absolutePath: string | null
    /** URL（表示用） */
    url: string
    label: string
    /** ライブラリの場合は所属キャラ名 */
    subLabel?: string
}

function pathFromRelative(projectPath: string | null, relPath: string): string | null {
    if (!projectPath || !window.electron) return null
    const abs = window.electron.resolveAssetPath(projectPath, relPath)
    return abs || null
}

function toDisplayUrl(absolutePath: string | null): string {
    if (!absolutePath || !window.electron) return ''
    return window.electron.pathToUrl(absolutePath)
}

const MAX_CHARACTER_REFS = 6
const MAX_PRECISE_REFS = 5

/** NovelAI のベース Anlas 見積（1024x1536 以下 + steps<=28 + Opus は 0） */
function estimateBaseAnlas(width: number, height: number, tier: number | null): number {
    const STEPS = 28
    const AREA_COEF = 2.951823174884865e-6
    const STEP_AREA_COEF = 5.753298233447344e-7
    const area = width * height
    const isOpus = tier === 3
    if (isOpus && area <= 1048576 && STEPS <= 28) return 0
    return Math.max(Math.ceil(AREA_COEF * area + STEP_AREA_COEF * area * STEPS), 2)
}

const ASPECT_DIMS: Record<NovelAIAspect, { width: number; height: number }> = {
    portrait: { width: 832, height: 1216 },
    square: { width: 1024, height: 1024 },
    landscape: { width: 1216, height: 832 }
}

export const NovelAIGenerationModal: React.FC = () => {
    const targetPanelId = useMangaStore((s) => s.novelaiTargetPanelId)
    const close = useMangaStore((s) => s.closeNovelAIModal)
    const currentProjectPath = useMangaStore((s) => s.currentProjectPath)
    const pages = useMangaStore((s) => s.pages)
    const referenceCharacters = useMangaStore((s) => s.referenceCharacters)
    const updatePanel = useMangaStore((s) => s.updatePanel)
    const novelaiConnection = useMangaStore((s) => s.novelaiConnection)
    const testNovelAIConnection = useMangaStore((s) => s.testNovelAIConnection)
    const lastSupplementary = useMangaStore((s) => s.novelaiLastSupplementary)
    const setLastSupplementary = useMangaStore((s) => s.setNovelAILastSupplementary)

    const panel: Panel | null = useMemo(() => {
        if (!targetPanelId) return null
        for (const p of pages) {
            const hit = p.panels.find((pn) => pn.id === targetPanelId)
            if (hit) return hit
        }
        return null
    }, [targetPanelId, pages])

    const [form, setForm] = useState<NovelAIPanelConfig>({})
    const [compositesList, setCompositesList] = useState<string[]>([])
    const [busy, setBusy] = useState(false)
    const [selectedRelativePath, setSelectedRelativePath] = useState<string | null>(null)
    const [zoomedRelativePath, setZoomedRelativePath] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const history: NovelAIHistoryEntry[] = useMemo(() => panel?.novelai?.history ?? [], [panel?.novelai?.history])
    const selectedEntry: NovelAIHistoryEntry | null = useMemo(() => {
        if (!selectedRelativePath) return null
        return history.find((h) => h.relativePath === selectedRelativePath) ?? null
    }, [history, selectedRelativePath])

    useEffect(() => {
        if (!targetPanelId) {
            setForm({})
            setSelectedRelativePath(null)
            setError(null)
            return
        }
        const src = panel?.novelai ?? {}
        const savedSupp = src.supplementaryPrompt
        setForm({
            situationPrompt: src.situationPrompt ?? '',
            // 補助プロンプトはコマに保存が無ければ「前回の補助」を引き継ぐ
            supplementaryPrompt: savedSupp && savedSupp.length > 0 ? savedSupp : lastSupplementary,
            negativeOverride: src.negativeOverride ?? '',
            aspect: src.aspect ?? 'portrait',
            characterRefIds: src.characterRefIds ?? [],
            preciseRefs: src.preciseRefs ?? [],
            lastSeed: src.lastSeed
        })
        // 既に採用済みなら current imagePath を優先。なければ最新の履歴。
        const hist = src.history ?? []
        const currentAdopted = panel?.imagePath
        if (currentAdopted && hist.some((h) => h.relativePath === currentAdopted)) {
            setSelectedRelativePath(currentAdopted)
        } else if (hist.length > 0) {
            setSelectedRelativePath(hist[hist.length - 1].relativePath)
        } else {
            setSelectedRelativePath(null)
        }
        setError(null)
    }, [targetPanelId, panel?.novelai, panel?.imagePath, lastSupplementary])

    useEffect(() => {
        if (!targetPanelId || !currentProjectPath || !window.electron) return
        (async () => {
            try {
                const absList = await window.electron.getAssets(currentProjectPath)
                const norm = (currentProjectPath + '/assets/composites/').replace(/\\/g, '/')
                const rel = absList
                    .map((a) => a.replace(/\\/g, '/'))
                    .filter((a) => a.startsWith(norm))
                    .map((a) => 'assets/composites/' + a.slice(norm.length))
                    .sort((a, b) => (a > b ? -1 : 1))
                setCompositesList(rel)
            } catch (e) {
                console.error('failed to list composites', e)
            }
        })()
    }, [targetPanelId, currentProjectPath])

    const persistForm = (next: NovelAIPanelConfig, historyOverride?: NovelAIHistoryEntry[]) => {
        if (!panel) return
        const hist = historyOverride ?? panel.novelai?.history ?? []
        const merged: NovelAIPanelConfig = { ...next }
        if (hist.length > 0) merged.history = hist
        else delete merged.history
        const hasAny =
            !!merged.situationPrompt ||
            !!merged.supplementaryPrompt ||
            !!merged.negativeOverride ||
            (merged.aspect && merged.aspect !== 'portrait') ||
            (merged.characterRefIds && merged.characterRefIds.length > 0) ||
            (merged.preciseRefs && merged.preciseRefs.length > 0) ||
            merged.lastSeed != null ||
            (merged.history && merged.history.length > 0)
        updatePanel(panel.id, { novelai: hasAny ? merged : undefined }, false)
    }

    const handleClose = () => {
        persistForm(form)
        close()
    }

    useEffect(() => {
        if (!zoomedRelativePath) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation()
                setZoomedRelativePath(null)
                return
            }
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                const sortedByNew = [...history].reverse()
                const idx = sortedByNew.findIndex((h) => h.relativePath === zoomedRelativePath)
                if (idx < 0) return
                const nextIdx = e.key === 'ArrowLeft' ? idx - 1 : idx + 1
                if (nextIdx >= 0 && nextIdx < sortedByNew.length) {
                    setZoomedRelativePath(sortedByNew[nextIdx].relativePath)
                }
            }
        }
        window.addEventListener('keydown', onKey, true)
        return () => window.removeEventListener('keydown', onKey, true)
    }, [zoomedRelativePath, history])

    const selectedCharacters: ReferenceCharacter[] = useMemo(() => {
        const ids = form.characterRefIds ?? []
        const out: ReferenceCharacter[] = []
        for (const id of ids) {
            const hit = referenceCharacters.find((c) => c.id === id)
            if (hit) out.push(hit)
        }
        return out
    }, [referenceCharacters, form.characterRefIds])

    const toggleCharacterRef = (id: string) => {
        const cur = form.characterRefIds ?? []
        if (cur.includes(id)) {
            setForm({ ...form, characterRefIds: cur.filter((v) => v !== id) })
            return
        }
        if (cur.length >= MAX_CHARACTER_REFS) return
        setForm({ ...form, characterRefIds: [...cur, id] })
    }

    const moveCharacterRef = (id: string, dir: -1 | 1) => {
        const cur = [...(form.characterRefIds ?? [])]
        const idx = cur.indexOf(id)
        if (idx < 0) return
        const next = idx + dir
        if (next < 0 || next >= cur.length) return
        const [removed] = cur.splice(idx, 1)
        cur.splice(next, 0, removed)
        setForm({ ...form, characterRefIds: cur })
    }

    const preciseCandidates: PreciseRefCandidate[] = useMemo(() => {
        const out: PreciseRefCandidate[] = []
        for (const c of referenceCharacters) {
            for (const img of c.images) {
                const id = `${c.id}/${img.id}`
                const abs = pathFromRelative(currentProjectPath, img.relativePath)
                out.push({
                    key: `character-image:${id}`,
                    source: 'character-image',
                    id,
                    absolutePath: abs,
                    url: toDisplayUrl(abs),
                    label: img.relativePath.split('/').pop() ?? img.id,
                    subLabel: c.name
                })
            }
        }
        for (const rel of compositesList) {
            const abs = pathFromRelative(currentProjectPath, rel)
            out.push({
                key: `composite:${rel}`,
                source: 'composite',
                id: rel,
                absolutePath: abs,
                url: toDisplayUrl(abs),
                label: rel.split('/').pop() ?? rel,
                subLabel: '合成出力'
            })
        }
        return out
    }, [referenceCharacters, compositesList, currentProjectPath])

    const isCandidateSelected = (cand: PreciseRefCandidate) =>
        (form.preciseRefs ?? []).some((r) => r.source === cand.source && r.id === cand.id)

    const addPreciseRef = (cand: PreciseRefCandidate) => {
        const cur = form.preciseRefs ?? []
        if (cur.length >= MAX_PRECISE_REFS) return
        if (isCandidateSelected(cand)) return
        const entry: PreciseReferenceEntry = {
            source: cand.source,
            id: cand.id,
            strength: 0.7,
            fidelity: 0.7,
            type: 'character'
        }
        setForm({ ...form, preciseRefs: [...cur, entry] })
    }

    const removePreciseRef = (entry: PreciseReferenceEntry) => {
        setForm({
            ...form,
            preciseRefs: (form.preciseRefs ?? []).filter(
                (r) => !(r.source === entry.source && r.id === entry.id)
            )
        })
    }

    const updatePreciseRef = (idx: number, patch: Partial<PreciseReferenceEntry>) => {
        const cur = form.preciseRefs ?? []
        const next = cur.map((r, i) => (i === idx ? { ...r, ...patch } : r))
        setForm({ ...form, preciseRefs: next })
    }

    const resolvePreciseRefUrl = (entry: PreciseReferenceEntry): string => {
        if (entry.source === 'character-image') {
            const [charId, imgId] = entry.id.split('/')
            const char = referenceCharacters.find((c) => c.id === charId)
            const img = char?.images.find((i) => i.id === imgId)
            if (!img) return ''
            const abs = pathFromRelative(currentProjectPath, img.relativePath)
            return toDisplayUrl(abs)
        }
        const abs = pathFromRelative(currentProjectPath, entry.id)
        return toDisplayUrl(abs)
    }

    const handleGenerate = async (reseed: boolean) => {
        if (!window.electron || !panel) return
        if (!currentProjectPath) {
            setError('プロジェクトを開いた状態で生成してください')
            return
        }
        setError(null)
        setBusy(true)
        try {
            const preciseRefsPayload: Array<{
                imageBase64Png: string
                strength: number
                fidelity: number
                type: PreciseRefType
            }> = []
            for (const r of form.preciseRefs ?? []) {
                const url = resolvePreciseRefUrl(r)
                if (!url) continue
                const base64 = await normalizeReferenceImageToBase64Png(url)
                preciseRefsPayload.push({
                    imageBase64Png: base64,
                    strength: r.strength,
                    fidelity: r.fidelity,
                    type: r.type
                })
            }
            const charPromptsPayload = selectedCharacters
                .map((c) => ({
                    name: c.name,
                    prompt: (c.positivePrompt ?? '').trim(),
                    uc: (c.negativePrompt ?? '').trim()
                }))
                .filter((p) => !!p.prompt)
            const droppedChars = selectedCharacters.filter((c) => !(c.positivePrompt ?? '').trim())
            if (droppedChars.length > 0) {
                console.warn(
                    '[novelai] positivePrompt が空のため除外したキャラ:',
                    droppedChars.map((c) => c.name)
                )
            }
            console.log('[novelai] selected characters → sending:', {
                selected: selectedCharacters.map((c) => c.name),
                sending: charPromptsPayload.map((c) => c.name)
            })
            const negOverride = (form.negativeOverride ?? '').trim()
            // 同じ seed で再描画する場合は現在プレビュー中のエントリの seed を優先
            const seedToUse = reseed ? undefined : (selectedEntry?.seed ?? form.lastSeed)
            const supplementary = (form.supplementaryPrompt ?? '').trim()
            if (supplementary) setLastSupplementary(supplementary)
            const situation = form.situationPrompt ?? ''
            const aspect: NovelAIAspect = form.aspect ?? 'portrait'
            const resp = await window.electron.novelaiGenerate({
                projectPath: currentProjectPath,
                panelId: panel.id,
                aspect,
                situationPrompt: situation,
                supplementaryPrompt: supplementary,
                characterPrompts: charPromptsPayload,
                negativeOverride: negOverride || undefined,
                seed: seedToUse ?? null,
                preciseRefs: preciseRefsPayload
            })
            if (!resp.ok) {
                setError(`生成失敗: ${resp.error}${resp.status ? ` (${resp.status})` : ''}${resp.message ? ` ${resp.message}` : ''}`)
                return
            }
            const entry: NovelAIHistoryEntry = {
                relativePath: resp.relativePath,
                seed: resp.seed,
                createdAt: resp.createdAt,
                situationPrompt: situation.trim() || undefined,
                supplementaryPrompt: supplementary || undefined,
                aspect,
                width: resp.width,
                height: resp.height
            }
            const nextHistory = [...(panel.novelai?.history ?? []), entry]
            const nextForm = { ...form, lastSeed: resp.seed }
            setForm(nextForm)
            persistForm(nextForm, nextHistory)
            setSelectedRelativePath(entry.relativePath)
            // 生成後は実 Anlas を再取得して残高表示を更新
            testNovelAIConnection().catch(() => { /* ignore */ })
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            setError(`例外: ${msg}`)
        } finally {
            setBusy(false)
        }
    }

    const handleAdopt = () => {
        if (!selectedEntry || !panel) return
        const nextForm = { ...form, lastSeed: selectedEntry.seed }
        persistForm(nextForm)
        updatePanel(panel.id, {
            imagePath: selectedEntry.relativePath,
            imageX: panel.width / 2,
            imageY: panel.height / 2,
            imageScale: undefined,
            imageRotation: 0,
            imageFlipX: false
        }, true)
        close()
    }

    const handleDeleteHistory = async (entry: NovelAIHistoryEntry) => {
        if (!panel || !currentProjectPath || !window.electron) return
        try {
            await window.electron.novelaiDeleteGeneration(currentProjectPath, entry.relativePath)
        } catch (e) {
            await showError(e instanceof Error ? e.message : String(e))
            return
        }
        const nextHistory = (panel.novelai?.history ?? []).filter((h) => h.relativePath !== entry.relativePath)
        // 採用中だった場合はコマの imagePath をクリア
        if (panel.imagePath === entry.relativePath) {
            updatePanel(panel.id, { imagePath: undefined }, true)
        }
        persistForm(form, nextHistory)
        if (selectedRelativePath === entry.relativePath) {
            // 次の候補（新しい順で）に切り替え
            const fallback = nextHistory.length > 0 ? nextHistory[nextHistory.length - 1].relativePath : null
            setSelectedRelativePath(fallback)
        }
    }

    if (!targetPanelId || !panel) return null

    const preciseList = form.preciseRefs ?? []
    const canGenerate = !busy && !!(form.situationPrompt ?? '').trim()

    const aspectKey: NovelAIAspect = form.aspect ?? 'portrait'
    const dims = ASPECT_DIMS[aspectKey]
    const connTier = novelaiConnection.state === 'ok' ? novelaiConnection.tier : null
    const baseCost = estimateBaseAnlas(dims.width, dims.height, connTier)
    const preciseCost = preciseList.length * 5
    const estimatedCost = baseCost + preciseCost
    const currentAnlas = novelaiConnection.state === 'ok' ? novelaiConnection.anlas : null
    const costLabel = currentAnlas != null
        ? `${estimatedCost}/${currentAnlas.toLocaleString()}`
        : `${estimatedCost}`

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-[1040px] max-w-[96vw] max-h-[92vh] flex flex-col">
                <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between shrink-0">
                    <h2 className="text-white font-bold flex items-center gap-2">
                        <Sparkles size={16} className="text-indigo-400" />
                        NovelAI 画像生成（コマ: {panel.id.slice(0, 6)}）
                    </h2>
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={busy}
                        className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-40"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-hidden grid grid-cols-[minmax(0,1fr)_360px]">
                    {/* Left: prompt + refs */}
                    <div className="overflow-y-auto p-5 space-y-4 min-w-0">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
                                シチュエーション プロンプト <span className="text-red-400">*</span>
                            </label>
                            <textarea
                                value={form.situationPrompt ?? ''}
                                onChange={(e) => setForm({ ...form, situationPrompt: e.target.value })}
                                rows={3}
                                placeholder="e.g. 1girl, standing, school uniform, simple background"
                                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded text-sm text-zinc-100 font-mono focus:outline-none focus:border-blue-500 resize-none"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
                                補助プロンプト
                            </label>
                            <textarea
                                value={form.supplementaryPrompt ?? ''}
                                onChange={(e) => setForm({ ...form, supplementaryPrompt: e.target.value })}
                                rows={2}
                                placeholder="任意。構図・表情など追加で効かせたいタグ"
                                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded text-sm text-zinc-100 font-mono focus:outline-none focus:border-blue-500 resize-none"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
                                ネガティブ プロンプト（上書き）
                            </label>
                            <textarea
                                value={form.negativeOverride ?? ''}
                                onChange={(e) => setForm({ ...form, negativeOverride: e.target.value })}
                                rows={2}
                                placeholder="空の場合は既定ネガティブ（＋キャラの negativePrompt）を使用"
                                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded text-sm text-zinc-100 font-mono focus:outline-none focus:border-blue-500 resize-none"
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            {(['portrait', 'square', 'landscape'] as NovelAIAspect[]).map((a) => (
                                <button
                                    key={a}
                                    type="button"
                                    onClick={() => setForm({ ...form, aspect: a })}
                                    className={`py-2 rounded-lg border text-xs font-bold transition-colors ${
                                        (form.aspect ?? 'portrait') === a
                                            ? 'bg-blue-600 border-blue-500 text-white'
                                            : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'
                                    }`}
                                >
                                    {a === 'portrait' ? '縦 832×1216' : a === 'square' ? '正方 1024×1024' : '横 1216×832'}
                                </button>
                            ))}
                        </div>

                        <div className="border-t border-zinc-800 pt-4 space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
                                    キャラクター参照（最大 {MAX_CHARACTER_REFS}、左→右に並ぶ）
                                </label>
                                <span className="text-[10px] text-zinc-500">
                                    {(form.characterRefIds ?? []).length}/{MAX_CHARACTER_REFS} 人
                                </span>
                            </div>
                            {selectedCharacters.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-zinc-950 border border-zinc-800">
                                    {selectedCharacters.map((c, idx) => {
                                        const first = c.images[0]
                                        const abs = first ? pathFromRelative(currentProjectPath, first.relativePath) : null
                                        const url = toDisplayUrl(abs)
                                        return (
                                            <div key={c.id} className="flex items-center gap-1 bg-indigo-700/30 border border-indigo-500/60 rounded pl-1 pr-1 py-1">
                                                <span className="text-[10px] text-indigo-200 font-mono w-4 text-center">{idx + 1}</span>
                                                <div className="w-5 h-5 bg-zinc-900 rounded overflow-hidden shrink-0">
                                                    {url && <img src={url} alt="" className="w-full h-full object-cover" />}
                                                </div>
                                                <span className="text-[11px] text-white max-w-[90px] truncate">{c.name}</span>
                                                <button
                                                    type="button"
                                                    disabled={idx === 0}
                                                    onClick={() => moveCharacterRef(c.id, -1)}
                                                    className="text-indigo-300 hover:text-white disabled:opacity-30 text-[10px] px-0.5"
                                                    title="左に移動"
                                                >◂</button>
                                                <button
                                                    type="button"
                                                    disabled={idx === selectedCharacters.length - 1}
                                                    onClick={() => moveCharacterRef(c.id, 1)}
                                                    className="text-indigo-300 hover:text-white disabled:opacity-30 text-[10px] px-0.5"
                                                    title="右に移動"
                                                >▸</button>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleCharacterRef(c.id)}
                                                    className="text-zinc-400 hover:text-red-400"
                                                    title="外す"
                                                >
                                                    <X size={11} />
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                            {referenceCharacters.length === 0 ? (
                                <div className="text-[11px] text-zinc-500 py-2">
                                    参照キャラクターが登録されていません（左サイドバー → ツール → 参照キャラクター）
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 gap-2">
                                    {referenceCharacters.map((c) => {
                                        const first = c.images[0]
                                        const abs = first ? pathFromRelative(currentProjectPath, first.relativePath) : null
                                        const url = toDisplayUrl(abs)
                                        const active = (form.characterRefIds ?? []).includes(c.id)
                                        const limitReached = !active && (form.characterRefIds ?? []).length >= MAX_CHARACTER_REFS
                                        return (
                                            <button
                                                key={c.id}
                                                type="button"
                                                onClick={() => toggleCharacterRef(c.id)}
                                                disabled={limitReached}
                                                className={`p-2 rounded-lg border flex items-center gap-2 transition-colors ${
                                                    active
                                                        ? 'bg-indigo-700/40 border-indigo-500 text-white'
                                                        : limitReached
                                                            ? 'bg-zinc-800 border-zinc-800 text-zinc-600 cursor-not-allowed'
                                                            : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white'
                                                }`}
                                            >
                                                <div className="w-10 h-10 bg-zinc-950 rounded overflow-hidden shrink-0 flex items-center justify-center">
                                                    {url ? (
                                                        <img src={url} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <ImageIcon size={14} className="text-zinc-600" />
                                                    )}
                                                </div>
                                                <div className="text-left min-w-0">
                                                    <div className="text-xs font-bold truncate">{c.name}</div>
                                                    <div className="text-[10px] text-zinc-500 truncate">
                                                        {c.positivePrompt ? c.positivePrompt.slice(0, 40) : '(prompt 未設定)'}
                                                    </div>
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="border-t border-zinc-800 pt-4 space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
                                    精密参照（最大 {MAX_PRECISE_REFS} 枚）
                                </label>
                                <span className="text-[10px] text-zinc-500">
                                    {preciseList.length}/{MAX_PRECISE_REFS} 枚 ・ +5 Anlas/枚
                                </span>
                            </div>

                            {preciseList.length > 0 && (
                                <div className="space-y-2">
                                    {preciseList.map((entry, idx) => {
                                        const url = resolvePreciseRefUrl(entry)
                                        return (
                                            <div
                                                key={`${entry.source}:${entry.id}`}
                                                className="flex gap-3 p-2 rounded-lg bg-zinc-800 border border-zinc-700"
                                            >
                                                <div className="w-20 h-20 bg-zinc-950 rounded overflow-hidden shrink-0">
                                                    {url ? (
                                                        <img src={url} alt="" className="w-full h-full object-cover" />
                                                    ) : null}
                                                </div>
                                                <div className="flex-1 min-w-0 space-y-1">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="text-[11px] text-zinc-400 truncate">
                                                            {entry.source === 'character-image' ? 'キャラ画像' : '合成出力'}・
                                                            {entry.id.split('/').pop()}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => removePreciseRef(entry)}
                                                            className="text-zinc-500 hover:text-red-400"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        {(['character', 'style', 'character&style'] as PreciseRefType[]).map((t) => (
                                                            <button
                                                                key={t}
                                                                type="button"
                                                                onClick={() => updatePreciseRef(idx, { type: t })}
                                                                className={`py-1 rounded text-[10px] font-bold border ${
                                                                    entry.type === t
                                                                        ? 'bg-blue-600 border-blue-500 text-white'
                                                                        : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-zinc-200'
                                                                }`}
                                                            >
                                                                {t}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                                                        <span className="w-14">strength</span>
                                                        <input
                                                            type="range"
                                                            min={0}
                                                            max={1}
                                                            step={0.05}
                                                            value={entry.strength}
                                                            onChange={(e) => updatePreciseRef(idx, { strength: Number(e.target.value) })}
                                                            className="flex-1"
                                                        />
                                                        <span className="w-8 text-right font-mono text-zinc-200">{entry.strength.toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                                                        <span className="w-14">fidelity</span>
                                                        <input
                                                            type="range"
                                                            min={0}
                                                            max={1}
                                                            step={0.05}
                                                            value={entry.fidelity}
                                                            onChange={(e) => updatePreciseRef(idx, { fidelity: Number(e.target.value) })}
                                                            className="flex-1"
                                                        />
                                                        <span className="w-8 text-right font-mono text-zinc-200">{entry.fidelity.toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}

                            {preciseList.length < MAX_PRECISE_REFS && (
                                <div className="pt-1">
                                    <div className="text-[10px] text-zinc-500 mb-1.5">追加できるソース</div>
                                    {preciseCandidates.length === 0 ? (
                                        <div className="text-[11px] text-zinc-600">候補なし（参照キャラ画像 or 合成出力を登録してください）</div>
                                    ) : (
                                        <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto pr-1">
                                            {preciseCandidates.map((cand) => {
                                                const selected = isCandidateSelected(cand)
                                                return (
                                                    <button
                                                        key={cand.key}
                                                        type="button"
                                                        onClick={() => addPreciseRef(cand)}
                                                        disabled={selected}
                                                        className={`relative rounded border overflow-hidden aspect-square ${
                                                            selected
                                                                ? 'border-indigo-500 opacity-50 cursor-not-allowed'
                                                                : 'border-zinc-700 hover:border-indigo-500'
                                                        }`}
                                                        title={`${cand.subLabel ?? ''} / ${cand.label}`}
                                                    >
                                                        {cand.url ? (
                                                            <img src={cand.url} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-zinc-600">
                                                                <ImageIcon size={14} />
                                                            </div>
                                                        )}
                                                        {!selected && (
                                                            <div className="absolute inset-0 flex items-end justify-end p-1 opacity-0 hover:opacity-100 bg-black/50 transition-opacity">
                                                                <Plus size={14} className="text-white" />
                                                            </div>
                                                        )}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: preview + gallery + actions */}
                    <div className="border-l border-zinc-800 bg-zinc-950 p-4 flex flex-col gap-3 min-w-0 overflow-y-auto">
                        <div className="text-xs font-bold text-zinc-400 uppercase tracking-wide">プレビュー</div>
                        <div className="bg-zinc-900 rounded-lg border border-zinc-800 flex items-center justify-center overflow-hidden h-[260px] shrink-0">
                            {busy ? (
                                <div className="flex flex-col items-center gap-2 text-zinc-400 text-xs">
                                    <Loader2 size={22} className="animate-spin" />
                                    生成中…（通常 10〜30 秒）
                                </div>
                            ) : selectedEntry ? (
                                <img
                                    src={toDisplayUrl(pathFromRelative(currentProjectPath, selectedEntry.relativePath))}
                                    alt=""
                                    className="max-w-full max-h-full object-contain"
                                />
                            ) : (
                                <div className="text-zinc-600 text-xs">未生成</div>
                            )}
                        </div>

                        {selectedEntry && !busy && (
                            <div className="text-[10px] text-zinc-500 font-mono flex items-center justify-between gap-2">
                                <span>seed: {selectedEntry.seed}{selectedEntry.width && selectedEntry.height ? ` ・ ${selectedEntry.width}×${selectedEntry.height}` : ''}</span>
                                {panel.imagePath === selectedEntry.relativePath && (
                                    <span className="text-emerald-400 text-[10px] font-sans font-bold">採用中</span>
                                )}
                            </div>
                        )}

                        {error && (
                            <div className="text-xs text-red-400 break-all bg-red-900/20 border border-red-900/40 rounded p-2">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2 shrink-0">
                            <button
                                type="button"
                                onClick={() => handleGenerate(true)}
                                disabled={!canGenerate}
                                className="w-full flex items-center justify-between gap-2 py-2.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <span className="flex items-center gap-2">
                                    {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                    {history.length > 0 ? '新しく描画（別 seed）' : '生成'}
                                </span>
                                <span className="text-[11px] font-mono bg-indigo-800/60 px-2 py-0.5 rounded">
                                    {costLabel}
                                </span>
                            </button>
                            {selectedEntry && !busy && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => handleGenerate(false)}
                                        className="w-full flex items-center justify-between gap-2 py-2 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-bold"
                                    >
                                        <span className="flex items-center gap-2">
                                            <RefreshCw size={14} />
                                            同じ seed で再描画
                                        </span>
                                        <span className="text-[10px] font-mono bg-zinc-900 px-1.5 py-0.5 rounded">
                                            {costLabel}
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleAdopt}
                                        disabled={panel.imagePath === selectedEntry.relativePath}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <Check size={16} />
                                        {panel.imagePath === selectedEntry.relativePath ? 'これを採用中' : 'このコマに採用'}
                                    </button>
                                </>
                            )}
                            <button
                                type="button"
                                onClick={handleClose}
                                disabled={busy}
                                className="w-full py-2 rounded-lg text-zinc-400 hover:text-zinc-200 text-xs disabled:opacity-40"
                            >
                                閉じる
                            </button>
                        </div>

                        {/* Gallery */}
                        <div className="border-t border-zinc-800 pt-3 space-y-2 shrink-0">
                            <div className="flex items-center justify-between">
                                <div className="text-xs font-bold text-zinc-400 uppercase tracking-wide">このコマの生成履歴</div>
                                <div className="text-[10px] text-zinc-500">{history.length} 枚</div>
                            </div>
                            {history.length === 0 ? (
                                <div className="text-[11px] text-zinc-600">まだ生成されていません。</div>
                            ) : (
                                <div className="grid grid-cols-3 gap-1.5">
                                    {[...history].reverse().map((h) => {
                                        const isSel = selectedRelativePath === h.relativePath
                                        const isAdopted = panel.imagePath === h.relativePath
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
                                                        setSelectedRelativePath(h.relativePath)
                                                        setZoomedRelativePath(h.relativePath)
                                                    }}
                                                    className="absolute inset-0"
                                                    title={`クリックで拡大 / seed: ${h.seed} / ${new Date(h.createdAt).toLocaleString()}`}
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
                                                    onClick={(e) => { e.stopPropagation(); void handleDeleteHistory(h) }}
                                                    disabled={busy}
                                                    className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black/60 text-zinc-300 hover:text-red-400 disabled:opacity-40"
                                                    title="この生成を削除（assets/dust/ へ移動）"
                                                >
                                                    <Trash2 size={10} />
                                                </button>
                                                <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 bg-black/60 text-[8px] font-mono text-zinc-300 truncate">
                                                    {h.seed}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {zoomedRelativePath && (() => {
                const entry = history.find((h) => h.relativePath === zoomedRelativePath)
                if (!entry) return null
                const url = toDisplayUrl(pathFromRelative(currentProjectPath, entry.relativePath))
                const sortedByNew = [...history].reverse()
                const curIdx = sortedByNew.findIndex((h) => h.relativePath === entry.relativePath)
                const prev = curIdx > 0 ? sortedByNew[curIdx - 1] : null
                const next = curIdx >= 0 && curIdx < sortedByNew.length - 1 ? sortedByNew[curIdx + 1] : null
                return (
                    <div
                        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-sm p-8"
                        onClick={() => setZoomedRelativePath(null)}
                    >
                        <div
                            className="relative flex flex-col items-center gap-3 max-w-full max-h-full"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                type="button"
                                onClick={() => setZoomedRelativePath(null)}
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
                                    onClick={() => prev && setZoomedRelativePath(prev.relativePath)}
                                    disabled={!prev}
                                    className="text-zinc-400 hover:text-white disabled:opacity-30 px-1"
                                    title="前（新しい）"
                                >◀</button>
                                <span>seed: {entry.seed}</span>
                                {entry.width && entry.height && (
                                    <span className="text-zinc-500">{entry.width}×{entry.height}</span>
                                )}
                                <span className="text-zinc-500 text-[10px]">{new Date(entry.createdAt).toLocaleString()}</span>
                                {panel.imagePath === entry.relativePath && (
                                    <span className="text-emerald-400 text-[10px] font-sans font-bold">採用中</span>
                                )}
                                <button
                                    type="button"
                                    onClick={() => next && setZoomedRelativePath(next.relativePath)}
                                    disabled={!next}
                                    className="text-zinc-400 hover:text-white disabled:opacity-30 px-1"
                                    title="次（古い）"
                                >▶</button>
                            </div>
                        </div>
                    </div>
                )
            })()}
        </div>
    )
}
