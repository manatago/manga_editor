import React, { useMemo, useRef, useState } from 'react'
import { Plus, Trash2, FileText, ChevronLeft, ChevronRight, LayoutGrid, X } from 'lucide-react'
import { useMangaStore } from '../../store/useMangaStore'
import { ModeToggle } from '../ModeToggle'
import type { Bubble, Panel, Page, PageTemplate } from '../../store/types'
import { getPanelPoints } from '../utils/drawPaths'
import { LAYOUT_PRESETS, type LayoutPreset } from '../../data/layoutPresets'
import { LINE_KIND_ORDER, LINE_KIND_LABELS, kindOfBubble } from '../../utils/script/lineKinds'

const DEFAULT_PAGE_W = 840
const DEFAULT_PAGE_H = 1188

/** 読み順（上→下、同じ行内は右→左）で並べる */
function readingOrder(bubbles: Bubble[]): Bubble[] {
    return [...bubbles].sort((a, b) => {
        if (Math.abs(a.y - b.y) > 40) return a.y - b.y
        return b.x - a.x
    })
}

/** パネル（矩形/斜め/台形）を polygon points 文字列に */
function panelPolygon(panel: Panel): string {
    const local = getPanelPoints(panel)
    const pts: string[] = []
    for (let i = 0; i < local.length; i += 2) {
        pts.push(`${(panel.x + local[i]).toFixed(1)},${(panel.y + local[i + 1]).toFixed(1)}`)
    }
    return pts.join(' ')
}

interface ShapeBox {
    x?: number
    y?: number
    width?: number
    height?: number
    type?: string
    slant?: number
    offsetB?: number
    offsetC?: number
    offsetD?: number
}

/** コマ形状（矩形・斜め・台形）を SVG polygon の points 文字列に */
function shapePolygon(box: ShapeBox): string {
    const x = box.x ?? 0
    const y = box.y ?? 0
    const local = getPanelPoints({
        type: (box.type ?? 'rect') as never,
        width: box.width ?? 0,
        height: box.height ?? 0,
        slant: box.slant ?? 0,
        offsetB: box.offsetB ?? 0,
        offsetC: box.offsetC ?? 0,
        offsetD: box.offsetD ?? 0
    } as never)
    const pts: string[] = []
    for (let i = 0; i < local.length; i += 2) pts.push(`${(x + local[i]).toFixed(1)},${(y + local[i + 1]).toFixed(1)}`)
    return pts.join(' ')
}

const THUMB_W = 100
const THUMB_H = 141

/** 組み込みプリセットのサムネ（正規化矩形を縮小描画） */
const PresetThumb: React.FC<{ preset: LayoutPreset }> = ({ preset }) => {
    const pad = 3
    return (
        <svg viewBox={`0 0 ${THUMB_W} ${THUMB_H}`} className="w-full h-auto bg-white rounded-sm">
            <rect x={0} y={0} width={THUMB_W} height={THUMB_H} fill="#ffffff" />
            {preset.rects.map((r, i) => {
                const w = Math.max(1, r.w * THUMB_W - pad * 2)
                const h = Math.max(1, r.h * THUMB_H - pad * 2)
                const base = r.type === 'trapezoid-v' ? h : w
                return (
                    <polygon
                        key={i}
                        points={shapePolygon({
                            x: r.x * THUMB_W + pad,
                            y: r.y * THUMB_H + pad,
                            width: w,
                            height: h,
                            type: r.type,
                            slant: (r.slant ?? 0) * base,
                            offsetB: (r.offsetB ?? 0) * base,
                            offsetC: (r.offsetC ?? 0) * base,
                            offsetD: (r.offsetD ?? 0) * base
                        })}
                        fill="#e5e7eb"
                        stroke="#111111"
                        strokeWidth={1.5}
                    />
                )
            })}
        </svg>
    )
}

