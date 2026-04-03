import React, { useEffect, useRef, useState } from 'react'
import { Plus, Trash2, X, Layers } from 'lucide-react'
import { useMangaStore } from '../store/useMangaStore'
import { BACKGROUND_LIBRARY_ASSETS_SUBPATH } from '../utils/backgroundLibrary'
import { SCREEN_TONE_CATALOG } from '../utils/screenToneCatalog'
import { showError } from '../utils/dialogs'

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

    const [tab, setTab] = useState<'tones' | 'custom'>('tones')
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
    const [applyTarget, setApplyTarget] = useState<'page' | 'panel'>('page')
    const prevIsOpen = useRef(false)

    const currentPage = pages.find((p) => p.id === currentPageId)
    const selectedPanel = currentPage?.panels.find((p) => p.id === selectedPanelId) ?? null

    useEffect(() => {
        if (isOpen && !prevIsOpen.current) {
            setApplyTarget(selectedPanel ? 'panel' : 'page')
        }
        prevIsOpen.current = isOpen
    }, [isOpen, selectedPanel])

    useEffect(() => {
        if (!isOpen) setLightboxUrl(null)
    }, [isOpen])

    useEffect(() => {
        if (!lightboxUrl) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setLightboxUrl(null)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [lightboxUrl])

    const applyBuiltin = (toneId: string) => {
        if (!currentPageId) return
        if (applyTarget === 'panel') {
            if (!selectedPanel || !selectedPanelId) return
            updatePanel(selectedPanelId, {
                backgroundImagePath: `builtin://${toneId}`,
                backgroundImageFit: 'tile',
                backgroundImageOpacity: 1
            })
            return
        }
        updatePage(currentPageId, {
            backgroundImagePath: `builtin://${toneId}`,
            backgroundImageFit: 'tile',
            backgroundImageOpacity: 1
        })
    }

    const applyCustomPath = (relativePath: string) => {
        if (!currentPageId) return
        if (applyTarget === 'panel') {
            if (!selectedPanel || !selectedPanelId) return
            updatePanel(selectedPanelId, {
                backgroundImagePath: relativePath,
                backgroundImageFit: 'stretch',
                backgroundImageOpacity: 1
            })
            return
        }
        updatePage(currentPageId, {
            backgroundImagePath: relativePath,
            backgroundImageFit: 'stretch',
            backgroundImageOpacity: 1
        })
    }

    const clearTargetBackground = () => {
        if (!currentPageId) return
        if (applyTarget === 'panel') {
            if (!selectedPanel || !selectedPanelId) return
            updatePanel(selectedPanelId, {
                backgroundImagePath: undefined,
                backgroundImageFit: undefined,
                backgroundImageOpacity: undefined
            })
            return
        }
        updatePage(currentPageId, {
            backgroundImagePath: undefined,
            backgroundImageFit: undefined,
            backgroundImageOpacity: undefined
        })
    }

    const setTargetBgOpacity = (v: number) => {
        if (!currentPageId) return
        if (applyTarget === 'panel') {
            if (!selectedPanelId || !selectedPanel?.backgroundImagePath) return
            updatePanel(selectedPanelId, { backgroundImageOpacity: v })
            return
        }
        if (!currentPage?.backgroundImagePath) return
        updatePage(currentPageId, { backgroundImageOpacity: v })
    }

    const copyFromPaths = async (paths: string[]) => {
        if (!currentProjectPath || !window.electron) return
        for (const sourcePath of paths) {
            try {
                const rel = await window.electron.copyFileToProject(
                    currentProjectPath,
                    sourcePath,
                    BACKGROUND_LIBRARY_ASSETS_SUBPATH
                )
                const base = sourcePath.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, '') || '背景'
                addBackgroundLibraryImage(base, rel)
            } catch (e) {
                console.error('BackgroundLibraryModal: copy failed', e)
                await showError('画像の取り込みに失敗しました')
                break
            }
        }
    }

    const handleAddFiles = async () => {
        if (!window.electron) return
        const src = await window.electron.selectFile()
        if (!src) return
        await copyFromPaths([src])
    }

    const handleDrop: React.DragEventHandler<HTMLDivElement> = async (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!window.electron) return
        const paths: string[] = []
        for (const f of Array.from(e.dataTransfer.files)) {
            const p = window.electron.getPathForFile(f)
            if (p) paths.push(p)
        }
        if (paths.length === 0) return
        await copyFromPaths(paths)
    }

    if (!isOpen) return null

    const lightboxLayer =
        lightboxUrl != null ? (
            <div
                role="dialog"
                aria-modal="true"
                aria-label="プレビュー"
                className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/95 p-6"
                onClick={() => setLightboxUrl(null)}
            >
                <button
                    type="button"
                    className="absolute top-4 right-4 p-2 rounded-full bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                    onClick={() => setLightboxUrl(null)}
                >
                    <X size={22} />
                </button>
                <img
                    src={lightboxUrl}
                    alt=""
                    className="max-w-full max-h-[85vh] object-contain rounded-lg border border-zinc-700"
                    onClick={(ev) => ev.stopPropagation()}
                />
            </div>
        ) : null

    return (
        <>
            {lightboxLayer}
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[10001] flex items-center justify-center p-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                    <div className="p-4 border-b border-zinc-800 flex justify-between items-start gap-3 shrink-0">
                        <div>
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Layers className="text-sky-400" size={22} />
                                背景ライブラリ
                            </h2>
                            <p className="text-zinc-500 text-xs mt-1">
                                内蔵スクリーントーンと自作画像を管理します。ページ全体の下地のほか、コマ選択中はそのコマの人物画像の下にトーンを重ねられます。
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 text-xl leading-none"
                        >
                            &times;
                        </button>
                    </div>

                    <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/80 space-y-2 shrink-0">
                        {!currentPageId ? (
                            <p className="text-zinc-500 text-sm">ページを選択してください。</p>
                        ) : (
                            <>
                                <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                                    <span className="shrink-0 text-zinc-500">適用先:</span>
                                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="bgApplyTarget"
                                            checked={applyTarget === 'page'}
                                            onChange={() => setApplyTarget('page')}
                                            className="accent-sky-500"
                                        />
                                        ページ全体
                                    </label>
                                    <label
                                        className={`inline-flex items-center gap-1.5 ${selectedPanel ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}
                                    >
                                        <input
                                            type="radio"
                                            name="bgApplyTarget"
                                            checked={applyTarget === 'panel'}
                                            onChange={() => selectedPanel && setApplyTarget('panel')}
                                            disabled={!selectedPanel}
                                            className="accent-sky-500"
                                        />
                                        選択中のコマ（画像の下）
                                    </label>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={clearTargetBackground}
                                        disabled={applyTarget === 'panel' && !selectedPanel}
                                        className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40"
                                    >
                                        {applyTarget === 'page' ? 'ページのトーンをクリア' : 'コマのトーンをクリア'}
                                    </button>
                                </div>
                                {applyTarget === 'page' && currentPage?.backgroundImagePath ? (
                                    <label className="flex items-center gap-3 text-xs text-zinc-400">
                                        <span className="shrink-0 w-24">ページの濃さ</span>
                                        <input
                                            type="range"
                                            min={0.15}
                                            max={1}
                                            step={0.05}
                                            value={currentPage.backgroundImageOpacity ?? 1}
                                            onChange={(e) => setTargetBgOpacity(parseFloat(e.target.value))}
                                            className="flex-1 accent-sky-500"
                                        />
                                        <span className="font-mono w-8">
                                            {Math.round((currentPage.backgroundImageOpacity ?? 1) * 100)}%
                                        </span>
                                    </label>
                                ) : null}
                                {applyTarget === 'panel' && selectedPanel?.backgroundImagePath ? (
                                    <label className="flex items-center gap-3 text-xs text-zinc-400">
                                        <span className="shrink-0 w-24">コマの濃さ</span>
                                        <input
                                            type="range"
                                            min={0.15}
                                            max={1}
                                            step={0.05}
                                            value={selectedPanel.backgroundImageOpacity ?? 1}
                                            onChange={(e) => setTargetBgOpacity(parseFloat(e.target.value))}
                                            className="flex-1 accent-sky-500"
                                        />
                                        <span className="font-mono w-8">
                                            {Math.round((selectedPanel.backgroundImageOpacity ?? 1) * 100)}%
                                        </span>
                                    </label>
                                ) : null}
                            </>
                        )}
                    </div>

                    <div className="flex border-b border-zinc-800 shrink-0">
                        <button
                            type="button"
                            onClick={() => setTab('tones')}
                            className={`flex-1 py-2.5 text-sm font-bold ${
                                tab === 'tones'
                                    ? 'text-sky-300 border-b-2 border-sky-500 bg-zinc-800/50'
                                    : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                        >
                            スクリーントーン（内蔵 {SCREEN_TONE_CATALOG.length} 種）
                        </button>
                        <button
                            type="button"
                            onClick={() => setTab('custom')}
                            className={`flex-1 py-2.5 text-sm font-bold ${
                                tab === 'custom'
                                    ? 'text-sky-300 border-b-2 border-sky-500 bg-zinc-800/50'
                                    : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                        >
                            マイ画像
                        </button>
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto p-4 manga-scrollbar">
                        {tab === 'tones' ? (
                            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                                {SCREEN_TONE_CATALOG.map((tone) => (
                                    <div key={tone.id} className="flex flex-col gap-1">
                                        <button
                                            type="button"
                                            onClick={() => applyBuiltin(tone.id)}
                                            disabled={!currentPageId || (applyTarget === 'panel' && !selectedPanel)}
                                            className="aspect-square rounded-lg border border-zinc-700 overflow-hidden bg-white hover:border-sky-500 disabled:opacity-40"
                                            title={tone.name}
                                        >
                                            <img
                                                src={tone.dataUrl}
                                                alt=""
                                                className="w-full h-full object-cover"
                                            />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setLightboxUrl(tone.dataUrl)}
                                            className="text-[9px] text-zinc-500 truncate hover:text-zinc-300 text-left"
                                        >
                                            {tone.name}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={handleAddFiles}
                                        className="flex items-center gap-1.5 text-xs text-sky-300 hover:text-sky-200"
                                    >
                                        <Plus size={14} />
                                        ファイルから追加
                                    </button>
                                </div>
                                <div
                                    role="presentation"
                                    onDragOver={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                    }}
                                    onDrop={handleDrop}
                                    className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950/50 p-6 min-h-[120px] text-center text-zinc-600 text-sm"
                                >
                                    画像をここにドロップするか「ファイルから追加」で登録。上部で適用先（ページ／コマ）を選び、一覧から適用してください。
                                </div>
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                    {backgroundLibrary.map((item) => {
                                        const url =
                                            currentProjectPath && window.electron
                                                ? window.electron.pathToUrl(
                                                      window.electron.resolveAssetPath(
                                                          currentProjectPath,
                                                          item.relativePath
                                                      )
                                                  )
                                                : ''
                                        return (
                                            <div
                                                key={item.id}
                                                className="relative group rounded-lg border border-zinc-700 overflow-hidden bg-zinc-800 aspect-square flex flex-col"
                                            >
                                                {url ? (
                                                    <button
                                                        type="button"
                                                        className="flex-1 min-h-0 p-0 border-0 bg-transparent cursor-pointer"
                                                        onClick={() => setLightboxUrl(url)}
                                                    >
                                                        <img
                                                            src={url}
                                                            alt=""
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </button>
                                                ) : (
                                                    <div className="flex-1 flex items-center p-2 text-[10px] text-zinc-500 break-all">
                                                        {item.relativePath}
                                                    </div>
                                                )}
                                                <div className="p-1.5 bg-zinc-900/90 border-t border-zinc-700 flex flex-col gap-1">
                                                    <input
                                                        type="text"
                                                        value={item.name}
                                                        onChange={(e) =>
                                                            updateBackgroundLibraryImage(item.id, {
                                                                name: e.target.value
                                                            })
                                                        }
                                                        className="w-full bg-zinc-800 border border-zinc-600 rounded px-1.5 py-0.5 text-[10px] text-white"
                                                    />
                                                    <div className="flex gap-1">
                                                        <button
                                                            type="button"
                                                            disabled={
                                                                !currentPageId ||
                                                                (applyTarget === 'panel' && !selectedPanel)
                                                            }
                                                            onClick={() => applyCustomPath(item.relativePath)}
                                                            className="flex-1 text-[10px] py-1 rounded bg-sky-900/50 text-sky-200 hover:bg-sky-800/50 disabled:opacity-40"
                                                        >
                                                            {applyTarget === 'page' ? 'ページに適用' : 'コマに適用'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeBackgroundLibraryImage(item.id)}
                                                            className="p-1 rounded bg-zinc-800 text-zinc-400 hover:text-red-400"
                                                            title="削除"
                                                        >
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
