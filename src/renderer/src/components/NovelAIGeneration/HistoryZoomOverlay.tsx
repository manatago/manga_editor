import React, { useEffect, useRef, useState } from 'react'
import { X, Paintbrush, Loader2, Eraser } from 'lucide-react'
import type { NovelAIHistoryEntry } from '../../store/types'
import { showError } from '../../utils/dialogs'
import { pathFromRelative, toDisplayUrl } from './types'

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
        inpaintPrompt: string
    ) => Promise<NovelAIHistoryEntry | null>
}

export const HistoryZoomOverlay: React.FC<Props> = ({
    relativePath,
    history,
    currentProjectPath,
    adoptedRelativePath,
    onClose,
    onSelect,
    onInpaint
}) => {
    const [inpaint, setInpaint] = useState(false)
    const [inpaintPrompt, setInpaintPrompt] = useState('')
    const [brush, setBrush] = useState(48)
    const [busy, setBusy] = useState(false)
    // ブラシサイズのプレビューリング（カーソル追従、画面 px）
    const [cursor, setCursor] = useState<{ x: number; y: number; d: number } | null>(null)
    const maskRef = useRef<HTMLCanvasElement>(null)
    const paintRef = useRef<{ x: number; y: number } | null>(null)
    // inpaint モードに入った直後だけマスクをクリアする。再描画後の画像差し替えでは塗りを保持。
    const resetMaskRef = useRef(true)

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
        ctx.fillStyle = '#ffffff'
        ctx.strokeStyle = '#ffffff'
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
    }
    function maskDown(e: React.PointerEvent): void {
        if (busy) return
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

            const result = await onInpaint(entry.relativePath, out.toDataURL('image/png'), inpaintPrompt)
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
                    disabled={busy}
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
                                className="absolute inset-0 m-auto max-w-[92vw] max-h-[78vh] cursor-crosshair touch-none rounded-lg opacity-50"
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
                        <button
                            type="button"
                            onClick={() => void runInpaint()}
                            disabled={busy}
                            className="flex shrink-0 items-center gap-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 px-4 py-1.5 text-sm font-bold text-white disabled:opacity-40"
                        >
                            {busy ? <Loader2 size={14} className="animate-spin" /> : <Paintbrush size={14} />}
                            再描画
                        </button>
                        <button
                            type="button"
                            onClick={clearMask}
                            disabled={busy}
                            className="flex shrink-0 items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/10 disabled:opacity-40"
                        >
                            <Eraser size={14} /> クリア
                        </button>
                        <button
                            type="button"
                            onClick={() => setInpaint(false)}
                            disabled={busy}
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
                        <span>seed: {entry.seed}</span>
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
                                    setCursor(null)
                                    setInpaint(true)
                                }}
                                className="ml-1 flex items-center gap-1.5 rounded-full bg-indigo-600/90 hover:bg-indigo-500 px-3 py-1 text-[11px] font-sans font-bold text-white"
                                title="塗った範囲だけを再生成（NovelAI infill）"
                            >
                                <Paintbrush size={12} /> 部分再描画
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
