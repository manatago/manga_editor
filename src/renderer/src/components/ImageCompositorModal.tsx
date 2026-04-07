import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer, Image as KonvaImage, Transformer, Rect } from 'react-konva'
import useImage from 'use-image'
import Konva from 'konva'
import { X, ImagePlus, Download, RotateCcw, FlipHorizontal, ChevronUp, ChevronDown, Trash2 } from 'lucide-react'
import { showError, showInfo } from '../utils/dialogs'
import { useMangaStore } from '../store/useMangaStore'
import type { ReferenceCharacter } from '../store/types'

interface ImageCompositorModalProps {
    isOpen: boolean
    onClose: () => void
    currentProjectPath: string | null
}

type LayerTransform = {
    x: number
    y: number
    scaleX: number
    scaleY: number
    rotation: number
}

const defaultTransform = (): LayerTransform => ({
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: 0
})

/** 長辺を基準にキャンバス寸法を決める（最大辺 1200px 前後） */
const LONG_EDGE = 1200

type AspectPreset = {
    id: string
    label: string
    category: '横長' | '縦長' | '正方形'
    wRatio: number
    hRatio: number
}

const ASPECT_PRESETS: AspectPreset[] = [
    { id: 'land-3-1', label: '横 3:1（既定）', category: '横長', wRatio: 3, hRatio: 1 },
    { id: 'land-4-1', label: '横 4:1', category: '横長', wRatio: 4, hRatio: 1 },
    { id: 'land-4-3', label: '横 4:3', category: '横長', wRatio: 4, hRatio: 3 },
    { id: 'land-16-9', label: '横 16:9', category: '横長', wRatio: 16, hRatio: 9 },
    { id: 'port-1-3', label: '縦 1:3', category: '縦長', wRatio: 1, hRatio: 3 },
    { id: 'port-1-4', label: '縦 1:4', category: '縦長', wRatio: 1, hRatio: 4 },
    { id: 'port-3-4', label: '縦 3:4', category: '縦長', wRatio: 3, hRatio: 4 },
    { id: 'port-9-16', label: '縦 9:16', category: '縦長', wRatio: 9, hRatio: 16 },
    { id: 'sq-1-1', label: '1:1', category: '正方形', wRatio: 1, hRatio: 1 }
]

function canvasSizeFromPreset(p: AspectPreset): { w: number; h: number } {
    const { wRatio: wr, hRatio: hr } = p
    if (wr === hr) {
        const s = Math.min(LONG_EDGE, 1000)
        return { w: s, h: s }
    }
    if (wr > hr) {
        const w = LONG_EDGE
        const h = Math.max(200, Math.round((LONG_EDGE * hr) / wr))
        return { w, h }
    }
    const h = LONG_EDGE
    const w = Math.max(200, Math.round((LONG_EDGE * wr) / hr))
    return { w, h }
}

type RefImageOption = {
    key: string
    characterName: string
    relativePath: string
}

function flattenReferenceImages(chars: ReferenceCharacter[]): RefImageOption[] {
    const out: RefImageOption[] = []
    for (const c of chars) {
        for (const im of c.images) {
            out.push({
                key: `${c.id}:${im.id}`,
                characterName: c.name,
                relativePath: im.relativePath
            })
        }
    }
    return out
}

