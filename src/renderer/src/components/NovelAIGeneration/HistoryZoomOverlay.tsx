import React, { useEffect, useRef, useState } from 'react'
import { X, Paintbrush, Loader2, Eraser, Wand2, Trash2, Grid2x2 } from 'lucide-react'
import type { NovelAIHistoryEntry } from '../../store/types'
import { showError } from '../../utils/dialogs'
import { SCREEN_TONE_CATALOG } from '../../utils/screenToneCatalog'
import { pathFromRelative, toDisplayUrl } from './types'

// マスク（再描画範囲）の表示色。白黒漫画の上でも見えるよう鮮やかな赤ピンクにする。
// infill のマスク判定はアルファ値だけを見るので、表示色は結果に影響しない。
const MASK_COLOR = '#ff2d55'

type Props = {
    relativePath: string
    history: NovelAIHistoryEntry[]
    currentProjectPath: string | null
    adoptedRelativePath: string | null | undefined
    onClose: () => void
    onSelect: (rel: string) => void
    /**
     * 部分再描画。塗ったマスク（白=再描画 の data URL）を渡すと infill を実行し、
     * 新しい履歴エントリを返す（失敗・キャンセル時は null）。
     */
    onInpaint?: (
        sourceRelativePath: string,
        maskDataUrl: string,
        inpaintPrompt: string,
        /** 背景（マスク領域）のぼかし強度 0..1。0 で無効。 */
        backgroundBlur: number
    ) => Promise<NovelAIHistoryEntry | null>
    /**
     * 背景マスク自動生成（rembg）。元画像から「背景＝白(再描画)」のマスク data URL を返す。
     * 渡されると部分再描画モードに「背景を自動選択」ボタンと「背景だけ再描画」導線が出る。
     */
    onBackgroundMask?: (sourceRelativePath: string) => Promise<string | null>
    /**
     * 背景をスクリーントーンに差し替える。rembg で前景を切り抜き、選んだトーンを敷いた背景へ
     * 重ねて合成し、新しい履歴エントリを返す（失敗・キャンセル時は null）。
     * 渡されると「背景をトーンに」ボタンが出る。
     */
    onToneBackground?: (
        sourceRelativePath: string,
        toneId: string,
        scale: number
    ) => Promise<NovelAIHistoryEntry | null>
}

