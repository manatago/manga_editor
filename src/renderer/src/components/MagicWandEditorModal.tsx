import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Brush, Eraser, Minus, Plus, RotateCcw, Save, Sparkles, Undo2, X } from 'lucide-react'
import { contiguousMask, globalMask, applyMask } from './utils/wandMask'

interface MagicWandEditorModalProps {
    isOpen: boolean
    onClose: () => void
    imageUrl: string
    onSave: (dataUrl: string) => Promise<void>
}

/** 選択モード。連結＝クリック地点から繋がった同色領域。全域＝画像全体で同色に近い画素すべて。 */
export type WandMode = 'contiguous' | 'global'

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
    // 復元ブラシ用に読み込み時の元画像を保持
    const originalRef = useRef<HTMLCanvasElement | null>(null)
    const scrollRef = useRef<HTMLDivElement>(null)
    // ホイールズーム時に「カーソル下の画像点」を固定するための一時保存
    const zoomFocusRef = useRef<{ imgX: number; imgY: number; vpX: number; vpY: number } | null>(null)
    // ブラシのストローク状態
    const paintingRef = useRef(false)
    const lastPtRef = useRef<{ x: number; y: number } | null>(null)

    const [zoom, setZoom] = useState(1)
    const [tolerance, setTolerance] = useState(30)
    const [mode, setMode] = useState<WandMode>('contiguous')
    const [feather, setFeather] = useState(0)
    const [tool, setTool] = useState<'wand' | 'brush'>('wand')
    const [brushMode, setBrushMode] = useState<'erase' | 'restore'>('erase')
    const [brushSize, setBrushSize] = useState(20)
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
            // 元画像のコピー（復元ブラシ用）
            const orig = document.createElement('canvas')
            orig.width = img.naturalWidth
            orig.height = img.naturalHeight
            orig.getContext('2d')!.drawImage(img, 0, 0)
            originalRef.current = orig
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

    // カーソル位置を中心にズーム（ホイール・ボタン共通）。
    // クリック地点の画像座標を覚えておき、ズーム後にスクロール位置を合わせて
    // カーソル下の点が動かないようにする。
    const zoomAtCursor = useCallback((clientX: number, clientY: number, factor: number) => {
        const display = displayCanvasRef.current
        const container = scrollRef.current
        if (!display || !container) return
        const rect = display.getBoundingClientRect()
        const containerRect = container.getBoundingClientRect()
        const imgX = (clientX - rect.left) / zoom
        const imgY = (clientY - rect.top) / zoom
        const vpX = clientX - containerRect.left
        const vpY = clientY - containerRect.top
        const next = Math.min(8, Math.max(0.25, Math.round(zoom * factor * 100) / 100))
        if (next === zoom) return
        zoomFocusRef.current = { imgX, imgY, vpX, vpY }
        setZoom(next)
    }, [zoom])

    // ズーム後にスクロールを補正し、カーソル下の画像点を同じ表示位置に保つ。
    // redraw で canvas がリサイズされた後の実サイズを基に計算するため layout 効果で実行。
    useLayoutEffect(() => {
        if (!loaded) return
        redraw()
        const focus = zoomFocusRef.current
        if (!focus) return
        zoomFocusRef.current = null
        const display = displayCanvasRef.current
        const container = scrollRef.current
        if (!display || !container) return
        const displayRect = display.getBoundingClientRect()
        const containerRect = container.getBoundingClientRect()
        const canvasLeftInContent = displayRect.left - containerRect.left + container.scrollLeft
        const canvasTopInContent = displayRect.top - containerRect.top + container.scrollTop
        container.scrollLeft = canvasLeftInContent + focus.imgX * zoom - focus.vpX
        container.scrollTop = canvasTopInContent + focus.imgY * zoom - focus.vpY
    }, [zoom, loaded, redraw])

    // ホイールでズーム（preventDefault のため passive:false のネイティブリスナで登録）
    useEffect(() => {
        const display = displayCanvasRef.current
        if (!display || !loaded) return
        const onWheel = (e: WheelEvent) => {
            e.preventDefault()
            const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2
            zoomAtCursor(e.clientX, e.clientY, factor)
        }
        display.addEventListener('wheel', onWheel, { passive: false })
        return () => display.removeEventListener('wheel', onWheel)
    }, [loaded, zoomAtCursor])

    // クライアント座標 → 画像ピクセル座標
    const clientToImage = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
        const display = displayCanvasRef.current
        const off = offscreenRef.current
        if (!display || !off) return null
        const rect = display.getBoundingClientRect()
        const scaleX = display.width / rect.width
        const scaleY = display.height / rect.height
        const cx = (clientX - rect.left) * scaleX
        const cy = (clientY - rect.top) * scaleY
        return { x: cx / zoom, y: cy / zoom }
    }, [zoom])

    // ブラシ 1 スタンプ。erase=強制透明化、restore=元画像に戻す。
    const stampAt = useCallback((ix: number, iy: number) => {
        const off = offscreenRef.current
        if (!off) return
        const octx = off.getContext('2d')!
        octx.save()
        if (brushMode === 'erase') {
            octx.globalCompositeOperation = 'destination-out'
            octx.fillStyle = '#000'
            octx.beginPath()
            octx.arc(ix, iy, brushSize, 0, Math.PI * 2)
            octx.fill()
        } else {
            const orig = originalRef.current
            if (orig) {
                octx.beginPath()
                octx.arc(ix, iy, brushSize, 0, Math.PI * 2)
                octx.clip()
                // 円内を一旦クリアしてから元画像を描き直す（元の透明も忠実に復元）
                octx.globalCompositeOperation = 'destination-out'
                octx.fillStyle = '#000'
                octx.fillRect(ix - brushSize, iy - brushSize, brushSize * 2, brushSize * 2)
                octx.globalCompositeOperation = 'source-over'
                octx.drawImage(orig, 0, 0)
            }
        }
        octx.restore()
    }, [brushMode, brushSize])

    // 直前の点から現在の点まで、ブラシ間隔で補間しながらスタンプ（速いドラッグの隙間を埋める）
    const paintLine = useCallback((x0: number, y0: number, x1: number, y1: number) => {
        const dist = Math.hypot(x1 - x0, y1 - y0)
        const step = Math.max(1, brushSize / 2)
        const n = Math.max(1, Math.ceil(dist / step))
        for (let i = 0; i <= n; i++) {
            const t = i / n
            stampAt(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)
        }
    }, [brushSize, stampAt])

    const snapshotForUndo = useCallback(() => {
        const off = offscreenRef.current
        if (!off) return
        const octx = off.getContext('2d')!
        const before = octx.getImageData(0, 0, off.width, off.height)
        setUndoStack(prev => [...prev.slice(-29), before])
    }, [])

    const handleBrushDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (tool !== 'brush') return
        const p = clientToImage(e.clientX, e.clientY)
        if (!p) return
        e.preventDefault()
        snapshotForUndo()
        paintingRef.current = true
        lastPtRef.current = p
        stampAt(p.x, p.y)
        redraw()
    }, [tool, clientToImage, snapshotForUndo, stampAt, redraw])

    const handleBrushMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!paintingRef.current) return
        const p = clientToImage(e.clientX, e.clientY)
        if (!p) return
        const last = lastPtRef.current
        if (last) paintLine(last.x, last.y, p.x, p.y)
        else stampAt(p.x, p.y)
        lastPtRef.current = p
        redraw()
    }, [clientToImage, paintLine, stampAt, redraw])

    const endBrushStroke = useCallback(() => {
        paintingRef.current = false
        lastPtRef.current = null
    }, [])

    const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (tool !== 'wand') return
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

        // 作業用コピーへ：モードに応じてマスクを作り、フェザー付きで透明化
        const after = new ImageData(new Uint8ClampedArray(before.data), before.width, before.height)
        const mask =
            mode === 'contiguous'
                ? contiguousMask(after.data, off.width, off.height, ix, iy, tolerance)
                : globalMask(after.data, off.width, off.height, ix, iy, tolerance)
        applyMask(after.data, mask, off.width, off.height, feather)

        setUndoStack(prev => [...prev.slice(-29), before])
        octx.putImageData(after, 0, 0)
        redraw()
    }, [tool, zoom, tolerance, mode, feather, redraw])

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
                <span className="text-zinc-500 text-xs hidden xl:inline">
                    {tool === 'wand'
                        ? `クリックで${mode === 'contiguous' ? '繋がった同色領域' : '画像全体の同色部分'}を透明化`
                        : brushMode === 'erase'
                            ? 'ドラッグで塗った範囲を強制的に透明化'
                            : 'ドラッグで塗った範囲を元画像に復元'}
                    ・ホイールで拡大縮小
                </span>

                {/* ツール切替: ワンド / ブラシ */}
                <div className="flex items-center gap-0.5 rounded-md border border-zinc-700 p-0.5 ml-2">
                    <button
                        type="button"
                        onClick={() => setTool('wand')}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs ${tool === 'wand' ? 'bg-violet-600 text-white' : 'text-zinc-300 hover:bg-white/10'}`}
                        title="ワンド：クリックで同色領域を透明化"
                    >
                        <Sparkles size={12} /> ワンド
                    </button>
                    <button
                        type="button"
                        onClick={() => setTool('brush')}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs ${tool === 'brush' ? 'bg-violet-600 text-white' : 'text-zinc-300 hover:bg-white/10'}`}
                        title="ブラシ：塗った範囲を強制的に背景（透明）にする。ワンドで拾えない箇所用。"
                    >
                        <Brush size={12} /> ブラシ
                    </button>
                </div>

                {tool === 'wand' ? (
                    <>
                        {/* 選択モード */}
                        <div className="flex items-center gap-0.5 rounded-md border border-zinc-700 p-0.5 ml-2">
                            <button
                                type="button"
                                onClick={() => setMode('contiguous')}
                                className={`px-2.5 py-1 rounded text-xs ${mode === 'contiguous' ? 'bg-violet-600 text-white' : 'text-zinc-300 hover:bg-white/10'}`}
                                title="連結：クリック地点から繋がった同色領域だけを透明化"
                            >
                                連結
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode('global')}
                                className={`px-2.5 py-1 rounded text-xs ${mode === 'global' ? 'bg-violet-600 text-white' : 'text-zinc-300 hover:bg-white/10'}`}
                                title="全域：画像全体でクリック色に近い画素をすべて透明化（連結性を無視）"
                            >
                                全域
                            </button>
                        </div>

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

                        {/* 境界フェザー */}
                        <div className="flex items-center gap-2 ml-2">
                            <label className="text-zinc-400 text-xs shrink-0">フェザー</label>
                            <input
                                type="range"
                                min={0}
                                max={5}
                                value={feather}
                                onChange={(e) => setFeather(Number(e.target.value))}
                                className="w-16 sm:w-20 accent-violet-500"
                            />
                            <span className="text-zinc-300 text-xs w-8 tabular-nums">{feather}px</span>
                        </div>
                    </>
                ) : (
                    <>
                        {/* ブラシモード: 消す / 戻す */}
                        <div className="flex items-center gap-0.5 rounded-md border border-zinc-700 p-0.5 ml-2">
                            <button
                                type="button"
                                onClick={() => setBrushMode('erase')}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs ${brushMode === 'erase' ? 'bg-rose-600 text-white' : 'text-zinc-300 hover:bg-white/10'}`}
                                title="消す：塗った範囲を強制的に透明化（背景扱い）"
                            >
                                <Eraser size={12} /> 消す
                            </button>
                            <button
                                type="button"
                                onClick={() => setBrushMode('restore')}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs ${brushMode === 'restore' ? 'bg-emerald-600 text-white' : 'text-zinc-300 hover:bg-white/10'}`}
                                title="戻す：塗りすぎた箇所を元画像に復元"
                            >
                                <Undo2 size={12} /> 戻す
                            </button>
                        </div>

                        {/* ブラシサイズ */}
                        <div className="flex items-center gap-2 ml-2">
                            <label className="text-zinc-400 text-xs shrink-0">サイズ</label>
                            <input
                                type="range"
                                min={2}
                                max={200}
                                value={brushSize}
                                onChange={(e) => setBrushSize(Number(e.target.value))}
                                className="w-24 sm:w-32 accent-violet-500"
                            />
                            <span className="text-zinc-300 text-xs w-10 tabular-nums">{brushSize}px</span>
                        </div>
                    </>
                )}

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
            <div ref={scrollRef} className="flex-1 overflow-auto p-6 flex items-start justify-center">
                {!loaded ? (
                    <div className="flex items-center justify-center h-32 text-zinc-500 text-sm">
                        読み込み中…
                    </div>
                ) : (
                    <canvas
                        ref={displayCanvasRef}
                        onClick={handleCanvasClick}
                        onMouseDown={handleBrushDown}
                        onMouseMove={handleBrushMove}
                        onMouseUp={endBrushStroke}
                        onMouseLeave={endBrushStroke}
                        style={{ cursor: 'crosshair', imageRendering: zoom >= 2 ? 'pixelated' : 'auto' }}
                        className="shadow-2xl"
                    />
                )}
            </div>
        </div>
    )
}