function newInstanceId(): string {
    return globalThis.crypto?.randomUUID?.() ?? `ci_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

type CompositorCharInstance = {
    instanceId: string
    relativePath: string
    label: string
    transform: LayerTransform
    /** true なら初回の自動スケール済み（Undo 復元時は true のまま保持） */
    layoutResolved?: boolean
}

type CompositorSnapshot = {
    aspectPresetId: string
    canvasW: number
    canvasH: number
    bgLibraryId: string | null
    bgT: LayerTransform
    charInstances: CompositorCharInstance[]
    selected: 'bg' | string | null
}

const MAX_UNDO = 50

function cloneSnapshot(s: CompositorSnapshot): CompositorSnapshot {
    return {
        aspectPresetId: s.aspectPresetId,
        canvasW: s.canvasW,
        canvasH: s.canvasH,
        bgLibraryId: s.bgLibraryId,
        bgT: { ...s.bgT },
        charInstances: s.charInstances.map((c) => ({
            ...c,
            layoutResolved: c.layoutResolved,
            transform: { ...c.transform }
        })),
        selected: s.selected
    }
}

const waitFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))

type CompositorCharNodeProps = {
    instanceId: string
    relativePath: string
    projectPath: string | null
    transform: LayerTransform
    stackIndex: number
    canvasW: number
    canvasH: number
    onSelect: () => void
    onDragEnd: (x: number, y: number) => void
    onTransformEnd: (t: LayerTransform) => void
    onInitialLayout: (id: string, t: LayerTransform) => void
    registerNode: (id: string, node: Konva.Image | null) => void
    layoutResolved: boolean
}

const CompositorCharNode: React.FC<CompositorCharNodeProps> = ({
    instanceId,
    relativePath,
    projectPath,
    transform,
    stackIndex,
    canvasW,
    canvasH,
    onSelect,
    onDragEnd,
    onTransformEnd,
    onInitialLayout,
    registerNode,
    layoutResolved
}) => {
    const url = useMemo(() => {
        if (!projectPath || !window.electron) return ''
        const abs = window.electron.resolveAssetPath(projectPath, relativePath)
        return abs ? window.electron.pathToUrl(abs) : ''
    }, [projectPath, relativePath])
    const [img] = useImage(url, 'anonymous')
    const laidOutRef = useRef(false)

    useEffect(() => {
        if (layoutResolved || !img) return
        if (laidOutRef.current) return
        laidOutRef.current = true
        const targetH = canvasH * 0.48
        const sc = Math.min(2.5, Math.max(0.05, targetH / img.height))
        onInitialLayout(instanceId, {
            x: canvasW / 2 + stackIndex * 28,
            y: canvasH / 2,
            scaleX: sc,
            scaleY: sc,
            rotation: 0
        })
    }, [img, canvasW, canvasH, instanceId, stackIndex, onInitialLayout, layoutResolved])

    const iw = img?.width ?? 0
    const ih = img?.height ?? 0

    if (!img || iw <= 0 || ih <= 0) return null

    return (
        <KonvaImage
            ref={(node) => registerNode(instanceId, node)}
            image={img}
            x={transform.x}
            y={transform.y}
            offsetX={iw / 2}
            offsetY={ih / 2}
            scaleX={transform.scaleX}
            scaleY={transform.scaleY}
            rotation={transform.rotation}
            draggable
            onMouseDown={(e) => {
                e.cancelBubble = true
                onSelect()
            }}
            onDragEnd={(e) => {
                const n = e.target
                onDragEnd(n.x(), n.y())
            }}
            onTransformEnd={(e) => {
                const n = e.target
                onTransformEnd({
                    x: n.x(),
                    y: n.y(),
                    scaleX: n.scaleX(),
                    scaleY: n.scaleY(),
                    rotation: n.rotation()
                })
            }}
        />
    )
}

export const ImageCompositorModal: React.FC<ImageCompositorModalProps> = ({
    isOpen,
    onClose,
    currentProjectPath
}) => {
    const backgroundLibrary = useMangaStore((s) => s.backgroundLibrary)
    const referenceCharacters = useMangaStore((s) => s.referenceCharacters)

    const defaultPreset = ASPECT_PRESETS[0]
    const [aspectPresetId, setAspectPresetId] = useState(defaultPreset.id)

    const [canvasW, setCanvasW] = useState(() => canvasSizeFromPreset(ASPECT_PRESETS[0]).w)
    const [canvasH, setCanvasH] = useState(() => canvasSizeFromPreset(ASPECT_PRESETS[0]).h)

    const [bgLibraryId, setBgLibraryId] = useState<string | null>(null)
    const [charInstances, setCharInstances] = useState<CompositorCharInstance[]>([])
    const [selected, setSelected] = useState<'bg' | string | null>(null)
    const [bgT, setBgT] = useState<LayerTransform>(() => defaultTransform())

    const bgItem = bgLibraryId ? backgroundLibrary.find((b) => b.id === bgLibraryId) : null
    const bgUrl = useMemo(() => {
        if (!currentProjectPath || !bgItem || !window.electron) return ''
        const abs = window.electron.resolveAssetPath(currentProjectPath, bgItem.relativePath)
        return abs ? window.electron.pathToUrl(abs) : ''
    }, [currentProjectPath, bgItem])
    const [bgImg] = useImage(bgUrl, 'anonymous')

    const stageRef = useRef<Konva.Stage>(null)
    const contentLayerRef = useRef<Konva.Layer>(null)
    const trRef = useRef<Konva.Transformer>(null)
    const bgRef = useRef<Konva.Image>(null)
    const charNodeRefs = useRef<Map<string, Konva.Image>>(new Map())
    const bgInitRef = useRef(false)
    const canvasViewportRef = useRef<HTMLDivElement>(null)

    const [fitScale, setFitScale] = useState(1)
    const fitScaleRef = useRef(1)
    useEffect(() => {
        fitScaleRef.current = fitScale
    }, [fitScale])

    const [undoStack, setUndoStack] = useState<CompositorSnapshot[]>([])
    const snapshotRef = useRef<CompositorSnapshot | null>(null)

    useEffect(() => {
        if (!isOpen) return
        snapshotRef.current = {
            aspectPresetId,
            canvasW,
            canvasH,
            bgLibraryId,
            bgT: { ...bgT },
            charInstances: charInstances.map((c) => ({
                ...c,
                layoutResolved: c.layoutResolved,
                transform: { ...c.transform }
            })),
            selected
        }
    }, [isOpen, aspectPresetId, canvasW, canvasH, bgLibraryId, bgT, charInstances, selected])

    const pushUndo = useCallback(() => {
        const s = snapshotRef.current
        if (!s) return
        setUndoStack((st) => [...st.slice(-(MAX_UNDO - 1)), cloneSnapshot(s)])
    }, [])

    const applySnapshot = useCallback((snap: CompositorSnapshot) => {
        setAspectPresetId(snap.aspectPresetId)
        setCanvasW(snap.canvasW)
        setCanvasH(snap.canvasH)
        setBgLibraryId(snap.bgLibraryId)
        setBgT({ ...snap.bgT })
        setCharInstances(
            snap.charInstances.map((c) => ({
                ...c,
                layoutResolved: c.layoutResolved,
                transform: { ...c.transform }
            }))
        )
        setSelected(snap.selected)
        bgInitRef.current = true
    }, [])

    const handleUndo = useCallback(() => {
        setUndoStack((st) => {
            if (st.length === 0) return st
            const top = st[st.length - 1]
            const next = st.slice(0, -1)
            requestAnimationFrame(() => applySnapshot(top))
            return next
        })
    }, [applySnapshot])

    useEffect(() => {
        if (!isOpen) return
        const el = canvasViewportRef.current
        if (!el) return
        const update = () => {
            const pad = 16
            const w = Math.max(80, el.clientWidth - pad)
            const h = Math.max(80, el.clientHeight - pad)
            const sx = w / canvasW
            const sy = h / canvasH
            const s = Math.min(sx, sy, 1)
            setFitScale(s > 0 && Number.isFinite(s) ? s : 1)
        }
        update()
        const ro = new ResizeObserver(update)
        ro.observe(el)
        window.addEventListener('resize', update)
        return () => {
            ro.disconnect()
            window.removeEventListener('resize', update)
        }
    }, [isOpen, canvasW, canvasH])

    useEffect(() => {
        if (!isOpen) return
        const onKey = (e: KeyboardEvent) => {
            const el = e.target as HTMLElement | null
            if (
                el &&
                (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
            ) {
                return
            }
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
                e.preventDefault()
                handleUndo()
                return
            }
            if (e.key === 'Backspace' || e.key === 'Delete') {
                e.preventDefault()
                if (selected === 'bg') {
                    pushUndo()
                    setBgLibraryId(null)
                    setSelected(null)
                    bgInitRef.current = false
                } else if (selected && selected !== 'bg') {
                    pushUndo()
                    const id = selected
                    setCharInstances((prev) => prev.filter((c) => c.instanceId !== id))
                    charNodeRefs.current.delete(id)
                    setSelected(null)
                }
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [isOpen, selected, handleUndo, pushUndo])

    const refImageOptions = useMemo(() => flattenReferenceImages(referenceCharacters), [referenceCharacters])

    const registerCharNode = useCallback((id: string, node: Konva.Image | null) => {
        if (node) charNodeRefs.current.set(id, node)
        else charNodeRefs.current.delete(id)
    }, [])

    const handleCharInitialLayout = useCallback((id: string, t: LayerTransform) => {
        setCharInstances((prev) =>
            prev.map((c) => (c.instanceId === id ? { ...c, transform: t, layoutResolved: true } : c))
        )
    }, [])

    useEffect(() => {
        if (!isOpen) return
        const p = ASPECT_PRESETS.find((x) => x.id === aspectPresetId) ?? ASPECT_PRESETS[0]
        const { w, h } = canvasSizeFromPreset(p)
        setCanvasW(w)
        setCanvasH(h)
    }, [isOpen, aspectPresetId])

    useEffect(() => {
        if (!isOpen) return
        bgInitRef.current = false
        charNodeRefs.current.clear()
        setCharInstances([])
        setSelected(null)
        setBgLibraryId(null)
        setBgT(defaultTransform())
        setUndoStack([])
        setFitScale(1)
    }, [isOpen])

    useEffect(() => {
        if (!bgImg || !isOpen) return
        if (bgInitRef.current) return
        bgInitRef.current = true
        const sc = Math.max(canvasW / bgImg.width, canvasH / bgImg.height)
        setBgT({
            x: canvasW / 2,
            y: canvasH / 2,
            scaleX: sc,
            scaleY: sc,
            rotation: 0
        })
    }, [bgImg, canvasW, canvasH, isOpen])

    useEffect(() => {
        const tr = trRef.current
        if (!tr) return
        if (selected === 'bg' && bgRef.current) {
            tr.nodes([bgRef.current])
        } else if (selected && selected !== 'bg') {
            const node = charNodeRefs.current.get(selected)
            tr.nodes(node ? [node] : [])
        } else {
            tr.nodes([])
        }
        tr.getLayer()?.batchDraw()
    }, [selected, bgImg, charInstances, bgT])

    const resetBgFit = useCallback(() => {
        if (!bgImg) return
        pushUndo()
        const sc = Math.max(canvasW / bgImg.width, canvasH / bgImg.height)
        setBgT({
            x: canvasW / 2,
            y: canvasH / 2,
            scaleX: sc,
            scaleY: sc,
            rotation: 0
        })
    }, [bgImg, canvasW, canvasH, pushUndo])

    const addCharacter = useCallback(
        (opt: RefImageOption) => {
            pushUndo()
            setCharInstances((prev) => [
                ...prev,
                {
                    instanceId: newInstanceId(),
                    relativePath: opt.relativePath,
                    label: `${opt.characterName}`,
                    layoutResolved: false,
                    transform: {
                        x: canvasW / 2 + prev.length * 28,
                        y: canvasH / 2,
                        scaleX: 1,
                        scaleY: 1,
                        rotation: 0
                    }
                }
            ])
        },
        [canvasW, canvasH, pushUndo]
    )

    const removeCharacter = useCallback(
        (instanceId: string) => {
            pushUndo()
            setCharInstances((prev) => prev.filter((c) => c.instanceId !== instanceId))
            charNodeRefs.current.delete(instanceId)
            setSelected((s) => (s === instanceId ? null : s))
        },
        [pushUndo]
    )

    const bringForward = useCallback((instanceId: string) => {
        pushUndo()
        setCharInstances((prev) => {
            const i = prev.findIndex((x) => x.instanceId === instanceId)
            if (i < 0 || i >= prev.length - 1) return prev
            const copy = [...prev]
            ;[copy[i], copy[i + 1]] = [copy[i + 1], copy[i]]
            return copy
        })
    }, [pushUndo])

    const sendBackward = useCallback((instanceId: string) => {
        pushUndo()
        setCharInstances((prev) => {
            const i = prev.findIndex((x) => x.instanceId === instanceId)
            if (i <= 0) return prev
            const copy = [...prev]
            ;[copy[i], copy[i - 1]] = [copy[i - 1], copy[i]]
            return copy
        })
    }, [pushUndo])

    const flipHorizontal = useCallback((instanceId: string) => {
        pushUndo()
        setCharInstances((prev) =>
            prev.map((c) =>
                c.instanceId === instanceId
                    ? { ...c, transform: { ...c.transform, scaleX: -c.transform.scaleX } }
                    : c
            )
        )
    }, [pushUndo])

    const flipBgHorizontal = useCallback(() => {
        pushUndo()
        setBgT((prev) => ({ ...prev, scaleX: -prev.scaleX }))
    }, [pushUndo])

    const updateCharTransform = useCallback((instanceId: string, t: LayerTransform) => {
        setCharInstances((prev) => prev.map((c) => (c.instanceId === instanceId ? { ...c, transform: t } : c)))
    }, [])

    const handleExport = async () => {
        if (!currentProjectPath || !window.electron || !stageRef.current) {
            await showError('プロジェクトを開いた状態でエクスポートしてください')
            return
        }
        if (!bgImg && charInstances.length === 0) {
            await showError('背景（背景ライブラリ）またはキャラを少なくとも 1 つ選んでください')
            return
        }
        const stage = stageRef.current
        const layer = contentLayerRef.current
        const fs = fitScaleRef.current
        const dw = Math.round(canvasW * fs)
        const dh = Math.round(canvasH * fs)
        try {
            trRef.current?.nodes([])
            trRef.current?.getLayer()?.batchDraw()
            if (layer) {
                layer.scale({ x: 1, y: 1 })
            }
            stage.width(canvasW)
            stage.height(canvasH)
            stage.batchDraw()
            await waitFrame()
            await waitFrame()
            const dataUrl = stage.toDataURL({
                pixelRatio: 2,
                mimeType: 'image/png'
            })
            const { relativePath } = await window.electron.saveCompositePng(currentProjectPath, dataUrl)
            await showInfo(`${relativePath} に保存しました`)
        } catch (e) {
            console.error('ImageCompositorModal: export', e)
            await showError('画像の保存に失敗しました')
        } finally {
            if (layer && stage) {
                layer.scale({ x: fs, y: fs })
                stage.width(dw)
                stage.height(dh)
                stage.batchDraw()
            }
        }
    }

    if (!isOpen) return null

    const iwBg = bgImg?.width ?? 0
    const ihBg = bgImg?.height ?? 0

    const aspectSelect = (
        <label className="flex flex-col gap-1">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wide">キャンバス比率</span>
            <select
                value={aspectPresetId}
                onChange={(e) => {
                    pushUndo()
                    setAspectPresetId(e.target.value)
                    bgInitRef.current = false
                }}
                className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1.5 text-sm text-white"
            >
                <optgroup label="横長">
                    {ASPECT_PRESETS.filter((p) => p.category === '横長').map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.label}
                        </option>
                    ))}
                </optgroup>
                <optgroup label="縦長">
                    {ASPECT_PRESETS.filter((p) => p.category === '縦長').map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.label}
                        </option>
                    ))}
                </optgroup>
                <optgroup label="正方形">
                    {ASPECT_PRESETS.filter((p) => p.category === '正方形').map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.label}
                        </option>
                    ))}
                </optgroup>
            </select>
            <span className="text-[10px] text-zinc-600 font-mono">
                {canvasW} × {canvasH} px
            </span>
        </label>
    )

    return (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col shadow-2xl">
                <div className="p-4 border-b border-zinc-800 flex justify-between items-start gap-3 shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <ImagePlus className="text-pink-400" size={22} />
                            背景＋人物の合成
                        </h2>
                        <p className="text-zinc-500 text-xs mt-1">
                            比率を選び、背景ライブラリと参照キャラに登録済みの画像だけを使います。⌘Z / Ctrl+Z
                            で直前の操作を戻せます。Delete / Backspace で選択中の背景またはキャラを外します。
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400"
                    >
                        <X size={22} />
                    </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto manga-scrollbar p-4 flex flex-col lg:flex-row gap-4">
                    <div className="flex flex-col gap-3 shrink-0 lg:w-72">
                        {aspectSelect}

                        <div className="border-t border-zinc-800 pt-3 space-y-2">
                            <span className="text-xs font-bold text-zinc-400">背景（背景ライブラリ）</span>
                            {backgroundLibrary.length === 0 ? (
                                <p className="text-[11px] text-zinc-600">
                                    左メニュー「背景ライブラリ」で画像を登録すると、ここから選べます。
                                </p>
                            ) : (
                                <div className="grid grid-cols-3 gap-1.5 max-h-36 overflow-y-auto manga-scrollbar">
                                    {backgroundLibrary.map((item) => {
                                        const thumb =
                                            currentProjectPath && window.electron
                                                ? window.electron.pathToUrl(
                                                      window.electron.resolveAssetPath(
                                                          currentProjectPath,
                                                          item.relativePath
                                                      )
                                                  )
                                                : ''
                                        const active = bgLibraryId === item.id
                                        return (
                                            <button
                                                key={item.id}
                                                type="button"
                                                title={item.name}
                                                onClick={() => {
                                                    pushUndo()
                                                    setBgLibraryId(item.id)
                                                    bgInitRef.current = false
                                                }}
                                                className={`aspect-square rounded-md border overflow-hidden p-0 ${
                                                    active
                                                        ? 'border-sky-500 ring-1 ring-sky-500'
                                                        : 'border-zinc-700 hover:border-zinc-500'
                                                }`}
                                            >
                                                {thumb ? (
                                                    <img src={thumb} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full bg-zinc-800 text-[8px] text-zinc-600 p-1 break-all">
                                                        {item.name}
                                                    </div>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="border-t border-zinc-800 pt-3 space-y-2">
                            <span className="text-xs font-bold text-zinc-400">キャラを追加（参照キャラ）</span>
                            {refImageOptions.length === 0 ? (
                                <p className="text-[11px] text-zinc-600">
                                    「参照キャラクター」で画像を登録すると、ここから追加できます。
                                </p>
                            ) : (
                                <div className="grid grid-cols-3 gap-1.5 max-h-44 overflow-y-auto manga-scrollbar">
                                    {refImageOptions.map((opt) => {
                                        const thumb =
                                            currentProjectPath && window.electron
                                                ? window.electron.pathToUrl(
                                                      window.electron.resolveAssetPath(
                                                          currentProjectPath,
                                                          opt.relativePath
                                                      )
                                                  )
                                                : ''
                                        return (
                                            <button
                                                key={opt.key}
                                                type="button"
                                                title={`${opt.characterName} を追加`}
                                                onClick={() => addCharacter(opt)}
                                                className="aspect-square rounded-md border border-zinc-700 overflow-hidden p-0 hover:border-pink-500"
                                            >
                                                {thumb ? (
                                                    <img src={thumb} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full bg-zinc-800" />
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {charInstances.length > 0 ? (
                            <div className="border-t border-zinc-800 pt-3 space-y-2">
                                <span className="text-xs font-bold text-zinc-400">載せているキャラ</span>
                                <ul className="space-y-1">
                                    {charInstances.map((c, idx) => (
                                        <li
                                            key={c.instanceId}
                                            className={`flex items-center gap-1 rounded-md border px-1.5 py-1 text-[11px] ${
                                                selected === c.instanceId
                                                    ? 'border-sky-500 bg-sky-950/30'
                                                    : 'border-zinc-700 bg-zinc-800/50'
                                            }`}
                                        >
                                            <button
                                                type="button"
                                                className="flex-1 text-left truncate text-zinc-200"
                                                onClick={() => setSelected(c.instanceId)}
                                            >
                                                {idx + 1}. {c.label}
                                            </button>
                                            <button
                                                type="button"
                                                className="p-1 text-zinc-500 hover:text-white"
                                                title="前面へ"
                                                onClick={() => bringForward(c.instanceId)}
                                            >
                                                <ChevronUp size={14} />
                                            </button>
                                            <button
                                                type="button"
                                                className="p-1 text-zinc-500 hover:text-white"
                                                title="背面へ"
                                                onClick={() => sendBackward(c.instanceId)}
                                            >
                                                <ChevronDown size={14} />
                                            </button>
                                            <button
                                                type="button"
                                                className={`p-1 hover:text-sky-300 ${c.transform.scaleX < 0 ? 'text-sky-400' : 'text-zinc-500'}`}
                                                title="左右反転"
                                                onClick={() => flipHorizontal(c.instanceId)}
                                            >
                                                <FlipHorizontal size={14} />
                                            </button>
                                            <button
                                                type="button"
                                                className="p-1 text-zinc-500 hover:text-red-400"
                                                title="削除"
                                                onClick={() => removeCharacter(c.instanceId)}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ) : null}

                        {bgImg ? (
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={resetBgFit}
                                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-zinc-800/80 text-xs text-zinc-300 border border-zinc-700"
                                >
                                    <RotateCcw size={14} />
                                    キャンバスに合わせ
                                </button>
                                <button
                                    type="button"
                                    onClick={flipBgHorizontal}
                                    title="背景を左右反転"
                                    className={`px-3 py-2 rounded-lg text-xs border flex items-center gap-1.5 ${bgT.scaleX < 0 ? 'bg-sky-900/40 border-sky-600 text-sky-300' : 'bg-zinc-800/80 border-zinc-700 text-zinc-300'}`}
                                >
                                    <FlipHorizontal size={14} />
                                    反転
                                </button>
                            </div>
                        ) : null}

                        <button
                            type="button"
                            onClick={handleExport}
                            disabled={!currentProjectPath}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-bold disabled:opacity-40"
                        >
                            <Download size={18} />
                            PNG で保存（assets/images/composite/）
                        </button>
                        <p className="text-[10px] text-zinc-600">
                            ファイル名は保存日時から自動で付きます（例: 20260402_154530_123.png）。
                        </p>
                    </div>

                    <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-2">
                        <p className="text-xs text-zinc-500 shrink-0">
                            プレビューは枠内に全体表示されます。背景・キャラをクリックで選択。ドラッグ移動・枠で拡縮・回転。キャラ一覧の順が重なり順（下が奥）。
                        </p>
                        <div
                            ref={canvasViewportRef}
                            className="flex-1 min-h-[200px] min-w-0 rounded-lg border border-zinc-700 bg-zinc-950 flex items-center justify-center p-2"
                            style={{ maxHeight: 'min(58vh, 560px)' }}
                        >
                            <Stage
                                ref={stageRef}
                                width={Math.round(canvasW * fitScale)}
                                height={Math.round(canvasH * fitScale)}
                                onMouseDown={(e) => {
                                    const t = e.target
                                    if (t === t.getStage()) setSelected(null)
                                }}
                            >
                                <Layer
                                    ref={contentLayerRef}
                                    name="compositor-content"
                                    scaleX={fitScale}
                                    scaleY={fitScale}
                                >
                                    <Rect
                                        width={canvasW}
                                        height={canvasH}
                                        fill="#f4f4f5"
                                        listening
                                        onMouseDown={() => setSelected(null)}
                                    />
                                    {bgImg && iwBg > 0 && ihBg > 0 ? (
                                        <KonvaImage
                                            ref={bgRef}
                                            image={bgImg}
                                            x={bgT.x}
                                            y={bgT.y}
                                            offsetX={iwBg / 2}
                                            offsetY={ihBg / 2}
                                            scaleX={bgT.scaleX}
                                            scaleY={bgT.scaleY}
                                            rotation={bgT.rotation}
                                            draggable
                                            onMouseDown={(e) => {
                                                e.cancelBubble = true
                                                setSelected('bg')
                                            }}
                                            onDragEnd={(e) => {
                                                pushUndo()
                                                const n = e.target
                                                setBgT((prev) => ({
                                                    ...prev,
                                                    x: n.x(),
                                                    y: n.y()
                                                }))
                                            }}
                                            onTransformEnd={(e) => {
                                                pushUndo()
                                                const n = e.target
                                                setBgT({
                                                    x: n.x(),
                                                    y: n.y(),
                                                    scaleX: n.scaleX(),
                                                    scaleY: n.scaleY(),
                                                    rotation: n.rotation()
                                                })
                                            }}
                                        />
                                    ) : null}
                                    {charInstances.map((c, idx) => (
                                        <CompositorCharNode
                                            key={c.instanceId}
                                            instanceId={c.instanceId}
                                            relativePath={c.relativePath}
                                            projectPath={currentProjectPath}
                                            transform={c.transform}
                                            stackIndex={idx}
                                            canvasW={canvasW}
                                            canvasH={canvasH}
                                            onSelect={() => setSelected(c.instanceId)}
                                            onDragEnd={(x, y) => {
                                                pushUndo()
                                                const id = c.instanceId
                                                setCharInstances((prev) =>
                                                    prev.map((ci) =>
                                                        ci.instanceId === id
                                                            ? { ...ci, transform: { ...ci.transform, x, y } }
                                                            : ci
                                                    )
                                                )
                                            }}
                                            onTransformEnd={(t) => {
                                                pushUndo()
                                                updateCharTransform(c.instanceId, t)
                                            }}
                                            onInitialLayout={handleCharInitialLayout}
                                            registerNode={registerCharNode}
                                            layoutResolved={!!c.layoutResolved}
                                        />
                                    ))}
                                    <Transformer
                                        ref={trRef}
                                        rotateEnabled
                                        borderStroke="#3b82f6"
                                        anchorStroke="#3b82f6"
                                        anchorFill="#ffffff"
                                        boundBoxFunc={(oldBox, newBox) => {
                                            if (newBox.width < 12 || newBox.height < 12) return oldBox
                                            return newBox
                                        }}
                                    />
                                </Layer>
                            </Stage>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
