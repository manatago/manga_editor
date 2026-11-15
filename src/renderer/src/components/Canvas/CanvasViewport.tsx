import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Minus, Plus, Maximize } from 'lucide-react'
import { useMangaStore } from '../../store/useMangaStore'
import { useCanvasView, clampZoom, stepZoom, wheelZoomFactor, fitZoom } from '../../store/canvasView'

/** Canvas 側でページ（拡大後のサイズを持つ要素）に付ける目印 */
export const CANVAS_PAGE_ATTR = 'data-canvas-page'

const isTypingTarget = (t: EventTarget | null): boolean => {
    const el = t as HTMLElement | null
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
}

/**
 * キャンバスのスクロール領域＋ズーム／パン操作。
 * - Cmd(Ctrl)+ホイール、トラックパッドのピンチ: カーソル位置を中心に拡大縮小
 * - Cmd(Ctrl) + = / - : 段階的に拡大縮小、Cmd+0: 全体表示、Cmd+1: 100%
 * - スペースを押しながらドラッグ: 表示位置の移動
 */
export const CanvasViewport: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const scrollRef = useRef<HTMLDivElement>(null)
    const zoom = useCanvasView((s) => s.zoom)
    const setZoom = useCanvasView((s) => s.setZoom)
    const hasPage = useMangaStore((s) => !!s.currentPageId)

    /** 倍率変更後に「この画面上の点の下に、ページ上のこの点が来る」ように合わせる */
    const anchorRef = useRef<{ px: number; py: number; cx: number; cy: number } | null>(null)

    const pageEl = (): HTMLElement | null =>
        scrollRef.current?.querySelector<HTMLElement>(`[${CANVAS_PAGE_ATTR}]`) ?? null

    const zoomTo = useCallback(
        (next: number, clientX?: number, clientY?: number) => {
            const el = scrollRef.current
            const page = pageEl()
            const cur = useCanvasView.getState().zoom
            const z = clampZoom(next)
            if (!el || z === cur) return
            if (page) {
                const vr = el.getBoundingClientRect()
                const pr = page.getBoundingClientRect()
                const cx = clientX ?? vr.left + vr.width / 2
                const cy = clientY ?? vr.top + vr.height / 2
                anchorRef.current = { px: (cx - pr.left) / cur, py: (cy - pr.top) / cur, cx, cy }
            }
            setZoom(z)
        },
        [setZoom]
    )

    const zoomToFit = useCallback(() => {
        const el = scrollRef.current
        const { pages, currentPageId } = useMangaStore.getState()
        const page = pages.find((p) => p.id === currentPageId)
        if (!el || !page) return
        const vr = el.getBoundingClientRect()
        anchorRef.current = null
        setZoom(fitZoom(vr.width, vr.height, page.pageWidth ?? 840, page.pageHeight ?? 1188))
    }, [setZoom])

    useLayoutEffect(() => {
        const a = anchorRef.current
        const el = scrollRef.current
        const page = pageEl()
        anchorRef.current = null
        if (!a || !el || !page) return
        const pr = page.getBoundingClientRect()
        el.scrollLeft += pr.left + a.px * zoom - a.cx
        el.scrollTop += pr.top + a.py * zoom - a.cy
    }, [zoom])

    // Cmd/Ctrl + ホイール（トラックパッドのピンチは ctrlKey 付きのホイールとして届く）
    useEffect(() => {
        const el = scrollRef.current
        if (!el) return
        const onWheel = (e: WheelEvent): void => {
            if (!e.ctrlKey && !e.metaKey) return
            e.preventDefault()
            zoomTo(useCanvasView.getState().zoom * wheelZoomFactor(e.deltaY), e.clientX, e.clientY)
        }
        el.addEventListener('wheel', onWheel, { passive: false })
        return () => el.removeEventListener('wheel', onWheel)
    }, [zoomTo])

    // キーボード。Cmd+=/-/0 は Electron 標準メニューの「画面全体の拡大」と衝突するため、
    // メインプロセスで横取りして IPC で届く（preload: onCanvasZoomKey）。
    useEffect(() => {
        const run = (cmd: CanvasZoomCommand): void => {
            if (!useMangaStore.getState().currentPageId) return
            const z = useCanvasView.getState().zoom
            if (cmd === 'in') zoomTo(stepZoom(z, 1))
            else if (cmd === 'out') zoomTo(stepZoom(z, -1))
            else if (cmd === 'actual') zoomTo(1)
            else if (cmd === 'fit') zoomToFit()
        }
        return window.electron?.onCanvasZoomKey?.(run)
    }, [zoomTo, zoomToFit])

    // スペース＋ドラッグでパン
    const [spaceHeld, setSpaceHeld] = useState(false)
    const [dragging, setDragging] = useState(false)
    const dragStart = useRef<{ x: number; y: number; sl: number; st: number } | null>(null)
    useEffect(() => {
        const down = (e: KeyboardEvent): void => {
            if (e.code !== 'Space' || isTypingTarget(e.target)) return
            if (!useMangaStore.getState().currentPageId) return
            e.preventDefault() // ページのスクロールやボタン押下を防ぐ
            if (!e.repeat) setSpaceHeld(true)
        }
        const up = (e: KeyboardEvent): void => {
            if (e.code === 'Space') setSpaceHeld(false)
        }
        const blur = (): void => setSpaceHeld(false)
        window.addEventListener('keydown', down)
        window.addEventListener('keyup', up)
        window.addEventListener('blur', blur)
        return () => {
            window.removeEventListener('keydown', down)
            window.removeEventListener('keyup', up)
            window.removeEventListener('blur', blur)
        }
    }, [])

    const onPanDown = (e: React.PointerEvent<HTMLDivElement>): void => {
        const el = scrollRef.current
        if (!el) return
        e.currentTarget.setPointerCapture(e.pointerId)
        dragStart.current = { x: e.clientX, y: e.clientY, sl: el.scrollLeft, st: el.scrollTop }
        setDragging(true)
    }
    const onPanMove = (e: React.PointerEvent<HTMLDivElement>): void => {
        const el = scrollRef.current
        const d = dragStart.current
        if (!el || !d) return
        el.scrollLeft = d.sl - (e.clientX - d.x)
        el.scrollTop = d.st - (e.clientY - d.y)
    }
    const onPanUp = (): void => {
        dragStart.current = null
        setDragging(false)
    }

    return (
        <div className="flex-1 relative min-h-0">
            <div ref={scrollRef} className="absolute inset-0 overflow-auto bg-zinc-950 manga-scrollbar">
                {children}
            </div>

            {spaceHeld && hasPage && (
                <div
                    className="absolute inset-0 z-20"
                    style={{ cursor: dragging ? 'grabbing' : 'grab' }}
                    onPointerDown={onPanDown}
                    onPointerMove={onPanMove}
                    onPointerUp={onPanUp}
                    onPointerCancel={onPanUp}
                />
            )}

            {hasPage && (
                <div className="absolute bottom-3 right-4 z-30 flex items-center gap-0.5 rounded-lg border border-zinc-800 bg-zinc-900/90 p-1 text-zinc-400 shadow-lg backdrop-blur">
                    <button
                        type="button"
                        onClick={() => zoomTo(stepZoom(zoom, -1))}
                        className="rounded p-1.5 hover:bg-zinc-700 hover:text-zinc-50"
                        title="縮小（Cmd + -）"
                    >
                        <Minus size={14} />
                    </button>
                    <button
                        type="button"
                        onClick={() => zoomTo(1)}
                        className="min-w-[3.25rem] rounded px-1.5 py-1 text-center font-mono text-xs hover:bg-zinc-700 hover:text-zinc-50"
                        title="100% 表示（Cmd + 1）"
                    >
                        {Math.round(zoom * 100)}%
                    </button>
                    <button
                        type="button"
                        onClick={() => zoomTo(stepZoom(zoom, 1))}
                        className="rounded p-1.5 hover:bg-zinc-700 hover:text-zinc-50"
                        title="拡大（Cmd + =）"
                    >
                        <Plus size={14} />
                    </button>
                    <button
                        type="button"
                        onClick={zoomToFit}
                        className="rounded p-1.5 hover:bg-zinc-700 hover:text-zinc-50"
                        title="ページ全体を表示（Cmd + 0）"
                    >
                        <Maximize size={14} />
                    </button>
                </div>
            )}
        </div>
    )
}
