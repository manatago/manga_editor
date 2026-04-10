import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Minus, Plus, RotateCcw, Save, X } from 'lucide-react'

interface MagicWandEditorModalProps {
    isOpen: boolean
    onClose: () => void
    imageUrl: string
    onSave: (dataUrl: string) => Promise<void>
}

/**
 * フラッドフィル（4連結）で clicked pixel と色距離 <= tolerance の連続領域を透明化。
 * アルファが 0 のピクセルは伝播しない（既に抜けた部分を跨がない）。
 */
function floodFill(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    startX: number,
    startY: number,
    tolerance: number
): void {
    const i0 = (startY * width + startX) * 4
    if (data[i0 + 3] === 0) return  // already transparent

    const tr = data[i0], tg = data[i0 + 1], tb = data[i0 + 2]
    const visited = new Uint8Array(width * height)
    const queue: number[] = [startY * width + startX]

    while (queue.length > 0) {
        const pos = queue.pop()!
        if (visited[pos]) continue
        visited[pos] = 1

        const i = pos * 4
        if (data[i + 3] === 0) continue  // don't spread across transparent

        const dr = data[i] - tr, dg = data[i + 1] - tg, db = data[i + 2] - tb
        if (Math.sqrt(dr * dr + dg * dg + db * db) > tolerance) continue

        data[i + 3] = 0

        const px = pos % width
        const py = Math.floor(pos / width)
        if (px > 0)          queue.push(pos - 1)
        if (px < width - 1)  queue.push(pos + 1)
        if (py > 0)          queue.push(pos - width)
        if (py < height - 1) queue.push(pos + width)
    }
}

/** チェッカーボードを描いた後、offscreen の内容を scale して描画 */
function drawDisplay(
    display: HTMLCanvasElement,
    offscreen: HTMLCanvasElement,
    zoom: number
): void {
    const dw = Math.round(offscreen.width * zoom)
    const dh = Math.round(offscreen.height * zoom)
    if (display.width !== dw || display.height !== dh) {
        display.width = dw
        display.height = dh
    }
    const ctx = display.getContext('2d')!

    // checkerboard
    const sq = 12
    for (let cy = 0; cy < dh; cy += sq) {
        for (let cx = 0; cx < dw; cx += sq) {
            ctx.fillStyle = (Math.floor(cx / sq) + Math.floor(cy / sq)) % 2 === 0 ? '#c0c0c0' : '#f0f0f0'
            ctx.fillRect(cx, cy, sq, sq)
        }
    }

    ctx.imageSmoothingEnabled = zoom < 1
    ctx.drawImage(offscreen, 0, 0, dw, dh)
}

