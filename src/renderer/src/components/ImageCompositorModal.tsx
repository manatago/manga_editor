import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer, Image as KonvaImage, Transformer, Rect } from 'react-konva'
import useImage from 'use-image'
import Konva from 'konva'
import { X, ImagePlus, Download, RotateCcw, FlipHorizontal, ChevronUp, ChevronDown, Trash2 } from 'lucide-react'
import { showError, showInfo, confirmMessage } from '../utils/dialogs'
import { getScreenToneDataUrl, SCREEN_TONE_CATALOG } from '../utils/screenToneCatalog'
import { useMangaStore } from '../store/useMangaStore'
import {
    ASPECT_PRESETS,
    canvasSizeFromPreset,
    defaultTransform,
    flattenReferenceImages,
    newInstanceId,
    waitFrame,
    type CompositorCharInstance,
    type CompositorSnapshot,
    type LayerTransform,
    type RefImageOption
} from './ImageCompositor/types'
import { CompositorCharNode } from './ImageCompositor/CompositorCharNode'
import { useFitScale } from './ImageCompositor/useFitScale'
import { useCompositorUndo } from './ImageCompositor/useCompositorUndo'
import { CompositeZoomOverlay } from './ImageCompositor/CompositeZoomOverlay'

interface ImageCompositorModalProps {
    isOpen: boolean
    onClose: () => void
    currentProjectPath: string | null
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
    // 内蔵スクリーントーン背景（背景ライブラリ画像とは排他）
    const [bgToneId, setBgToneId] = useState<string | null>(null)
    const [bgToneScale, setBgToneScale] = useState(1)
    const [charInstances, setCharInstances] = useState<CompositorCharInstance[]>([])
    const [selected, setSelected] = useState<'bg' | string | null>(null)
    const [bgT, setBgT] = useState<LayerTransform>(() => defaultTransform())
    const [compositesList, setCompositesList] = useState<string[]>([])
    const [zoomedComposite, setZoomedComposite] = useState<string | null>(null)