export const HistoryZoomOverlay: React.FC<Props> = ({
    relativePath,
    history,
    currentProjectPath,
    adoptedRelativePath,
    onClose,
    onSelect,
    onInpaint,
    onBackgroundMask,
    onToneBackground
}) => {
    const [inpaint, setInpaint] = useState(false)
    const [inpaintPrompt, setInpaintPrompt] = useState('')
    const [brush, setBrush] = useState(48)
    const [erase, setErase] = useState(false)
    // 背景ぼかし強度（0〜100%）。背景だけ再描画で被写界深度風にしたいとき使う。
    const [bgBlur, setBgBlur] = useState(0)
    // 背景トーン差し替えのピッカー表示・タイル倍率・合成中フラグ
    const [tonePickerOpen, setTonePickerOpen] = useState(false)
    const [toneScale, setToneScale] = useState(1)
    const [toneBusy, setToneBusy] = useState(false)
    const [busy, setBusy] = useState(false)
    // 背景マスク生成（rembg）中フラグ。infill の busy とは分けて、
    // 「再描画」ボタンが回って“再描画が走っている”ように見えるのを防ぐ。
    const [maskBusy, setMaskBusy] = useState(false)
    // ブラシサイズのプレビューリング（カーソル追従、画面 px）
    const [cursor, setCursor] = useState<{ x: number; y: number; d: number } | null>(null)
    const maskRef = useRef<HTMLCanvasElement>(null)
    const paintRef = useRef<{ x: number; y: number } | null>(null)
    // inpaint モードに入った直後だけマスクをクリアする。再描画後の画像差し替えでは塗りを保持。
    const resetMaskRef = useRef(true)
    // 「背景だけ再描画」で入ったときは、マスクサイズ確定後に背景を自動選択する
    const pendingAutoBgRef = useRef(false)

    useEffect(() => {
        const onKey = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') {
                e.stopPropagation()
                if (inpaint) setInpaint(false)
                else onClose()
                return
            }
            // 部分再描画中は前後ナビを無効化（誤操作で塗りが消えるのを防ぐ）
            if (inpaint) return
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                const sortedByNew = [...history].reverse()
                const idx = sortedByNew.findIndex((h) => h.relativePath === relativePath)
                if (idx < 0) return
                const nextIdx = e.key === 'ArrowLeft' ? idx - 1 : idx + 1
                if (nextIdx >= 0 && nextIdx < sortedByNew.length) {
                    onSelect(sortedByNew[nextIdx].relativePath)
                }
            }
        }
        window.addEventListener('keydown', onKey, true)
        return () => window.removeEventListener('keydown', onKey, true)
    }, [relativePath, history, onClose, onSelect, inpaint])

    const entry = history.find((h) => h.relativePath === relativePath)
    if (!entry) return null
    const url = toDisplayUrl(pathFromRelative(currentProjectPath, entry.relativePath))
    const sortedByNew = [...history].reverse()
    const curIdx = sortedByNew.findIndex((h) => h.relativePath === entry.relativePath)
    const prev = curIdx > 0 ? sortedByNew[curIdx - 1] : null
    const next = curIdx >= 0 && curIdx < sortedByNew.length - 1 ? sortedByNew[curIdx + 1] : null

    // 表示中の画像が読み込めたらマスクキャンバスを元画像の実サイズに合わせる
    const handleImgLoad = (e: React.SyntheticEvent<HTMLImageElement>): void => {
        const img = e.currentTarget
        const mask = maskRef.current
        if (!mask) return
        const w = img.naturalWidth
        const h = img.naturalHeight
        const sizeChanged = mask.width !== w || mask.height !== h
        if (resetMaskRef.current || sizeChanged) {
            mask.width = w
            mask.height = h
            mask.getContext('2d')?.clearRect(0, 0, w, h)
            resetMaskRef.current = false
        }
        // 「背景だけ再描画」導線：マスクサイズが確定したので背景を自動選択する
        if (pendingAutoBgRef.current) {
            pendingAutoBgRef.current = false
            void autoFillBackground()
        }
    }

    // rembg のアルファから背景マスクを取得し、マスクキャンバスに白(=再描画)で流し込む
    async function autoFillBackground(): Promise<void> {
        const mask = maskRef.current
        if (!mask || !onBackgroundMask || !entry) return
        setMaskBusy(true)
        try {
            const maskUrl = await onBackgroundMask(entry.relativePath)
            if (!maskUrl) {
                await showError('背景マスクを生成できませんでした（背景除去に失敗した可能性があります）')
                return
            }
            await new Promise<void>((resolve, reject) => {
                const img = new Image()
                img.onload = () => {
                    const ctx = mask.getContext('2d')
                    if (!ctx) return reject(new Error('canvas が使えません'))
                    ctx.clearRect(0, 0, mask.width, mask.height)
                    ctx.globalCompositeOperation = 'source-over'
                    ctx.drawImage(img, 0, 0, mask.width, mask.height)
                    // 白い自動マスクを視認しやすい色に置き換える（アルファ＝選択範囲は保持）
                    ctx.globalCompositeOperation = 'source-in'
                    ctx.fillStyle = MASK_COLOR
                    ctx.fillRect(0, 0, mask.width, mask.height)
                    ctx.globalCompositeOperation = 'source-over'
                    resolve()
                }
                img.onerror = () => reject(new Error('背景マスクの読み込みに失敗しました'))
                img.src = maskUrl
            })
        } catch (e) {
            await showError(e instanceof Error ? e.message : String(e))
        } finally {
            setMaskBusy(false)
        }
    }

    // rembg で前景を切り抜き、選んだトーンを背景に敷いて合成する
    async function applyToneBackground(toneId: string): Promise<void> {
        if (!onToneBackground || !entry || toneBusy) return
        setToneBusy(true)
        try {
            const result = await onToneBackground(entry.relativePath, toneId, toneScale)
            if (result) {
                setTonePickerOpen(false)
                onSelect(result.relativePath)
            }
        } catch (e) {
            await showError(e instanceof Error ? e.message : String(e))
        } finally {
            setToneBusy(false)
        }
    }

    // ---- マスクブラシ ----
    function maskXY(e: React.PointerEvent): { x: number; y: number } {
        const m = maskRef.current!
        const rect = m.getBoundingClientRect()
        return {
            x: ((e.clientX - rect.left) / rect.width) * m.width,
            y: ((e.clientY - rect.top) / rect.height) * m.height
        }
    }
    function paintStroke(from: { x: number; y: number } | null, to: { x: number; y: number }): void {
        const ctx = maskRef.current?.getContext('2d')
        if (!ctx) return
        // 消しゴム時は destination-out で塗りを削る
        ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over'
        ctx.fillStyle = MASK_COLOR
        ctx.strokeStyle = MASK_COLOR
        ctx.lineCap = 'round'
        ctx.lineWidth = brush
        ctx.beginPath()
        ctx.arc(to.x, to.y, brush / 2, 0, Math.PI * 2)
        ctx.fill()
        if (from) {
            ctx.beginPath()
            ctx.moveTo(from.x, from.y)
            ctx.lineTo(to.x, to.y)
            ctx.stroke()
        }
        ctx.globalCompositeOperation = 'source-over'
    }
    function maskDown(e: React.PointerEvent): void {
        if (busy || maskBusy) return
        const p = maskXY(e)
        paintRef.current = p
        paintStroke(null, p)
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    }
    function maskMove(e: React.PointerEvent): void {
        const m = maskRef.current
        if (m) {
            const rect = m.getBoundingClientRect()
            setCursor({ x: e.clientX, y: e.clientY, d: (brush * rect.width) / m.width })
        }
        if (!paintRef.current) return
        const p = maskXY(e)
        paintStroke(paintRef.current, p)
        paintRef.current = p
    }
    function maskUp(): void {
        paintRef.current = null
    }
    function clearMask(): void {
        const m = maskRef.current
        m?.getContext('2d')?.clearRect(0, 0, m.width, m.height)
    }

    async function runInpaint(): Promise<void> {
        const mask = maskRef.current
        if (!mask || !onInpaint || !entry) return
        // 塗った領域があるか確認
        const data = mask.getContext('2d')?.getImageData(0, 0, mask.width, mask.height).data
        if (!data || !data.some((_, i) => i % 4 === 3 && data[i] > 0)) {
            await showError('再描画する範囲をブラシで塗ってください')
            return
        }
        setBusy(true)
        try {
            // NAI v4 は mask を 8px の latent グリッドに丸める（resize_to_naimask）。
            // 1/8 に縮小 → 8倍に戻す（nearest）でブロック単位に二値化し、
            // アンチエイリアスのグレー縁が継ぎ目になるのを防ぐ。出力 = 白(再描画) on 透明。
            const sw = Math.max(1, Math.round(mask.width / 8))
            const sh = Math.max(1, Math.round(mask.height / 8))
            const small = document.createElement('canvas')
            small.width = sw
            small.height = sh
            const sctx = small.getContext('2d')
            if (!sctx) throw new Error('canvas が使えません')
            sctx.imageSmoothingEnabled = false
            sctx.drawImage(mask, 0, 0, sw, sh)

            const out = document.createElement('canvas')
            out.width = mask.width
            out.height = mask.height
            const octx = out.getContext('2d')
            if (!octx) throw new Error('canvas が使えません')
            octx.imageSmoothingEnabled = false
            octx.drawImage(small, 0, 0, out.width, out.height)
            const id = octx.getImageData(0, 0, out.width, out.height)
            const px = id.data
            for (let i = 0; i < px.length; i += 4) {
                const painted = px[i + 3] > 32 // ブロック内に塗りがあるか
                px[i] = px[i + 1] = px[i + 2] = painted ? 255 : 0
                px[i + 3] = painted ? 255 : 0
            }
            octx.putImageData(id, 0, 0)

            const result = await onInpaint(entry.relativePath, out.toDataURL('image/png'), inpaintPrompt, bgBlur / 100)
            if (result) {
                // 結果画像へ切り替え。マスクは保持（resetMaskRef は false のまま）し、
                // 同じ範囲を続けて描き直せるようにする。
                onSelect(result.relativePath)
            }
        } catch (e) {
            await showError(e instanceof Error ? e.message : String(e))
        } finally {
            setBusy(false)
        }
    }

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-sm p-8"
            onClick={() => { if (!inpaint && !busy) onClose() }}
        >
            <div
                className="relative flex flex-col items-center gap-3 max-w-full max-h-full"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    type="button"
                    onClick={() => { if (inpaint) setInpaint(false); else onClose() }}
                    disabled={busy || maskBusy}
                    className="absolute -top-1 -right-1 translate-x-full p-2 rounded-full bg-zinc-900/90 text-zinc-200 hover:text-white hover:bg-zinc-800 border border-zinc-700 disabled:opacity-40"
                    title={inpaint ? '部分再描画を終了 (Esc)' : '閉じる (Esc)'}
                >
                    <X size={18} />
                </button>

                {url ? (
                    inpaint ? (
                        // 画像と同サイズのマスクキャンバスを重ねる。両者とも同じ max 制約・同じアスペクト比
                        // なので m-auto で中央寄せすればぴったり重なる。
                        <div className="relative flex items-center justify-center">
                            <img
                                src={url}
                                alt=""
                                onLoad={handleImgLoad}
                                className="max-w-[92vw] max-h-[78vh] object-contain rounded-lg shadow-2xl border border-zinc-800 select-none"
                            />
                            <canvas
                                ref={maskRef}
                                onPointerDown={maskDown}
                                onPointerMove={maskMove}
                                onPointerUp={maskUp}
                                onPointerLeave={() => setCursor(null)}
                                className="absolute inset-0 m-auto max-w-[92vw] max-h-[78vh] cursor-crosshair touch-none rounded-lg opacity-60"
                            />
                            {cursor && (
                                <div
                                    className="pointer-events-none fixed z-[80] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-white mix-blend-difference"
                                    style={{ left: cursor.x, top: cursor.y, width: cursor.d, height: cursor.d }}
                                />
                            )}
                        </div>
                    ) : (
                        <img
                            src={url}
                            alt=""
                            className="max-w-[92vw] max-h-[82vh] object-contain rounded-lg shadow-2xl border border-zinc-800"
                        />
                    )
                ) : (
                    <div className="text-zinc-500 text-sm">画像を読み込めませんでした</div>
                )}

                {inpaint ? (
                    <div className="flex w-full max-w-3xl items-center gap-2 bg-zinc-900/85 border border-zinc-800 rounded-xl px-3 py-2">
                        <input
                            value={inpaintPrompt}
                            onChange={(e) => setInpaintPrompt(e.target.value)}
                            placeholder="塗った範囲に描く内容（任意・英語タグ。例: open mouth）"
                            className="flex-1 min-w-0 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-indigo-500"
                        />
                        {onBackgroundMask && (
                            <button
                                type="button"
                                onClick={() => void autoFillBackground()}
                                disabled={busy || maskBusy}
                                className="flex shrink-0 items-center gap-1.5 rounded-md border border-emerald-700/60 bg-emerald-600/15 px-3 py-1.5 text-sm text-emerald-300 hover:bg-emerald-600/25 disabled:opacity-40"
                                title="rembg で背景を自動でマスク（白=再描画）"
                            >
                                {maskBusy ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                                {maskBusy ? '背景を解析中…' : '背景を自動選択'}
                            </button>
                        )}
                        <div className="flex shrink-0 items-center gap-0.5 rounded-md border border-zinc-700 p-0.5">
                            <button
                                type="button"
                                onClick={() => setErase(false)}
                                className={`rounded p-1.5 ${!erase ? 'bg-indigo-600 text-white' : 'text-zinc-300 hover:bg-white/10'}`}
                                title="ブラシ（塗る）"
                            >
                                <Paintbrush size={14} />
                            </button>
                            <button
                                type="button"
                                onClick={() => setErase(true)}
                                className={`rounded p-1.5 ${erase ? 'bg-indigo-600 text-white' : 'text-zinc-300 hover:bg-white/10'}`}
                                title="消しゴム（マスクを削る）"
                            >
                                <Eraser size={14} />
                            </button>
                        </div>
                        <label className="flex shrink-0 items-center gap-1 text-[11px] text-zinc-400">
                            太さ
                            <input
                                type="range"
                                min={8}
                                max={160}
                                value={brush}
                                onChange={(e) => setBrush(Number(e.target.value))}
                                className="w-20"
                            />
                        </label>
                        <label
                            className="flex shrink-0 items-center gap-1 text-[11px] text-zinc-400"
                            title="再描画した領域（背景だけ再描画なら背景）を後処理でぼかす。0% で無効。"
                        >
                            背景ぼかし
                            <input
                                type="range"
                                min={0}
                                max={100}
                                value={bgBlur}
                                onChange={(e) => setBgBlur(Number(e.target.value))}
                                className="w-20"
                            />
                            <span className="w-8 tabular-nums text-zinc-500">{bgBlur}%</span>
                        </label>
                        <button
                            type="button"
                            onClick={() => void runInpaint()}
                            disabled={busy || maskBusy}
                            className="flex shrink-0 items-center gap-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 px-4 py-1.5 text-sm font-bold text-white disabled:opacity-40"
                        >
                            {busy ? <Loader2 size={14} className="animate-spin" /> : <Paintbrush size={14} />}
                            再描画
                        </button>
                        <button
                            type="button"
                            onClick={clearMask}
                            disabled={busy || maskBusy}
                            className="flex shrink-0 items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/10 disabled:opacity-40"
                        >
                            <Trash2 size={14} /> クリア
                        </button>
                        <button
                            type="button"
                            onClick={() => setInpaint(false)}
                            disabled={busy || maskBusy}
                            className="shrink-0 rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/10 disabled:opacity-40"
                        >
                            完了
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-3 text-xs text-zinc-300 font-mono bg-zinc-900/80 border border-zinc-800 rounded-full px-4 py-1.5">
                        <button
                            type="button"
                            onClick={() => prev && onSelect(prev.relativePath)}
                            disabled={!prev}
                            className="text-zinc-400 hover:text-white disabled:opacity-30 px-1"
                            title="前（新しい）"
                        >◀</button>
                        <span>{entry.imported ? '外部読込' : `seed: ${entry.seed}`}</span>
                        {entry.width && entry.height && (
                            <span className="text-zinc-500">{entry.width}×{entry.height}</span>
                        )}
                        <span className="text-zinc-500 text-[10px]">{new Date(entry.createdAt).toLocaleString()}</span>
                        {adoptedRelativePath === entry.relativePath && (
                            <span className="text-emerald-400 text-[10px] font-sans font-bold">採用中</span>
                        )}
                        <button
                            type="button"
                            onClick={() => next && onSelect(next.relativePath)}
                            disabled={!next}
                            className="text-zinc-400 hover:text-white disabled:opacity-30 px-1"
                            title="次（古い）"
                        >▶</button>
                        {onInpaint && (
                            <button
                                type="button"
                                onClick={() => {
                                    resetMaskRef.current = true // 入った直後はマスクを新規に
                                    setErase(false)
                                    setCursor(null)
                                    setInpaint(true)
                                }}
                                className="ml-1 flex items-center gap-1.5 rounded-full bg-indigo-600/90 hover:bg-indigo-500 px-3 py-1 text-[11px] font-sans font-bold text-white"
                                title="塗った範囲だけを再生成（NovelAI infill）"
                            >
                                <Paintbrush size={12} /> 部分再描画
                            </button>
                        )}
                        {onInpaint && onBackgroundMask && (
                            <button
                                type="button"
                                onClick={() => {
                                    resetMaskRef.current = true
                                    pendingAutoBgRef.current = true // マスク確定後に背景を自動選択
                                    setErase(false)
                                    setCursor(null)
                                    setInpaint(true)
                                }}
                                className="flex items-center gap-1.5 rounded-full bg-emerald-600/90 hover:bg-emerald-500 px-3 py-1 text-[11px] font-sans font-bold text-white"
                                title="rembg で背景を自動マスクして、背景だけ NovelAI で描き直す"
                            >
                                <Wand2 size={12} /> 背景だけ再描画
                            </button>
                        )}
                        {onToneBackground && (
                            <button
                                type="button"
                                onClick={() => setTonePickerOpen(true)}
                                className="flex items-center gap-1.5 rounded-full bg-sky-600/90 hover:bg-sky-500 px-3 py-1 text-[11px] font-sans font-bold text-white"
                                title="rembg で前景を切り抜き、背景をスクリーントーンに差し替える"
                            >
                                <Grid2x2 size={12} /> 背景をトーンに
                            </button>
                        )}
                    </div>
                )}
            </div>

            {tonePickerOpen && onToneBackground && (
                <div
                    className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-6"
                    onClick={() => { if (!toneBusy) setTonePickerOpen(false) }}
                >
                    <div
                        className="relative flex max-h-[82vh] w-[600px] max-w-[92vw] flex-col gap-3 rounded-2xl border border-zinc-700 bg-zinc-900 p-4 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between">
                            <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                                <Grid2x2 size={16} className="text-sky-400" />
                                背景に敷くトーンを選ぶ
                            </h3>
                            <button
                                type="button"
                                onClick={() => { if (!toneBusy) setTonePickerOpen(false) }}
                                className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                                title="閉じる"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <label className="flex items-center gap-3 text-xs text-zinc-400">
                            <span className="shrink-0 w-16">タイルの大きさ</span>
                            <input
                                type="range"
                                min={0.3}
                                max={3}
                                step={0.1}
                                value={toneScale}
                                onChange={(e) => setToneScale(Number(e.target.value))}
                                className="flex-1 accent-sky-500"
                            />
                            <span className="w-10 text-right font-mono text-zinc-500">{Math.round(toneScale * 100)}%</span>
                        </label>
                        <p className="text-[11px] text-zinc-500">
                            前景（キャラ）を自動で切り抜いて、選んだトーンの上に重ねます。クリックで合成します。
                        </p>
                        <div className="grid grid-cols-6 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-8">
                            {SCREEN_TONE_CATALOG.map((tone) => (
                                <button
                                    key={tone.id}
                                    type="button"
                                    onClick={() => void applyToneBackground(tone.id)}
                                    disabled={toneBusy}
                                    className="aspect-square overflow-hidden rounded-lg border border-zinc-700 bg-white hover:border-sky-500 disabled:opacity-40"
                                    title={tone.name}
                                >
                                    <img src={tone.dataUrl} alt="" className="h-full w-full object-cover" />
                                </button>
                            ))}
                        </div>
                        {toneBusy && (
                            <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-2xl bg-zinc-950/70 text-sm text-zinc-200">
                                <Loader2 size={16} className="animate-spin" /> 背景を合成中…
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
