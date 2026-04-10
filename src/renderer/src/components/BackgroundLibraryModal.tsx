import React, { useEffect, useRef, useState } from 'react'
import { Plus, Trash2, X, Layers } from 'lucide-react'
import { useMangaStore } from '../store/useMangaStore'
import { BACKGROUND_LIBRARY_ASSETS_SUBPATH } from '../utils/backgroundLibrary'
import { SCREEN_TONE_CATALOG } from '../utils/screenToneCatalog'
import { showError } from '../utils/dialogs'

type ApplyTarget = 'page' | 'panel-bg' | 'panel-fg'
type LibTab = 'tones' | 'custom-tones' | 'custom'

interface BackgroundLibraryModalProps {
    isOpen: boolean
    onClose: () => void
}

export const BackgroundLibraryModal: React.FC<BackgroundLibraryModalProps> = ({ isOpen, onClose }) => {
    const currentProjectPath = useMangaStore((s) => s.currentProjectPath)
    const pages = useMangaStore((s) => s.pages)
    const currentPageId = useMangaStore((s) => s.currentPageId)
    const updatePage = useMangaStore((s) => s.updatePage)
    const updatePanel = useMangaStore((s) => s.updatePanel)
    const selectedPanelId = useMangaStore((s) => s.selectedPanelId)
    const backgroundLibrary = useMangaStore((s) => s.backgroundLibrary)
    const addBackgroundLibraryImage = useMangaStore((s) => s.addBackgroundLibraryImage)
    const removeBackgroundLibraryImage = useMangaStore((s) => s.removeBackgroundLibraryImage)
    const updateBackgroundLibraryImage = useMangaStore((s) => s.updateBackgroundLibraryImage)
    const customTones = useMangaStore((s) => s.customTones)
    const customTonePaths = useMangaStore((s) => s.customTonePaths)
    const addCustomTone = useMangaStore((s) => s.addCustomTone)
    const removeCustomTone = useMangaStore((s) => s.removeCustomTone)

    const [tab, setTab] = useState<LibTab>('tones')
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
    const [applyTarget, setApplyTarget] = useState<ApplyTarget>('page')
    const prevIsOpen = useRef(false)

    const currentPage = pages.find((p) => p.id === currentPageId)
    const selectedPanel = currentPage?.panels.find((p) => p.id === selectedPanelId) ?? null

    // 現在の設定値（スライダーに反映）
    const bgOpacity = applyTarget === 'panel-bg'
        ? (selectedPanel?.backgroundImageOpacity ?? 1)
        : (currentPage?.backgroundImageOpacity ?? 1)
    const bgScale = selectedPanel?.backgroundImageScale ?? 1
    const bgRotation = selectedPanel?.backgroundImageRotation ?? 0
    const fgOpacity = selectedPanel?.fgToneOpacity ?? 1
    const fgScale = selectedPanel?.fgToneScale ?? 1
    const fgRotation = selectedPanel?.fgToneRotation ?? 0

    const hasBgTone = applyTarget === 'panel-bg'
        ? !!selectedPanel?.backgroundImagePath
        : !!currentPage?.backgroundImagePath
    const hasFgTone = !!selectedPanel?.fgTonePath

    useEffect(() => {
        if (isOpen && !prevIsOpen.current) {
            setApplyTarget(selectedPanel ? 'panel-bg' : 'page')
        }
        prevIsOpen.current = isOpen
    }, [isOpen, selectedPanel])

    useEffect(() => {
        if (!isOpen) setLightboxUrl(null)
    }, [isOpen])

    useEffect(() => {
        if (!lightboxUrl) return
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightboxUrl(null) }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [lightboxUrl])

    // ---- apply helpers ----

    const applyToTarget = (path: string, fit: 'tile' | 'stretch') => {
        if (!currentPageId) return
        if (applyTarget === 'panel-fg') {
            if (!selectedPanelId || !selectedPanel) return
            updatePanel(selectedPanelId, {
                fgTonePath: path,
                fgToneOpacity: selectedPanel.fgToneOpacity ?? 1,
                fgToneScale: selectedPanel.fgToneScale ?? 1,
                fgToneRotation: selectedPanel.fgToneRotation ?? 0
            })
            return
        }
        if (applyTarget === 'panel-bg') {
            if (!selectedPanelId || !selectedPanel) return
            updatePanel(selectedPanelId, {
                backgroundImagePath: path,
                backgroundImageFit: fit,
                backgroundImageOpacity: selectedPanel.backgroundImageOpacity ?? 1,
                backgroundImageScale: selectedPanel.backgroundImageScale ?? 1,
                backgroundImageRotation: selectedPanel.backgroundImageRotation ?? 0
            })
            return
        }
        // page
        updatePage(currentPageId, {
            backgroundImagePath: path,
            backgroundImageFit: fit,
            backgroundImageOpacity: currentPage?.backgroundImageOpacity ?? 1
        })
    }

    const clearTarget = () => {
        if (!currentPageId) return
        if (applyTarget === 'panel-fg') {
            if (!selectedPanelId) return
            updatePanel(selectedPanelId, { fgTonePath: undefined, fgToneOpacity: undefined, fgToneScale: undefined, fgToneRotation: undefined })
            return
        }
        if (applyTarget === 'panel-bg') {
            if (!selectedPanelId) return
            updatePanel(selectedPanelId, { backgroundImagePath: undefined, backgroundImageFit: undefined, backgroundImageOpacity: undefined, backgroundImageScale: undefined, backgroundImageRotation: undefined })
            return
        }
        updatePage(currentPageId, { backgroundImagePath: undefined, backgroundImageFit: undefined, backgroundImageOpacity: undefined })
    }

    // ---- slider handlers (live update) ----

    const setOpacity = (v: number) => {
        if (!currentPageId) return
        if (applyTarget === 'panel-fg') { if (selectedPanelId) updatePanel(selectedPanelId, { fgToneOpacity: v }); return }
        if (applyTarget === 'panel-bg') { if (selectedPanelId) updatePanel(selectedPanelId, { backgroundImageOpacity: v }); return }
        updatePage(currentPageId, { backgroundImageOpacity: v })
    }

    const setScale = (v: number) => {
        if (!selectedPanelId) return
        if (applyTarget === 'panel-fg') { updatePanel(selectedPanelId, { fgToneScale: v }); return }
        updatePanel(selectedPanelId, { backgroundImageScale: v })
    }

    const setRotation = (v: number) => {
        if (!selectedPanelId) return
        if (applyTarget === 'panel-fg') { updatePanel(selectedPanelId, { fgToneRotation: v }); return }
        updatePanel(selectedPanelId, { backgroundImageRotation: v })
    }

    // ---- custom library (project) ----

    const copyFromPaths = async (paths: string[]) => {
        if (!currentProjectPath || !window.electron) return
        for (const sourcePath of paths) {
            try {
                const rel = await window.electron.copyFileToProject(currentProjectPath, sourcePath, BACKGROUND_LIBRARY_ASSETS_SUBPATH)
                const base = sourcePath.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, '') || '背景'
                addBackgroundLibraryImage(base, rel)
            } catch (e) {
                console.error('BackgroundLibraryModal: copy failed', e)
                await showError('画像の取り込みに失敗しました')
                break
            }
        }
    }

    const handleAddLibFiles = async () => {
        if (!window.electron) return
        const src = await window.electron.selectFile()
        if (!src) return
        await copyFromPaths([src])
    }

    const handleLibDrop: React.DragEventHandler<HTMLDivElement> = async (e) => {
        e.preventDefault(); e.stopPropagation()
        if (!window.electron) return
        const paths: string[] = []
        for (const f of Array.from(e.dataTransfer.files)) {
            const p = window.electron.getPathForFile(f)
            if (p) paths.push(p)
        }
        if (paths.length) await copyFromPaths(paths)
    }

    // ---- custom tones (app-wide) ----

    const handleAddCustomTone = async () => {
        if (!window.electron) return
        const src = await window.electron.selectFile()
        if (!src) return
        const name = src.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, '') || 'トーン'
        try {
            await addCustomTone(src, name)
        } catch (e) {
            console.error('BackgroundLibraryModal: addCustomTone failed', e)
            await showError('カスタムトーンの追加に失敗しました')
        }
    }

    const handleCustomToneDrop: React.DragEventHandler<HTMLDivElement> = async (e) => {
        e.preventDefault(); e.stopPropagation()
        if (!window.electron) return
        for (const f of Array.from(e.dataTransfer.files)) {
            const p = window.electron.getPathForFile(f)
            if (!p) continue
            const name = p.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, '') || 'トーン'
            try {
                await addCustomTone(p, name)
            } catch (e) {
                await showError('カスタムトーンの追加に失敗しました')
                break
            }
        }
    }

    if (!isOpen) return null

    const isPanelTarget = applyTarget === 'panel-bg' || applyTarget === 'panel-fg'
    const currentOpacity = applyTarget === 'panel-fg' ? fgOpacity : bgOpacity
    const currentScale = applyTarget === 'panel-fg' ? fgScale : bgScale
    const currentRotation = applyTarget === 'panel-fg' ? fgRotation : bgRotation
    const hasCurrentTone = applyTarget === 'panel-fg' ? hasFgTone : hasBgTone

    const lightboxLayer = lightboxUrl != null ? (
        <div
            role="dialog" aria-modal="true" aria-label="プレビュー"
            className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/95 p-6"
            onClick={() => setLightboxUrl(null)}
        >
            <button type="button" className="absolute top-4 right-4 p-2 rounded-full bg-zinc-800 text-zinc-200 hover:bg-zinc-700" onClick={() => setLightboxUrl(null)}>
                <X size={22} />
            </button>
            <img src={lightboxUrl} alt="" className="max-w-full max-h-[85vh] object-contain rounded-lg border border-zinc-700" onClick={(e) => e.stopPropagation()} />
        </div>
    ) : null

    return (
        <>
            {lightboxLayer}
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[10001] flex items-center justify-center p-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">

                    {/* ヘッダー */}
                    <div className="p-4 border-b border-zinc-800 flex justify-between items-start gap-3 shrink-0">
                        <div>
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Layers className="text-sky-400" size={22} />
                                背景ライブラリ
                            </h2>
                            <p className="text-zinc-500 text-xs mt-1">
                                スクリーントーンやカスタム画像をページ・コマに適用できます。カスタムトーンはアプリ全体で共有されます。
                            </p>
                        </div>
                        <button type="button" onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 text-xl leading-none">&times;</button>
                    </div>

                    {/* 適用先 & 設定コントロール */}
                    <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/80 space-y-2 shrink-0">
                        {!currentPageId ? (
                            <p className="text-zinc-500 text-sm">ページを選択してください。</p>
                        ) : (
                            <>
                                <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                                    <span className="shrink-0 text-zinc-500">適用先:</span>
                                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                                        <input type="radio" name="bgApplyTarget" checked={applyTarget === 'page'} onChange={() => setApplyTarget('page')} className="accent-sky-500" />
                                        ページ全体
                                    </label>
                                    <label className={`inline-flex items-center gap-1.5 ${selectedPanel ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}>
                                        <input type="radio" name="bgApplyTarget" checked={applyTarget === 'panel-bg'} onChange={() => selectedPanel && setApplyTarget('panel-bg')} disabled={!selectedPanel} className="accent-sky-500" />
                                        コマ・背景（画像の下）
                                    </label>
                                    <label className={`inline-flex items-center gap-1.5 ${selectedPanel ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}>
                                        <input type="radio" name="bgApplyTarget" checked={applyTarget === 'panel-fg'} onChange={() => selectedPanel && setApplyTarget('panel-fg')} disabled={!selectedPanel} className="accent-sky-500" />
                                        コマ・前面（画像の上）
                                    </label>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <button type="button" onClick={clearTarget} disabled={isPanelTarget && !selectedPanel} className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40">
                                        トーンをクリア
                                    </button>
                                </div>

                                {/* 不透明度スライダー */}
                                {hasCurrentTone && (
                                    <label className="flex items-center gap-3 text-xs text-zinc-400">
                                        <span className="shrink-0 w-14">不透明度</span>
                                        <input type="range" min={0.05} max={1} step={0.05} value={currentOpacity} onChange={(e) => setOpacity(parseFloat(e.target.value))} className="flex-1 accent-sky-500" />
                                        <span className="font-mono w-8 text-right">{Math.round(currentOpacity * 100)}%</span>
                                    </label>
                                )}

                                {/* スケール・回転スライダー（コマ適用時のみ） */}
                                {isPanelTarget && hasCurrentTone && (
                                    <>
                                        <label className="flex items-center gap-3 text-xs text-zinc-400">
                                            <span className="shrink-0 w-14">スケール</span>
                                            <input type="range" min={0.1} max={4} step={0.05} value={currentScale} onChange={(e) => setScale(parseFloat(e.target.value))} className="flex-1 accent-sky-500" />
                                            <span className="font-mono w-12 text-right">{Math.round(currentScale * 100)}%</span>
                                        </label>
                                        <label className="flex items-center gap-3 text-xs text-zinc-400">
                                            <span className="shrink-0 w-14">回転</span>
                                            <input type="range" min={0} max={360} step={1} value={currentRotation} onChange={(e) => setRotation(parseFloat(e.target.value))} className="flex-1 accent-sky-500" />
                                            <span className="font-mono w-12 text-right">{Math.round(currentRotation)}°</span>
                                        </label>
                                    </>
                                )}
                            </>
                        )}
                    </div>

                    {/* タブ */}
                    <div className="flex border-b border-zinc-800 shrink-0">
                        {([
                            ['tones', `内蔵トーン（${SCREEN_TONE_CATALOG.length}種）`],
                            ['custom-tones', `カスタムトーン（${customTones.length}）`],
                            ['custom', 'マイ画像']
                        ] as [LibTab, string][]).map(([t, label]) => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setTab(t)}
                                className={`flex-1 py-2.5 text-xs font-bold truncate px-2 ${tab === t ? 'text-sky-300 border-b-2 border-sky-500 bg-zinc-800/50' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* タブコンテンツ */}
                    <div className="flex-1 min-h-0 overflow-y-auto p-4 manga-scrollbar">

                        {/* 内蔵トーン */}
                        {tab === 'tones' && (
                            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                                {SCREEN_TONE_CATALOG.map((tone) => (
                                    <div key={tone.id} className="flex flex-col gap-1">
                                        <button
                                            type="button"
                                            onClick={() => applyToTarget(`builtin://${tone.id}`, 'tile')}
                                            disabled={!currentPageId || (isPanelTarget && !selectedPanel)}
                                            className="aspect-square rounded-lg border border-zinc-700 overflow-hidden bg-white hover:border-sky-500 disabled:opacity-40"
                                            title={tone.name}
                                        >
                                            <img src={tone.dataUrl} alt="" className="w-full h-full object-cover" />
                                        </button>
                                        <button type="button" onClick={() => setLightboxUrl(tone.dataUrl)} className="text-[9px] text-zinc-500 truncate hover:text-zinc-300 text-left">
                                            {tone.name}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* カスタムトーン（アプリ全体） */}
                        {tab === 'custom-tones' && (
                            <div className="space-y-4">
                                <div className="flex justify-end">
                                    <button type="button" onClick={handleAddCustomTone} className="flex items-center gap-1.5 text-xs text-sky-300 hover:text-sky-200">
                                        <Plus size={14} />
                                        PNG を追加（アプリ全体）
                                    </button>
                                </div>
                                <div
                                    role="presentation"
                                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
                                    onDrop={handleCustomToneDrop}
                                    className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950/50 p-4 min-h-[80px] text-center text-zinc-600 text-xs"
                                >
                                    透過 PNG をここにドロップするか「PNG を追加」で登録。全プロジェクトで共有されます。
                                </div>
                                {customTones.length === 0 ? (
                                    <p className="text-zinc-600 text-sm text-center py-8">登録済みのカスタムトーンはありません。</p>
                                ) : (
                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                        {customTones.map((tone) => {
                                            const abs = customTonePaths[tone.id]
                                            const url = abs ? window.electron.pathToUrl(abs) : ''
                                            return (
                                                <div key={tone.id} className="relative group rounded-lg border border-zinc-700 overflow-hidden bg-[repeating-conic-gradient(#444_0%_25%,#222_0%_50%)] bg-[length:16px_16px] aspect-square flex flex-col">
                                                    {url ? (
                                                        <button type="button" className="flex-1 p-0 border-0 bg-transparent cursor-pointer" onClick={() => setLightboxUrl(url)}>
                                                            <img src={url} alt="" className="w-full h-full object-cover" />
                                                        </button>
                                                    ) : (
                                                        <div className="flex-1 flex items-center justify-center text-[10px] text-zinc-500 p-2 text-center">{tone.id}</div>
                                                    )}
                                                    <div className="p-1.5 bg-zinc-900/90 border-t border-zinc-700 flex gap-1 items-center">
                                                        <span className="flex-1 text-[10px] text-zinc-300 truncate">{tone.name}</span>
                                                        <button
                                                            type="button"
                                                            disabled={!currentPageId || (isPanelTarget && !selectedPanel)}
                                                            onClick={() => applyToTarget(`custom-tone://${tone.id}`, 'tile')}
                                                            className="text-[10px] px-1.5 py-0.5 rounded bg-sky-900/50 text-sky-200 hover:bg-sky-800/50 disabled:opacity-40"
                                                        >
                                                            適用
                                                        </button>
                                                        <button type="button" onClick={() => removeCustomTone(tone.id)} className="p-1 rounded bg-zinc-800 text-zinc-400 hover:text-red-400" title="削除">
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* マイ画像（プロジェクト固有） */}
                        {tab === 'custom' && (
                            <div className="space-y-4">
                                <div className="flex justify-end">
                                    <button type="button" onClick={handleAddLibFiles} className="flex items-center gap-1.5 text-xs text-sky-300 hover:text-sky-200">
                                        <Plus size={14} />
                                        ファイルから追加
                                    </button>
                                </div>
                                <div
                                    role="presentation"
                                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
                                    onDrop={handleLibDrop}
                                    className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950/50 p-6 min-h-[120px] text-center text-zinc-600 text-sm"
                                >
                                    画像をここにドロップするか「ファイルから追加」で登録。このプロジェクト専用です。
                                </div>
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                    {backgroundLibrary.map((item) => {
                                        const url = currentProjectPath && window.electron
                                            ? window.electron.pathToUrl(window.electron.resolveAssetPath(currentProjectPath, item.relativePath))
                                            : ''
                                        return (
                                            <div key={item.id} className="relative group rounded-lg border border-zinc-700 overflow-hidden bg-zinc-800 aspect-square flex flex-col">
                                                {url ? (
                                                    <button type="button" className="flex-1 min-h-0 p-0 border-0 bg-transparent cursor-pointer" onClick={() => setLightboxUrl(url)}>
                                                        <img src={url} alt="" className="w-full h-full object-cover" />
                                                    </button>
                                                ) : (
                                                    <div className="flex-1 flex items-center p-2 text-[10px] text-zinc-500 break-all">{item.relativePath}</div>
                                                )}
                                                <div className="p-1.5 bg-zinc-900/90 border-t border-zinc-700 flex flex-col gap-1">
                                                    <input
                                                        type="text"
                                                        value={item.name}
                                                        onChange={(e) => updateBackgroundLibraryImage(item.id, { name: e.target.value })}
                                                        className="w-full bg-zinc-800 border border-zinc-600 rounded px-1.5 py-0.5 text-[10px] text-white"
                                                    />
                                                    <div className="flex gap-1">
                                                        <button
                                                            type="button"
                                                            disabled={!currentPageId || (isPanelTarget && !selectedPanel)}
                                                            onClick={() => applyToTarget(item.relativePath, 'stretch')}
                                                            className="flex-1 text-[10px] py-1 rounded bg-sky-900/50 text-sky-200 hover:bg-sky-800/50 disabled:opacity-40"
                                                        >
                                                            適用
                                                        </button>
                                                        <button type="button" onClick={() => removeBackgroundLibraryImage(item.id)} className="p-1 rounded bg-zinc-800 text-zinc-400 hover:text-red-400" title="削除">
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    )
}