/** 自作テンプレのサムネ（px 840×1188 を縮小） */
const TemplateThumb: React.FC<{ template: PageTemplate }> = ({ template }) => {
    const sx = THUMB_W / 840
    const sy = THUMB_H / 1188
    return (
        <svg viewBox={`0 0 ${THUMB_W} ${THUMB_H}`} className="w-full h-auto bg-white rounded-sm">
            <rect x={0} y={0} width={THUMB_W} height={THUMB_H} fill="#ffffff" />
            {template.panels.map((p, i) => (
                <polygon
                    key={i}
                    points={shapePolygon({
                        x: p.x * sx,
                        y: p.y * sy,
                        width: p.width * sx,
                        height: p.height * sy,
                        type: p.type,
                        slant: (p.slant ?? 0) * sx,
                        offsetB: (p.offsetB ?? 0) * sx,
                        offsetC: (p.offsetC ?? 0) * sx,
                        offsetD: (p.offsetD ?? 0) * sx
                    })}
                    fill="#e5e7eb"
                    stroke="#111111"
                    strokeWidth={1.5}
                />
            ))}
        </svg>
    )
}

interface LayoutItem {
    key: string
    name: string
    count: number
    preset?: LayoutPreset
    template?: PageTemplate
}

/** レイアウトをサムネイルで選ぶドロップダウン */
const LayoutPicker: React.FC<{ current?: string; templates: PageTemplate[]; onPick: (name: string) => void }> = ({ current, templates, onPick }) => {
    const [open, setOpen] = useState(false)
    const groups = useMemo(() => {
        const items: LayoutItem[] = [
            ...LAYOUT_PRESETS.map((p) => ({ key: `p:${p.id}`, name: p.name, count: p.rects.length, preset: p })),
            ...templates.map((t) => ({ key: `t:${t.id}`, name: t.name, count: t.panels.length, template: t }))
        ]
        const counts = Array.from(new Set(items.map((i) => i.count))).sort((a, b) => a - b)
        return counts.map((c) => ({ count: c, items: items.filter((i) => i.count === c) }))
    }, [templates])

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-1.5 px-2 py-1 rounded border border-zinc-700 bg-zinc-800 text-xs text-white hover:border-indigo-500"
            >
                <LayoutGrid size={14} /> {current || 'レイアウトを選ぶ'}
            </button>
            {open && (
                <div className="absolute left-0 top-full mt-1 z-30 w-[420px] max-h-80 overflow-auto manga-scrollbar bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl">
                    <div className="flex items-center justify-between px-3 py-2 sticky top-0 bg-zinc-900 border-b border-zinc-800">
                        <span className="text-[11px] text-zinc-400">コマ数から選ぶ</span>
                        <button type="button" onClick={() => setOpen(false)} className="p-1 rounded hover:bg-zinc-800 text-zinc-400">
                            <X size={14} />
                        </button>
                    </div>
                    <div className="p-3 space-y-3">
                        {groups.map((g) => (
                            <div key={g.count}>
                                <div className="text-[11px] text-zinc-500 mb-1">{g.count}コマ</div>
                                <div className="grid grid-cols-4 gap-2">
                                    {g.items.map((it) => (
                                        <button
                                            key={it.key}
                                            type="button"
                                            onClick={() => {
                                                onPick(it.name)
                                                setOpen(false)
                                            }}
                                            title={it.name}
                                            className={`group relative flex flex-col items-center gap-1 p-1.5 rounded border ${current === it.name ? 'border-indigo-500 bg-zinc-800' : 'border-zinc-800 hover:border-indigo-500 hover:bg-zinc-800/60'}`}
                                        >
                                            {it.template && (
                                                <span className="absolute top-1 right-1 z-10 text-[8px] px-1 py-0.5 rounded bg-indigo-600/90 text-white leading-none">
                                                    自作
                                                </span>
                                            )}
                                            <div className="w-full">
                                                {it.preset ? <PresetThumb preset={it.preset} /> : <TemplateThumb template={it.template!} />}
                                            </div>
                                            <span className="text-[10px] leading-tight text-zinc-400 group-hover:text-zinc-200 text-center break-words">
                                                {it.name}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

/** ページを直接 SVG 描画するライブプレビュー（吹き出しドラッグで座標を直接更新） */
const LivePreview: React.FC<{ page: Page }> = ({ page }) => {
    const svgRef = useRef<SVGSVGElement>(null)
    const dragRef = useRef<{ id: string; startPtX: number; startPtY: number; startX: number; startY: number } | null>(null)
    const updateBubble = useMangaStore((s) => s.updateBubble)
    const setSelectedBubble = useMangaStore((s) => s.setSelectedBubble)
    const selectedBubbleId = useMangaStore((s) => s.selectedBubbleId)
    const pw = page.pageWidth ?? DEFAULT_PAGE_W
    const ph = page.pageHeight ?? DEFAULT_PAGE_H

    const clientToSvg = (cx: number, cy: number) => {
        const svg = svgRef.current
        if (!svg) return null
        const pt = svg.createSVGPoint()
        pt.x = cx
        pt.y = cy
        const ctm = svg.getScreenCTM()
        if (!ctm) return null
        const p = pt.matrixTransform(ctm.inverse())
        return { x: p.x, y: p.y }
    }
    const onDown = (e: React.PointerEvent, b: Bubble) => {
        const p = clientToSvg(e.clientX, e.clientY)
        if (!p) return
        svgRef.current?.setPointerCapture(e.pointerId)
        dragRef.current = { id: b.id, startPtX: p.x, startPtY: p.y, startX: b.x, startY: b.y }
        setSelectedBubble(b.id)
    }
    const onMove = (e: React.PointerEvent) => {
        const d = dragRef.current
        if (!d) return
        const p = clientToSvg(e.clientX, e.clientY)
        if (!p) return
        const x = Math.round(Math.max(0, Math.min(pw - 20, d.startX + (p.x - d.startPtX))))
        const y = Math.round(Math.max(0, Math.min(ph - 20, d.startY + (p.y - d.startPtY))))
        updateBubble(d.id, { x, y }, false)
    }
    const onUp = () => {
        dragRef.current = null
    }

    return (
        <div className="flex-1 min-h-0 flex items-center justify-center p-4 overflow-auto">
            <svg
                ref={svgRef}
                viewBox={`0 0 ${pw} ${ph}`}
                onPointerMove={onMove}
                onPointerUp={onUp}
                className="bg-white shadow-lg touch-none"
                style={{ height: '100%', maxHeight: '100%', width: 'auto', aspectRatio: `${pw} / ${ph}` }}
            >
                <rect x={0} y={0} width={pw} height={ph} fill="#ffffff" />
                {page.panels.map((panel, i) => (
                    <g key={panel.id}>
                        <polygon points={panelPolygon(panel)} fill="none" stroke="#111111" strokeWidth={3} />
                        <text x={panel.x + 12} y={panel.y + 28} fontSize={22} fill="#cbd5e1">
                            {i + 1}
                        </text>
                    </g>
                ))}
                {page.bubbles.map((b) => {
                    const isNarration = b.tailWidth === 0
                    const sel = b.id === selectedBubbleId
                    return (
                        <g key={b.id} style={{ cursor: 'move' }} onPointerDown={(e) => onDown(e, b)}>
                            <rect
                                x={b.x}
                                y={b.y}
                                width={b.width}
                                height={b.height}
                                rx={isNarration ? 2 : 16}
                                fill="#ffffff"
                                stroke={sel ? '#6366f1' : '#333333'}
                                strokeWidth={sel ? 4 : 2}
                            />
                            {(b.text || '').split('\n').slice(0, 6).map((col, ci) => (
                                <text
                                    key={ci}
                                    x={b.x + b.width - 16 - ci * 20}
                                    y={b.y + 16}
                                    fontSize={20}
                                    fill="#111111"
                                    style={{ writingMode: 'vertical-rl', pointerEvents: 'none', userSelect: 'none' }}
                                >
                                    {col.length > 7 ? col.slice(0, 7) + '…' : col}
                                </text>
                            ))}
                        </g>
                    )
                })}
            </svg>
        </div>
    )
}

/** 1行（=1吹き出し） */
const LineRow: React.FC<{ bubble: Bubble }> = ({ bubble }) => {
    const updateLine = useMangaStore((s) => s.updateLine)
    const removeLine = useMangaStore((s) => s.removeLine)
    const setSelectedBubble = useMangaStore((s) => s.setSelectedBubble)
    const selectedBubbleId = useMangaStore((s) => s.selectedBubbleId)
    const referenceCharacters = useMangaStore((s) => s.referenceCharacters)
    const kind = kindOfBubble(bubble)
    const sel = bubble.id === selectedBubbleId

    return (
        <div
            className={`flex items-start gap-1.5 px-2 py-1.5 rounded border ${sel ? 'border-indigo-500 bg-zinc-800/60' : 'border-transparent hover:bg-zinc-800/40'}`}
            onClick={() => setSelectedBubble(bubble.id)}
        >
            <div className="flex flex-col gap-1 w-24 shrink-0">
                <input
                    type="text"
                    list="script-speakers"
                    value={bubble.scriptSpeaker ?? ''}
                    onChange={(e) => updateLine(bubble.id, { speaker: e.target.value })}
                    placeholder="話者"
                    disabled={kind === 'narration'}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1 text-xs text-white disabled:opacity-40"
                />
                <select
                    value={kind}
                    onChange={(e) => updateLine(bubble.id, { kind: e.target.value as never })}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-1 py-1 text-[11px] text-zinc-300"
                >
                    {LINE_KIND_ORDER.map((k) => (
                        <option key={k} value={k}>
                            {LINE_KIND_LABELS[k]}
                        </option>
                    ))}
                </select>
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-1">
                <textarea
                    value={bubble.text ?? ''}
                    onChange={(e) => updateLine(bubble.id, { text: e.target.value })}
                    rows={2}
                    placeholder="セリフ（改行OK）"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-white resize-y"
                />
                <div className="flex gap-1">
                    <input
                        type="text"
                        value={bubble.scriptAddressee ?? ''}
                        onChange={(e) => updateLine(bubble.id, { addressee: e.target.value })}
                        placeholder="宛先（誰/何に向けて）"
                        title="翻訳注釈: 誰/何に向けたセリフか。訳し分けの手がかりになります"
                        className="w-1/3 min-w-0 bg-zinc-900/60 border border-zinc-800 rounded px-1.5 py-1 text-[11px] text-zinc-300"
                    />
                    <input
                        type="text"
                        value={bubble.scriptNote ?? ''}
                        onChange={(e) => updateLine(bubble.id, { note: e.target.value })}
                        placeholder="ニュアンス注釈（言い回し・含意）"
                        title="翻訳注釈: 日本語独特の言い回しや含意のメモ。翻訳時の判断材料に使います"
                        className="flex-1 min-w-0 bg-zinc-900/60 border border-zinc-800 rounded px-1.5 py-1 text-[11px] text-zinc-300"
                    />
                </div>
            </div>
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation()
                    removeLine(bubble.id)
                }}
                className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-950/30 shrink-0 self-center"
                title="このセリフを削除"
            >
                <Trash2 size={14} />
            </button>
        </div>
    )
}

/** 1コマ（=1パネル）のブロック */
const PanelBlock: React.FC<{ panel: Panel; index: number; page: Page }> = ({ panel, index, page }) => {
    const addLine = useMangaStore((s) => s.addLine)
    const removePanelFromPage = useMangaStore((s) => s.removePanelFromPage)
    const lines = readingOrder(page.bubbles.filter((b) => b.panelId === panel.id))

    return (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40">
            <div className="flex items-center justify-between px-2 py-1.5 border-b border-zinc-800">
                <span className="text-xs font-medium text-zinc-300">コマ {index + 1}</span>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => addLine(panel.id, { kind: 'speech' })}
                        className="flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white"
                    >
                        <Plus size={12} /> セリフ
                    </button>
                    <button
                        type="button"
                        onClick={() => removePanelFromPage(panel.id)}
                        className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-950/30"
                        title="このコマを削除"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
            <div className="p-1.5 space-y-1">
                {lines.length === 0 ? (
                    <div className="text-[11px] text-zinc-600 px-2 py-1">セリフがありません</div>
                ) : (
                    lines.map((b) => <LineRow key={b.id} bubble={b} />)
                )}
            </div>
        </div>
    )
}

export const ScriptEditor: React.FC = () => {
    const scriptEditorOpen = useMangaStore((s) => s.scriptEditorOpen)
    const pages = useMangaStore((s) => s.pages)
    const currentPageId = useMangaStore((s) => s.currentPageId)
    const selectPage = useMangaStore((s) => s.selectPage)
    const templates = useMangaStore((s) => s.templates)
    const referenceCharacters = useMangaStore((s) => s.referenceCharacters)
    const setPageLayout = useMangaStore((s) => s.setPageLayout)
    const addPanelToPage = useMangaStore((s) => s.addPanelToPage)
    const addPage = useMangaStore((s) => s.addPage)

    const currentIndex = pages.findIndex((p) => p.id === currentPageId)
    const page = currentIndex >= 0 ? pages[currentIndex] : undefined

    if (!scriptEditorOpen) return null

    return (
        <div className="fixed inset-0 z-[60] flex flex-col bg-zinc-950 text-zinc-200">
            <datalist id="script-speakers">
                {referenceCharacters.map((c) => (
                    <option key={c.id} value={c.name} />
                ))}
            </datalist>

            {/* ヘッダ */}
            <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-zinc-800 bg-zinc-900">
                <div className="flex items-center gap-2 text-sm font-medium">
                    <FileText size={16} className="text-indigo-400" /> 台本モード
                </div>
                <ModeToggle />
            </div>

            {/* ページ切替 */}
            <div className="h-10 shrink-0 flex items-center gap-2 px-3 border-b border-zinc-800 bg-zinc-900/60">
                <button
                    type="button"
                    disabled={currentIndex <= 0}
                    onClick={() => selectPage(pages[currentIndex - 1].id, { skipAutosave: true })}
                    className="p-1 rounded hover:bg-zinc-800 disabled:text-zinc-700"
                >
                    <ChevronLeft size={16} />
                </button>
                <span className="text-xs text-zinc-400 tabular-nums">
                    ページ {pages.length === 0 ? 0 : currentIndex + 1} / {pages.length}
                </span>
                <button
                    type="button"
                    disabled={currentIndex >= pages.length - 1}
                    onClick={() => selectPage(pages[currentIndex + 1].id, { skipAutosave: true })}
                    className="p-1 rounded hover:bg-zinc-800 disabled:text-zinc-700"
                >
                    <ChevronRight size={16} />
                </button>
                <button
                    type="button"
                    onClick={() => addPage()}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-zinc-800 text-zinc-400"
                    title="新しいページを追加"
                >
                    <Plus size={14} /> ページ
                </button>
                {page && (
                    <div className="ml-4">
                        <LayoutPicker current={page.layoutName} templates={templates} onPick={setPageLayout} />
                    </div>
                )}
            </div>

            {/* 本体 */}
            {!page ? (
                <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">
                    ページがありません。まず左のページ一覧でページを追加してください。
                </div>
            ) : (
                <div className="flex-1 min-h-0 flex">
                    {/* 左: 構造ツリー */}
                    <div className="w-1/2 min-w-0 flex flex-col border-r border-zinc-800">
                        <div className="flex-1 min-h-0 overflow-auto manga-scrollbar p-3 space-y-2">
                            {page.panels.map((panel, i) => (
                                <PanelBlock key={panel.id} panel={panel} index={i} page={page} />
                            ))}
                            <button
                                type="button"
                                onClick={addPanelToPage}
                                className="w-full flex items-center justify-center gap-1.5 py-2 rounded border border-dashed border-zinc-700 text-zinc-400 hover:border-indigo-500 hover:text-white text-sm"
                            >
                                <Plus size={15} /> コマを追加
                            </button>
                        </div>
                    </div>
                    {/* 右: ライブプレビュー */}
                    <div className="w-1/2 min-w-0 flex flex-col bg-zinc-900/40">
                        <div className="h-8 shrink-0 flex items-center px-3 border-b border-zinc-800">
                            <span className="text-[11px] text-zinc-500">吹き出しはドラッグで移動できます（キャンバスと同じ内容）</span>
                        </div>
                        <LivePreview page={page} />
                    </div>
                </div>
            )}
        </div>
    )
}

export default ScriptEditor
