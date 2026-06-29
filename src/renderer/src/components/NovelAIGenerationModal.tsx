import React, { useEffect, useMemo, useState } from 'react'
import { X, Sparkles, Loader2, RefreshCw, Check, Maximize2 } from 'lucide-react'
import { useMangaStore } from '../store/useMangaStore'
import type {
    NovelAIAspect,
    NovelAIHistoryEntry,
    NovelAIPanelConfig,
    Panel,
    PreciseReferenceEntry,
    PreciseRefType,
    ReferenceCharacter
} from '../store/types'
import { normalizeReferenceImageToBase64Png } from '../utils/novelaiReferenceImage'
import { showError } from '../utils/dialogs'
import {
    ASPECT_DIMS,
    estimateBaseAnlas,
    MAX_CHARACTER_REFS,
    MAX_PRECISE_REFS,
    pathFromRelative,
    toDisplayUrl,
    type PreciseRefCandidate
} from './NovelAIGeneration/types'
import { CharacterRefSelector } from './NovelAIGeneration/CharacterRefSelector'
import { PreciseRefList } from './NovelAIGeneration/PreciseRefList'
import { HistoryGallery } from './NovelAIGeneration/HistoryGallery'
import { HistoryZoomOverlay } from './NovelAIGeneration/HistoryZoomOverlay'

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

    const persistForm = (next: NovelAIPanelConfig, historyOverride?: NovelAIHistoryEntry[]): void => {
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

    const handleClose = (): void => {
        persistForm(form)
        close()
    }

    const selectedCharacters: ReferenceCharacter[] = useMemo(() => {
        const ids = form.characterRefIds ?? []
        const out: ReferenceCharacter[] = []
        for (const id of ids) {
            const hit = referenceCharacters.find((c) => c.id === id)
            if (hit) out.push(hit)
        }
        return out
    }, [referenceCharacters, form.characterRefIds])

    const toggleCharacterRef = (id: string): void => {
        const cur = form.characterRefIds ?? []
        if (cur.includes(id)) {
            // キャラを外したら、そのキャラの画像精密参照も併せて外す（迷子防止）
            setForm({
                ...form,
                characterRefIds: cur.filter((v) => v !== id),
                preciseRefs: (form.preciseRefs ?? []).filter(
                    (r) => !(r.source === 'character-image' && r.id.startsWith(`${id}/`))
                )
            })
            return
        }
        if (cur.length >= MAX_CHARACTER_REFS) return
        setForm({ ...form, characterRefIds: [...cur, id] })
    }

    const moveCharacterRef = (id: string, dir: -1 | 1): void => {
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

    const addPreciseRef = (cand: PreciseRefCandidate): void => {
        const cur = form.preciseRefs ?? []
        if (cur.length >= MAX_PRECISE_REFS) return
        if (cur.some((r) => r.source === cand.source && r.id === cand.id)) return
        const entry: PreciseReferenceEntry = {
            source: cand.source,
            id: cand.id,
            strength: 0.7,
            fidelity: 0.7,
            type: 'character'
        }
        // キャラクター画像を精密参照に追加するときは、同じキャラのプロンプト参照も自動で有効化する
        // （プロンプト参照の付け忘れ防止）。キャラ参照枠が満杯のときは黙ってスキップ。
        let nextCharRefIds = form.characterRefIds ?? []
        if (cand.source === 'character-image') {
            const charId = cand.id.split('/')[0]
            if (
                charId &&
                !nextCharRefIds.includes(charId) &&
                nextCharRefIds.length < MAX_CHARACTER_REFS
            ) {
                nextCharRefIds = [...nextCharRefIds, charId]
            }
        }
        setForm({ ...form, preciseRefs: [...cur, entry], characterRefIds: nextCharRefIds })
    }

    const removePreciseRef = (entry: PreciseReferenceEntry): void => {
        setForm({
            ...form,
            preciseRefs: (form.preciseRefs ?? []).filter(
                (r) => !(r.source === entry.source && r.id === entry.id)
            )
        })
    }

    const updatePreciseRef = (idx: number, patch: Partial<PreciseReferenceEntry>): void => {
        const cur = form.preciseRefs ?? []
        const next = cur.map((r, i) => (i === idx ? { ...r, ...patch } : r))
        setForm({ ...form, preciseRefs: next })
    }

    /** キャラ画像（character-image）の精密参照 ON/OFF。CharacterRefSelector から呼ばれる。 */
    const togglePreciseRefById = (source: 'character-image', id: string): void => {
        const cur = form.preciseRefs ?? []
        const existsIdx = cur.findIndex((r) => r.source === source && r.id === id)
        if (existsIdx >= 0) {
            setForm({ ...form, preciseRefs: cur.filter((_, i) => i !== existsIdx) })
            return
        }
        if (cur.length >= MAX_PRECISE_REFS) return
        const entry: PreciseReferenceEntry = {
            source,
            id,
            strength: 0.7,
            fidelity: 0.7,
            type: 'character'
        }
        setForm({ ...form, preciseRefs: [...cur, entry] })
    }

    /** キャラ画像精密参照の strength/fidelity/type 更新。CharacterRefSelector から呼ばれる。 */
    const updatePreciseRefById = (
        source: 'character-image',
        id: string,
        patch: Partial<PreciseReferenceEntry>
    ): void => {
        const cur = form.preciseRefs ?? []
        setForm({
            ...form,
            preciseRefs: cur.map((r) => (r.source === source && r.id === id ? { ...r, ...patch } : r))
        })
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

    const handleGenerate = async (reseed: boolean): Promise<void> => {
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

    const handleAdopt = (): void => {
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

    const handleDeleteHistory = async (entry: NovelAIHistoryEntry): Promise<void> => {
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

    /**
     * 部分再描画（infill）。拡大オーバーレイから呼ばれる。塗ったマスク領域だけを再生成し、
     * 結果を新しい履歴エントリとして追加して選択する。成功時はそのエントリを返す。
     */
    const handleInpaint = async (
        sourceRelativePath: string,
        maskDataUrl: string,
        inpaintPrompt: string
    ): Promise<NovelAIHistoryEntry | null> => {
        if (!window.electron?.novelaiInpaint || !panel || !currentProjectPath) return null
        const charPromptsPayload = selectedCharacters
            .map((c) => ({ prompt: (c.positivePrompt ?? '').trim(), uc: (c.negativePrompt ?? '').trim() }))
            .filter((p) => !!p.prompt)
        const negOverride = (form.negativeOverride ?? '').trim()
        // 再描画元の画像が持つ seed を使う（構図の一貫性を保つ。見つからなければ直近 seed）
        const sourceEntry = history.find((h) => h.relativePath === sourceRelativePath)
        const resp = await window.electron.novelaiInpaint({
            projectPath: currentProjectPath,
            panelId: panel.id,
            sourceRelativePath,
            maskBase64Png: maskDataUrl,
            situationPrompt: form.situationPrompt ?? '',
            supplementaryPrompt: (form.supplementaryPrompt ?? '').trim(),
            inpaintPrompt: inpaintPrompt.trim() || undefined,
            characterPrompts: charPromptsPayload,
            negativeOverride: negOverride || undefined,
            seed: sourceEntry?.seed ?? form.lastSeed ?? null
        })
        if (!resp.ok) {
            await showError(`部分再描画に失敗しました: ${resp.error}${resp.status ? ` (${resp.status})` : ''}${resp.message ? ` ${resp.message}` : ''}`)
            return null
        }
        const entry: NovelAIHistoryEntry = {
            relativePath: resp.relativePath,
            seed: resp.seed,
            createdAt: resp.createdAt,
            situationPrompt: (form.situationPrompt ?? '').trim() || undefined,
            supplementaryPrompt: (form.supplementaryPrompt ?? '').trim() || undefined,
            aspect: form.aspect ?? 'portrait',
            width: resp.width,
            height: resp.height
        }
        const nextHistory = [...(panel.novelai?.history ?? []), entry]
        const nextForm = { ...form, lastSeed: resp.seed }
        setForm(nextForm)
        persistForm(nextForm, nextHistory)
        setSelectedRelativePath(entry.relativePath)
        // 消費した Anlas を残高表示に反映
        testNovelAIConnection().catch(() => { /* ignore */ })
        return entry
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

                        <CharacterRefSelector
                            referenceCharacters={referenceCharacters}
                            selectedCharacterIds={form.characterRefIds ?? []}
                            preciseRefs={preciseList}
                            currentProjectPath={currentProjectPath}
                            onToggle={toggleCharacterRef}
                            onMove={moveCharacterRef}
                            onTogglePreciseRef={togglePreciseRefById}
                            onUpdatePreciseRef={updatePreciseRefById}
                        />

                        <PreciseRefList
                            preciseList={preciseList.filter((r) => r.source === 'composite')}
                            candidates={preciseCandidates.filter((c) => c.source === 'composite')}
                            onAdd={addPreciseRef}
                            onRemove={removePreciseRef}
                            onUpdate={(idx, patch) => {
                                // PreciseRefList が渡す idx は「composite だけに絞ったリスト」のもの。
                                // 元の preciseRefs 配列での実 index に変換してから更新する。
                                const filtered = preciseList.filter((r) => r.source === 'composite')
                                const target = filtered[idx]
                                if (!target) return
                                const realIdx = preciseList.findIndex(
                                    (r) => r.source === target.source && r.id === target.id
                                )
                                if (realIdx >= 0) updatePreciseRef(realIdx, patch)
                            }}
                            resolveUrl={resolvePreciseRefUrl}
                        />
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
                                <button
                                    type="button"
                                    onClick={() => setZoomedRelativePath(selectedEntry.relativePath)}
                                    title="クリックで拡大（拡大表示から部分再描画できます）"
                                    className="group relative w-full h-full flex items-center justify-center cursor-zoom-in"
                                >
                                    <img
                                        src={toDisplayUrl(pathFromRelative(currentProjectPath, selectedEntry.relativePath))}
                                        alt=""
                                        className="max-w-full max-h-full object-contain"
                                    />
                                    <span className="absolute bottom-1 right-1 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/60 text-[10px] text-zinc-200 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Maximize2 size={11} /> 拡大
                                    </span>
                                </button>
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

                        <HistoryGallery
                            history={history}
                            currentProjectPath={currentProjectPath}
                            selectedRelativePath={selectedRelativePath}
                            adoptedRelativePath={panel.imagePath}
                            busy={busy}
                            onSelect={setSelectedRelativePath}
                            onZoom={setZoomedRelativePath}
                            onDelete={(entry) => void handleDeleteHistory(entry)}
                        />
                    </div>
                </div>
            </div>

            {zoomedRelativePath && (
                <HistoryZoomOverlay
                    relativePath={zoomedRelativePath}
                    history={history}
                    currentProjectPath={currentProjectPath}
                    adoptedRelativePath={panel.imagePath}
                    onClose={() => setZoomedRelativePath(null)}
                    onSelect={setZoomedRelativePath}
                    onInpaint={handleInpaint}
                />
            )}
        </div>
    )
}