    const reloadComposites = useCallback(async () => {
        if (!currentProjectPath || !window.electron) {
            setCompositesList([])
            return
        }
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
            console.error('ImageCompositorModal: failed to list composites', e)
            setCompositesList([])
        }
    }, [currentProjectPath])

    useEffect(() => {
        if (!isOpen) return
        void reloadComposites()
    }, [isOpen, reloadComposites])

    const bgItem = bgLibraryId ? backgroundLibrary.find((b) => b.id === bgLibraryId) : null
    const bgUrl = useMemo(() => {
        if (!currentProjectPath || !bgItem || !window.electron) return ''
        const abs = window.electron.resolveAssetPath(currentProjectPath, bgItem.relativePath)
        return abs ? window.electron.pathToUrl(abs) : ''
    }, [currentProjectPath, bgItem])
    const [bgImg] = useImage(bgUrl, 'anonymous')

    // 内蔵トーンの SVG data URL を画像化（タイル背景に使う）。data URL なので canvas は汚染されない。
    const toneDataUrl = bgToneId ? (getScreenToneDataUrl(bgToneId) ?? '') : ''
    const [toneImg] = useImage(toneDataUrl, 'anonymous')

    const stageRef = useRef<Konva.Stage>(null)
    const contentLayerRef = useRef<Konva.Layer>(null)
    const trRef = useRef<Konva.Transformer>(null)
    const bgRef = useRef<Konva.Image>(null)
    const charNodeRefs = useRef<Map<string, Konva.Image>>(new Map())
    const bgInitRef = useRef(false)
    const canvasViewportRef = useRef<HTMLDivElement>(null)

    const { fitScale, fitScaleRef, resetFitScale } = useFitScale({
        isOpen,
        canvasW,
        canvasH,
        viewportRef: canvasViewportRef
    })

    const applySnapshot = useCallback((snap: CompositorSnapshot) => {
        setAspectPresetId(snap.aspectPresetId)
        setCanvasW(snap.canvasW)
        setCanvasH(snap.canvasH)
        setBgLibraryId(snap.bgLibraryId)
        setBgToneId(snap.bgToneId)
        setBgToneScale(snap.bgToneScale)
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

    const { pushUndo, handleUndo, resetUndo } = useCompositorUndo({
        isOpen,
        aspectPresetId,
        canvasW,
        canvasH,
        bgLibraryId,
        bgToneId,
        bgToneScale,
        bgT,
        charInstances,
        selected,
        applySnapshot
    })

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
            // 拡大表示中はキャンバスショートカットを無効化
            if (zoomedComposite) return
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
    }, [isOpen, selected, handleUndo, pushUndo, zoomedComposite])

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
        setBgToneId(null)
        setBgToneScale(1)
        setBgT(defaultTransform())
        resetUndo()
        resetFitScale()
    }, [isOpen, resetUndo, resetFitScale])

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

    const handleExport = async (): Promise<void> => {
        if (!currentProjectPath || !window.electron || !stageRef.current) {
            await showError('プロジェクトを開いた状態でエクスポートしてください')
            return
        }
        if (!bgImg && !bgToneId && charInstances.length === 0) {
            await showError('背景（背景ライブラリ／内蔵トーン）またはキャラを少なくとも 1 つ選んでください')
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
            void reloadComposites()
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

    const handleDeleteComposite = async (relPath: string): Promise<void> => {
        if (!currentProjectPath || !window.electron) return
        const ok = await confirmMessage('この合成画像を削除しますか？（assets/dust/ に移動します）')
        if (!ok) return
        try {
            const abs = window.electron.resolveAssetPath(currentProjectPath, relPath)
            if (!abs) throw new Error('パスの解決に失敗しました')
            const result = await window.electron.moveAssetToTrash(currentProjectPath, abs)
            if (!result.moved) {
                await showError(`削除できませんでした (${result.reason})`)
                return
            }
        } catch (e) {
            await showError(e instanceof Error ? e.message : String(e))
            return
        }
        if (zoomedComposite === relPath) setZoomedComposite(null)
        void reloadComposites()
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
                            比率を選び、背景ライブラリ画像・内蔵スクリーントーン・参照キャラの画像を使えます。⌘Z / Ctrl+Z
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
                                                    setBgToneId(null)
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
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-zinc-400">背景（内蔵トーン）</span>
                                {bgToneId && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            pushUndo()
                                            setBgToneId(null)
                                        }}
                                        className="text-[10px] text-zinc-500 hover:text-zinc-300"
                                    >
                                        トーンを外す
                                    </button>
                                )}
                            </div>
                            <div className="grid grid-cols-6 gap-1 max-h-36 overflow-y-auto manga-scrollbar">
                                {SCREEN_TONE_CATALOG.map((tone) => {
                                    const active = bgToneId === tone.id
                                    return (
                                        <button
                                            key={tone.id}
                                            type="button"
                                            title={tone.name}
                                            onClick={() => {
                                                pushUndo()
                                                setBgToneId(tone.id)
                                                setBgLibraryId(null)
                                                setSelected(null)
                                            }}
                                            className={`aspect-square rounded-md border overflow-hidden bg-white p-0 ${
                                                active
                                                    ? 'border-sky-500 ring-1 ring-sky-500'
                                                    : 'border-zinc-700 hover:border-zinc-500'
                                            }`}
                                        >
                                            <img src={tone.dataUrl} alt="" className="w-full h-full object-cover" />
                                        </button>
                                    )
                                })}
                            </div>
                            {bgToneId && (
                                <label className="flex items-center gap-2 text-[11px] text-zinc-400">
                                    <span className="shrink-0 w-16">タイルの大きさ</span>
                                    <input
                                        type="range"
                                        min={0.3}
                                        max={3}
                                        step={0.1}
                                        value={bgToneScale}
                                        onPointerDown={() => pushUndo()}
                                        onChange={(e) => setBgToneScale(Number(e.target.value))}
                                        className="flex-1 accent-sky-500"
                                    />
                                    <span className="w-9 text-right font-mono text-zinc-500">{Math.round(bgToneScale * 100)}%</span>
                                </label>
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
                            PNG で保存（assets/composites/）
                        </button>
                        <p className="text-[10px] text-zinc-600">
                            ファイル名は保存日時から自動で付きます（例: 20260402_154530_123.png）。
                        </p>

                        <div className="border-t border-zinc-800 pt-3 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-zinc-400">過去の合成出力</span>
                                <span className="text-[10px] text-zinc-500">{compositesList.length} 件</span>
                            </div>
                            {compositesList.length === 0 ? (
                                <p className="text-[11px] text-zinc-600">
                                    まだ保存されていません。
                                </p>
                            ) : (
                                <div className="grid grid-cols-3 gap-1.5 max-h-48 overflow-y-auto manga-scrollbar">
                                    {compositesList.map((rel) => {
                                        const abs = currentProjectPath && window.electron
                                            ? window.electron.resolveAssetPath(currentProjectPath, rel)
                                            : ''
                                        const url = abs && window.electron ? window.electron.pathToUrl(abs) : ''
                                        const base = rel.split('/').pop() ?? rel
                                        return (
                                            <div
                                                key={rel}
                                                className="relative aspect-square rounded-md border border-zinc-700 overflow-hidden hover:border-zinc-500 group"
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => setZoomedComposite(rel)}
                                                    className="absolute inset-0"
                                                    title={`${base}\nクリックで拡大`}
                                                >
                                                    {url ? (
                                                        <img src={url} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full bg-zinc-800" />
                                                    )}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); void handleDeleteComposite(rel) }}
                                                    className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black/60 text-zinc-300 hover:text-red-400"
                                                    title="削除（assets/dust/ へ移動）"
                                                >
                                                    <Trash2 size={11} />
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
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
                                    {bgToneId && toneImg ? (
                                        <>
                                            {/* 紙（白）の上にトーンをタイル敷き */}
                                            <Rect
                                                width={canvasW}
                                                height={canvasH}
                                                fill="#ffffff"
                                                listening
                                                onMouseDown={() => setSelected(null)}
                                            />
                                            <Rect
                                                width={canvasW}
                                                height={canvasH}
                                                fillPatternImage={toneImg}
                                                fillPatternRepeat="repeat"
                                                fillPatternScale={{ x: bgToneScale, y: bgToneScale }}
                                                listening
                                                onMouseDown={() => setSelected(null)}
                                            />
                                        </>
                                    ) : null}
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

            {zoomedComposite && (
                <CompositeZoomOverlay
                    relativePath={zoomedComposite}
                    compositesList={compositesList}
                    currentProjectPath={currentProjectPath}
                    onClose={() => setZoomedComposite(null)}
                    onSelect={(rel) => setZoomedComposite(rel)}
                    onDelete={(rel) => void handleDeleteComposite(rel)}
                />
            )}
        </div>
    )
}
