import React, { useEffect, useState } from 'react'
import { Users, Plus, Trash2, ImagePlus, Wand2, Loader2, X, Scissors } from 'lucide-react'
import { useMangaStore } from '../store/useMangaStore'
import { referenceAssetsSubdir } from '../utils/referenceCharacters'
import { showError } from '../utils/dialogs'
import { MagicWandEditorModal } from './MagicWandEditorModal'

interface ReferenceCharactersModalProps {
    isOpen: boolean
    onClose: () => void
}

export const ReferenceCharactersModal: React.FC<ReferenceCharactersModalProps> = ({ isOpen, onClose }) => {
    const currentProjectPath = useMangaStore((s) => s.currentProjectPath)
    const referenceCharacters = useMangaStore((s) => s.referenceCharacters)
    const addReferenceCharacter = useMangaStore((s) => s.addReferenceCharacter)
    const removeReferenceCharacter = useMangaStore((s) => s.removeReferenceCharacter)
    const updateReferenceCharacter = useMangaStore((s) => s.updateReferenceCharacter)
    const registerReferenceCharacterImage = useMangaStore((s) => s.registerReferenceCharacterImage)
    const removeReferenceCharacterImage = useMangaStore((s) => s.removeReferenceCharacterImage)

    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [rembgBusyImageId, setRembgBusyImageId] = useState<string | null>(null)
    const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null)
    const [wandEditor, setWandEditor] = useState<{
        url: string
        characterId: string
        assetsSubPath: string
        baseName: string
    } | null>(null)

    const selected = referenceCharacters.find((c) => c.id === selectedId) ?? null

    useEffect(() => {
        if (!isOpen) return
        if (referenceCharacters.length === 0) {
            setSelectedId(null)
            return
        }
        if (!selectedId || !referenceCharacters.some((c) => c.id === selectedId)) {
            setSelectedId(referenceCharacters[0].id)
        }
    }, [isOpen, referenceCharacters, selectedId])

    useEffect(() => {
        if (!isOpen) {
            setLightbox(null)
        }
    }, [isOpen])

    useEffect(() => {
        if (!lightbox) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setLightbox(null)
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [lightbox])

    const copyFromPaths = async (characterId: string, paths: string[]) => {
        if (!currentProjectPath || !window.electron) return
        const sub = referenceAssetsSubdir(characterId)
        for (const sourcePath of paths) {
            try {
                const rel = await window.electron.copyFileToProject(currentProjectPath, sourcePath, sub)
                registerReferenceCharacterImage(characterId, rel)
            } catch (e) {
                console.error('ReferenceCharactersModal: copy failed', e)
                await showError('画像の取り込みに失敗しました')
                break
            }
        }
    }

    const handleAddImages = async () => {
        if (!selectedId || !window.electron) return
        const src = await window.electron.selectFile()
        if (!src) return
        await copyFromPaths(selectedId, [src])
    }

    const handleDrop: React.DragEventHandler<HTMLDivElement> = async (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!selectedId || !window.electron) return
        const paths: string[] = []
        for (const f of Array.from(e.dataTransfer.files)) {
            const p = window.electron.getPathForFile(f)
            if (p) paths.push(p)
        }
        if (paths.length === 0) return
        await copyFromPaths(selectedId, paths)
    }

    const handleDragStartImage = (relativePath: string) => {
        if (!currentProjectPath || !window.electron) return
        const abs = window.electron.resolveAssetPath(currentProjectPath, relativePath)
        if (abs) {
            window.electron.startDragFile(abs)
        }
    }

    const handleRembg = async (characterId: string, imageId: string, relativePath: string) => {
        if (!currentProjectPath || !window.electron || rembgBusyImageId) return
        setRembgBusyImageId(imageId)
        try {
            const { relativePath: outRel } = await window.electron.rembgRemoveBackground(
                currentProjectPath,
                relativePath
            )
            registerReferenceCharacterImage(characterId, outRel)
        } catch (e: unknown) {
            const msg =
                e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string'
                    ? (e as { message: string }).message
                    : '背景除去に失敗しました（rembg が PATH にあるか確認してください）'
            console.error('ReferenceCharactersModal: rembg', e)
            await showError(msg)
        } finally {
            setRembgBusyImageId(null)
        }
    }

    const handleOpenWandEditor = (characterId: string, imageId: string, relativePath: string, url: string) => {
        const sub = referenceAssetsSubdir(characterId)
        const base = relativePath.split('/').pop()?.replace(/\.[^.]+$/, '') ?? imageId
        setWandEditor({ url, characterId, assetsSubPath: sub, baseName: base })
    }

    const handleWandSave = async (dataUrl: string) => {
        if (!wandEditor || !currentProjectPath || !window.electron) return
        const { relativePath } = await window.electron.saveWandPng(
            currentProjectPath,
            wandEditor.assetsSubPath,
            wandEditor.baseName,
            dataUrl
        )
        registerReferenceCharacterImage(wandEditor.characterId, relativePath)
        setWandEditor(null)
    }

    if (!isOpen) return null

    const lightboxLayer =
        lightbox != null ? (
            <div
                role="dialog"
                aria-modal="true"
                aria-label="画像プレビュー"
                className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-black/95 p-4 sm:p-8"
                onClick={() => setLightbox(null)}
            >
                <button
                    type="button"
                    onClick={() => setLightbox(null)}
                    className="absolute top-4 right-4 z-10 p-2 rounded-full bg-zinc-800/90 text-zinc-200 hover:bg-zinc-700 hover:text-white border border-zinc-600"
                    title="閉じる (Esc)"
                >
                    <X size={22} />
                </button>
                <div
                    className="relative max-w-full max-h-[85vh] flex flex-col items-center gap-3"
                    onClick={(e) => e.stopPropagation()}
                >
                    <img
                        src={lightbox.url}
                        alt=""
                        className="max-w-full max-h-[80vh] w-auto h-auto object-contain rounded-lg shadow-2xl border border-zinc-700"
                    />
                    <p className="text-zinc-500 text-xs font-mono max-w-full truncate px-2" title={lightbox.label}>
                        {lightbox.label}
                    </p>
                </div>
                <p className="absolute bottom-4 text-zinc-600 text-xs">クリックまたは Esc で閉じる</p>
            </div>
        ) : null

    return (
        <>
            {wandEditor && (
                <MagicWandEditorModal
                    isOpen={true}
                    onClose={() => setWandEditor(null)}
                    imageUrl={wandEditor.url}
                    onSave={handleWandSave}
                />
            )}
            {lightboxLayer}
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9998] flex items-center justify-center p-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                    <div className="p-5 border-b border-zinc-800 flex justify-between items-center shrink-0">
                        <div>
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Users className="text-violet-400" size={22} />
                                参照キャラクター
                            </h2>
                            <p className="text-zinc-500 text-xs mt-1">
                                人物参照用画像とプロンプトをキャラ単位で管理します（manga.json に保存）。
                                背景除去は rembg（既定モデル isnet-anime）を CLI 経由で実行します。
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 transition-colors text-xl leading-none"
                        >
                            &times;
                        </button>
                    </div>

                    <div className="flex-1 min-h-0 flex">
                        <div className="w-52 shrink-0 border-r border-zinc-800 flex flex-col bg-zinc-900/80">
                            <button
                                type="button"
                                onClick={() => {
                                    const id = addReferenceCharacter()
                                    setSelectedId(id)
                                }}
                                className="m-3 flex items-center justify-center gap-2 py-2 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-200 text-sm font-bold"
                            >
                                <Plus size={16} />
                                キャラを追加
                            </button>
                            <div className="flex-1 overflow-y-auto manga-scrollbar px-2 pb-3 space-y-1">
                                {referenceCharacters.map((c) => (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => setSelectedId(c.id)}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors ${
                                            selectedId === c.id
                                                ? 'bg-zinc-800 text-white border border-zinc-700'
                                                : 'text-zinc-400 hover:bg-zinc-800/60 border border-transparent'
                                        }`}
                                    >
                                        {c.name || '無題'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col min-h-0">
                            {!selected ? (
                                <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm p-8">
                                    左の「キャラを追加」から登録してください。
                                </div>
                            ) : (
                                <>
                                    <div className="p-4 border-b border-zinc-800 space-y-3 shrink-0">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={selected.name}
                                                onChange={(e) =>
                                                    updateReferenceCharacter(selected.id, { name: e.target.value })
                                                }
                                                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white"
                                                placeholder="キャラ名"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeReferenceCharacter(selected.id)}
                                                className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-950/30"
                                                title="このキャラを削除"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <label className="block">
                                                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                                                    Positive
                                                </span>
                                                <textarea
                                                    value={selected.positivePrompt}
                                                    onChange={(e) =>
                                                        updateReferenceCharacter(selected.id, {
                                                            positivePrompt: e.target.value
                                                        })
                                                    }
                                                    rows={4}
                                                    className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-200 resize-y min-h-[80px]"
                                                    placeholder="ポジティブプロンプト"
                                                />
                                            </label>
                                            <label className="block">
                                                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                                                    Negative
                                                </span>
                                                <textarea
                                                    value={selected.negativePrompt}
                                                    onChange={(e) =>
                                                        updateReferenceCharacter(selected.id, {
                                                            negativePrompt: e.target.value
                                                        })
                                                    }
                                                    rows={4}
                                                    className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-200 resize-y min-h-[80px]"
                                                    placeholder="ネガティブプロンプト"
                                                />
                                            </label>
                                        </div>
                                    </div>

                                    <div className="flex-1 min-h-0 overflow-y-auto p-4 manga-scrollbar">
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                                                画像
                                            </h3>
                                            <button
                                                type="button"
                                                onClick={handleAddImages}
                                                className="flex items-center gap-1.5 text-xs text-violet-300 hover:text-violet-200"
                                            >
                                                <ImagePlus size={14} />
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
                                            className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950/50 p-4 min-h-[200px]"
                                        >
                                            {selected.images.length === 0 ? (
                                                <p className="text-center text-zinc-600 text-sm py-12">
                                                    ここに画像をドラッグ＆ドロップするか、「ファイルから追加」で取り込みます。
                                                    <br />
                                                    <span className="text-zinc-700 text-xs mt-2 inline-block">
                                                        画像をクリックで拡大表示。サムネを外にドラッグでエクスポート。左下の杖で背景除去（rembg）。ハサミでマジックワンド手動編集。
                                                    </span>
                                                </p>
                                            ) : (
                                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                                    {selected.images.map((im) => {
                                                        const url = currentProjectPath
                                                            ? window.electron.pathToUrl(
                                                                  window.electron.resolveAssetPath(
                                                                      currentProjectPath,
                                                                      im.relativePath
                                                                  )
                                                              )
                                                            : ''
                                                        const busy = rembgBusyImageId === im.id
                                                        return (
                                                            <div
                                                                key={im.id}
                                                                className="relative group rounded-lg border border-zinc-700 overflow-hidden bg-zinc-800 aspect-square"
                                                            >
                                                                {url ? (
                                                                    <button
                                                                        type="button"
                                                                        draggable
                                                                        className="block w-full h-full p-0 border-0 bg-transparent cursor-pointer text-left"
                                                                        onClick={() =>
                                                                            setLightbox({ url, label: im.relativePath })
                                                                        }
                                                                        onDragStart={(e) => {
                                                                            e.preventDefault()
                                                                            handleDragStartImage(im.relativePath)
                                                                        }}
                                                                        title="クリックで拡大表示・ドラッグでファイルとしてエクスポート"
                                                                    >
                                                                        <img
                                                                            src={url}
                                                                            alt=""
                                                                            className={`w-full h-full object-cover pointer-events-none select-none ${busy ? 'opacity-50' : ''}`}
                                                                        />
                                                                    </button>
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs p-2 text-center">
                                                                        {im.relativePath}
                                                                    </div>
                                                                )}
                                                                {busy ? (
                                                                    <div
                                                                        role="status"
                                                                        aria-live="polite"
                                                                        aria-busy="true"
                                                                        className="absolute inset-0 z-[40] flex flex-col items-center justify-center gap-2 bg-black/55 backdrop-blur-[2px]"
                                                                    >
                                                                        <Loader2
                                                                            className="text-amber-300 animate-spin"
                                                                            size={28}
                                                                            strokeWidth={2.5}
                                                                            aria-hidden
                                                                        />
                                                                        <span className="text-[10px] font-bold text-amber-100/95 tracking-wide uppercase">
                                                                            背景除去中…
                                                                        </span>
                                                                    </div>
                                                                ) : null}
                                                                <button
                                                                    type="button"
                                                                    disabled={!!rembgBusyImageId}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        handleRembg(selected.id, im.id, im.relativePath)
                                                                    }}
                                                                    className="absolute bottom-1 left-1 z-30 p-1 rounded bg-black/60 text-amber-200/90 opacity-0 group-hover:opacity-100 hover:text-amber-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                                                    title="背景除去（rembg / isnet-anime）"
                                                                >
                                                                    <Wand2 size={14} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        if (url) handleOpenWandEditor(selected.id, im.id, im.relativePath, url)
                                                                    }}
                                                                    className="absolute bottom-1 left-8 z-30 p-1 rounded bg-black/60 text-sky-300/90 opacity-0 group-hover:opacity-100 hover:text-sky-100"
                                                                    title="マジックワンドで手動編集"
                                                                >
                                                                    <Scissors size={14} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    disabled={!!rembgBusyImageId}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        removeReferenceCharacterImage(
                                                                            selected.id,
                                                                            im.id
                                                                        )
                                                                    }}
                                                                    className="absolute top-1 right-1 z-30 p-1 rounded bg-black/60 text-zinc-300 opacity-0 group-hover:opacity-100 hover:text-red-400 disabled:opacity-30"
                                                                    title="削除"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