export const MagicWandEditorModal: React.FC<MagicWandEditorModalProps> = ({
    isOpen,
    onClose,
    imageUrl,
    onSave
}) => {
    const displayCanvasRef = useRef<HTMLCanvasElement>(null)
    const offscreenRef = useRef<HTMLCanvasElement | null>(null)

    const [zoom, setZoom] = useState(1)
    const [tolerance, setTolerance] = useState(30)
    const [undoStack, setUndoStack] = useState<ImageData[]>([])
    const [saving, setSaving] = useState(false)
    const [loaded, setLoaded] = useState(false)

    // 画像ロード
    useEffect(() => {
        if (!isOpen || !imageUrl) return
        setLoaded(false)
        setUndoStack([])

        const img = new Image()
        img.onload = () => {
            const off = document.createElement('canvas')
            off.width = img.naturalWidth
            off.height = img.naturalHeight
            off.getContext('2d')!.drawImage(img, 0, 0)
            offscreenRef.current = off
            setLoaded(true)
        }
        img.src = imageUrl
    }, [isOpen, imageUrl])

    // 表示更新
    const redraw = useCallback(() => {
        const display = displayCanvasRef.current
        const off = offscreenRef.current
        if (!display || !off) return
        drawDisplay(display, off, zoom)
    }, [zoom])

    useEffect(() => {
        if (loaded) redraw()
    }, [loaded, redraw])

    // ズーム変更時に再描画
    useEffect(() => {
        if (!loaded) return
        redraw()
    }, [zoom, loaded, redraw])

    const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const display = displayCanvasRef.current
        const off = offscreenRef.current
        if (!display || !off) return

        const rect = display.getBoundingClientRect()
        // getBoundingClientRect は CSS サイズ。canvas 属性は物理ピクセルなので比率補正
        const scaleX = display.width / rect.width
        const scaleY = display.height / rect.height
        const cx = (e.clientX - rect.left) * scaleX
        const cy = (e.clientY - rect.top) * scaleY

        const ix = Math.floor(cx / zoom)
        const iy = Math.floor(cy / zoom)
        if (ix < 0 || iy < 0 || ix >= off.width || iy >= off.height) return

        const octx = off.getContext('2d')!
        const before = octx.getImageData(0, 0, off.width, off.height)

        // 作業用コピーにフラッドフィル
        const after = new ImageData(new Uint8ClampedArray(before.data), before.width, before.height)
        floodFill(after.data, off.width, off.height, ix, iy, tolerance)

        setUndoStack(prev => [...prev.slice(-29), before])
        octx.putImageData(after, 0, 0)
        redraw()
    }, [zoom, tolerance, redraw])

    const handleUndo = useCallback(() => {
        const off = offscreenRef.current
        if (!off || undoStack.length === 0) return
        const prev = undoStack[undoStack.length - 1]
        off.getContext('2d')!.putImageData(prev, 0, 0)
        setUndoStack(s => s.slice(0, -1))
        redraw()
    }, [undoStack, redraw])

    // Ctrl+Z / Cmd+Z
    useEffect(() => {
        if (!isOpen) return
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
                e.preventDefault()
                handleUndo()
            }
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [isOpen, handleUndo, onClose])

    const handleSave = async () => {
        const off = offscreenRef.current
        if (!off) return
        setSaving(true)
        try {
            await onSave(off.toDataURL('image/png'))
            onClose()
        } finally {
            setSaving(false)
        }
    }

    const changeZoom = (delta: number) => {
        setZoom(z => Math.min(8, Math.max(0.25, Math.round((z + delta) * 100) / 100)))
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[10001] bg-black/95 flex flex-col">
            {/* ヘッダー */}
            <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-b border-zinc-800 bg-zinc-900 shrink-0">
                <span className="text-white font-bold text-sm">マジックワンド編集</span>
                <span className="text-zinc-500 text-xs hidden sm:inline">クリックで同色の連続領域を透明化</span>

                {/* 許容値 */}
                <div className="flex items-center gap-2 ml-2">
                    <label className="text-zinc-400 text-xs shrink-0">許容値</label>
                    <input
                        type="range"
                        min={0}
                        max={150}
                        value={tolerance}
                        onChange={(e) => setTolerance(Number(e.target.value))}
                        className="w-24 sm:w-32 accent-violet-500"
                    />
                    <span className="text-zinc-300 text-xs w-6 tabular-nums">{tolerance}</span>
                </div>

                {/* ズーム */}
                <div className="flex items-center gap-1 ml-2">
                    <button
                        type="button"
                        onClick={() => changeZoom(-0.25)}
                        className="p-1.5 rounded hover:bg-zinc-700 text-zinc-300"
                    >
                        <Minus size={13} />
                    </button>
                    <span className="text-zinc-300 text-xs w-10 text-center tabular-nums">
                        {Math.round(zoom * 100)}%
                    </span>
                    <button
                        type="button"
                        onClick={() => changeZoom(0.25)}
                        className="p-1.5 rounded hover:bg-zinc-700 text-zinc-300"
                    >
                        <Plus size={13} />
                    </button>
                </div>

                {/* 操作ボタン */}
                <div className="ml-auto flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleUndo}
                        disabled={undoStack.length === 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-xs disabled:opacity-30 disabled:cursor-not-allowed"
                        title="元に戻す (Ctrl+Z)"
                    >
                        <RotateCcw size={12} />
                        元に戻す
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || !loaded}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Save size={12} />
                        {saving ? '保存中…' : '新規画像として保存'}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200"
                        title="閉じる (Esc)"
                    >
                        <X size={15} />
                    </button>
                </div>
            </div>

            {/* キャンバスエリア */}
            <div className="flex-1 overflow-auto p-6 flex items-start justify-center">
                {!loaded ? (
                    <div className="flex items-center justify-center h-32 text-zinc-500 text-sm">
                        読み込み中…
                    </div>
                ) : (
                    <canvas
                        ref={displayCanvasRef}
                        onClick={handleCanvasClick}
                        style={{ cursor: 'crosshair', imageRendering: zoom >= 2 ? 'pixelated' : 'auto' }}
                        className="shadow-2xl"
                    />
                )}
            </div>
        </div>
    )
}
