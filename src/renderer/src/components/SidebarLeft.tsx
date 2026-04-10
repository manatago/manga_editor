import React, { useState } from 'react'
import { Plus, FolderOpen, Download, FileText, ChevronUp, ChevronDown, Plus as PlusIcon, Layout, Trash2, Eraser, ChevronLeft, Users, Layers, ImagePlus, Grid2x2, Eye, EyeOff, Pencil } from 'lucide-react'
import { ReferenceCharactersModal } from './ReferenceCharactersModal'
import { BackgroundLibraryModal } from './BackgroundLibraryModal'
import { ImageCompositorModal } from './ImageCompositorModal'
import { useMangaStore } from '../store/useMangaStore'
import type { Page, Panel, MosaicType } from '../store/types'
import { confirmMessage } from '../utils/dialogs'

interface SidebarLeftProps {
    onExportPNG: () => void;
    onExportAllPagesPNG: () => void;
    onExportText: () => void;
    onOpenTemplateModal: () => void;
    handleCreateNew: () => void;
    handleOpenProject: () => void;
    currentProjectPath: string | null;
    currentPageId: string | null;
    pages: Page[];
    selectPage: (id: string) => void;
    movePage: (id: string, direction: 'up' | 'down') => void;
    removePage: (id: string) => void;
    addPage: (panels?: Omit<Panel, 'id'>[]) => void;
    onCollapse?: () => void;
}

const SidebarLeft: React.FC<SidebarLeftProps> = ({
    onExportPNG,
    onExportAllPagesPNG,
    onExportText,
    onOpenTemplateModal,
    handleCreateNew,
    handleOpenProject,
    currentProjectPath,
    // currentPageId, // Removed from props
    // pages, // Removed from props
    // selectPage, // Removed from props
    // movePage, // Removed from props
    // removePage, // Removed from props
    // addPage // Removed from props
    onCollapse
}) => {
    const {
        pages,
        currentPageId,
        selectPage,
        addPage,
        movePage,
        removePage,
        cleanupAssets,
        mosaicType,
        mosaicVisible,
        isMosaicMode,
        selectedMosaicId,
        setMosaicType,
        setMosaicVisible,
        setIsMosaicMode,
        updateMosaicType
    } = useMangaStore()

    const currentPage = pages.find((p) => p.id === currentPageId)
    const selectedMosaic = currentPage?.mosaics?.find((m) => m.id === selectedMosaicId)
    const activeType = selectedMosaic ? selectedMosaic.type : mosaicType

    const [referenceModalOpen, setReferenceModalOpen] = useState(false)
    const [backgroundLibraryOpen, setBackgroundLibraryOpen] = useState(false)
    const [compositorOpen, setCompositorOpen] = useState(false)
    const [toolsOpen, setToolsOpen] = useState(false)

    return (
        <div className="h-full flex flex-col min-h-0 bg-zinc-900">
            <div className="p-3 sm:p-4 border-b border-zinc-800 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center shrink-0">
                        <span className="text-white font-bold text-xs">M</span>
                    </div>
                    <h1 className="font-bold text-white tracking-tight truncate text-sm sm:text-base">漫画野郎</h1>
                </div>
                {onCollapse && (
                    <button
                        type="button"
                        onClick={onCollapse}
                        className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 shrink-0"
                        title="メニューを隠す（狭い画面向け）"
                    >
                        <ChevronLeft size={18} />
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-6 manga-scrollbar">
                {!currentProjectPath ? (
                    <div className="space-y-2">
                        <button onClick={handleCreateNew} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white group">
                            <Plus size={18} className="group-hover:text-blue-500 transition-colors" />
                            <span className="text-sm font-medium">新規プロジェクト</span>
                        </button>
                        <button onClick={handleOpenProject} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white group">
                            <FolderOpen size={18} className="group-hover:text-blue-500 transition-colors" />
                            <span className="text-sm font-medium">プロジェクトを開く</span>
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* ツールメニュー（トグル） */}
                        <div>
                            <button
                                type="button"
                                onClick={() => setToolsOpen((v) => !v)}
                                className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors text-zinc-300 hover:text-white text-sm font-bold"
                            >
                                <span>ツール</span>
                                <ChevronDown size={15} className={`transition-transform duration-200 ${toolsOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {toolsOpen && (
                                <div className="mt-2 space-y-1.5 px-1">
                                    <button
                                        onClick={onExportPNG}
                                        disabled={!currentPageId}
                                        className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-600/20 transition-colors text-emerald-400 hover:text-emerald-300 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Download size={15} />
                                        <span>PNG出力（現在ページ）</span>
                                    </button>
                                    <button
                                        onClick={onExportAllPagesPNG}
                                        disabled={!currentPageId || pages.length === 0}
                                        className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors text-zinc-300 hover:text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Download size={15} />
                                        <span>全ページ一括 PNG</span>
                                    </button>
                                    <button
                                        onClick={onExportText}
                                        disabled={pages.length === 0}
                                        className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors text-zinc-300 hover:text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <FileText size={15} />
                                        <span>セリフ一覧 TXT</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setReferenceModalOpen(true)}
                                        className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-violet-950/40 hover:bg-violet-900/40 border border-violet-800/40 transition-colors text-violet-200 hover:text-violet-100 text-xs font-bold"
                                    >
                                        <Users size={15} />
                                        <span>参照キャラクター</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setBackgroundLibraryOpen(true)}
                                        className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-sky-950/40 hover:bg-sky-900/40 border border-sky-800/40 transition-colors text-sky-200 hover:text-sky-100 text-xs font-bold"
                                    >
                                        <Layers size={15} />
                                        <span>背景ライブラリ</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCompositorOpen(true)}
                                        className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-pink-950/40 hover:bg-pink-900/40 border border-pink-900/40 transition-colors text-pink-100 hover:text-pink-50 text-xs font-bold"
                                    >
                                        <ImagePlus size={15} />
                                        <span>背景＋人物の合成</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Mosaic controls */}
                        <div className="border-t border-zinc-800 pt-2 space-y-2">
                                <div className="flex items-center justify-between px-1">
                                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">モザイク</span>
                                    <button
                                        type="button"
                                        onClick={() => setMosaicVisible(!mosaicVisible)}
                                        className="p-1 rounded text-zinc-500 hover:text-zinc-200 transition-colors"
                                        title={mosaicVisible ? '非表示にする' : '表示する'}
                                    >
                                        {mosaicVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsMosaicMode(!isMosaicMode)}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors font-bold text-sm ${
                                        isMosaicMode
                                            ? 'bg-blue-600/30 border-blue-500/50 text-blue-200'
                                            : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
                                    }`}
                                >
                                    <Pencil size={16} />
                                    <span>{isMosaicMode ? '描画中…（クリックで終了）' : 'モザイク描画モード'}</span>
                                </button>
                                {/* Type selector */}
                                {selectedMosaic && (
                                    <div className="text-[10px] text-zinc-500 px-1">選択中の領域のタイプ</div>
                                )}
                                <div className="grid grid-cols-4 gap-1">
                                    {(['pixel-12', 'frosted', 'white-blur', 'none'] as MosaicType[]).map((t) => {
                                        const labels: Record<MosaicType, string> = {
                                            'pixel-12': 'px12',
                                            'frosted': '曇',
                                            'white-blur': '白',
                                            'none': '無'
                                        }
                                        return (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() => {
                                                    if (selectedMosaic) {
                                                        updateMosaicType(selectedMosaic.id, t)
                                                    } else {
                                                        setMosaicType(t)
                                                    }
                                                }}
                                                className={`py-1 rounded text-[10px] font-bold border transition-colors ${
                                                    activeType === t
                                                        ? 'bg-blue-600 border-blue-500 text-white'
                                                        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'
                                                }`}
                                                title={t}
                                            >
                                                {labels[t]}
                                            </button>
                                        )
                                    })}
                                </div>
                        </div>

                        <div className="space-y-1">
                            <div className="flex items-center justify-between px-3 mb-2">
                                <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Pages</h2>
                            </div>

                            <div className="grid grid-cols-2 gap-2 mb-4 px-1">
                                <button
                                    onClick={() => addPage()}
                                    className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-all text-xs font-bold shadow-lg shadow-blue-900/20"
                                >
                                    <PlusIcon size={16} />
                                    <span>白紙</span>
                                </button>
                                <button
                                    onClick={onOpenTemplateModal}
                                    className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-all text-xs font-bold border border-zinc-700"
                                >
                                    <Layout size={16} />
                                    <span>Template</span>
                                </button>
                            </div>

                            <div className="space-y-1">
                                {[...pages].reverse().map((page, revIdx) => {
                                    const originalIdx = pages.length - 1 - revIdx;
                                    return (
                                        <div key={page.id} className="group relative">
                                            <button
                                                onClick={() => selectPage(page.id)}
                                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm ${currentPageId === page.id ? 'bg-zinc-800 text-white border border-zinc-700' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 border border-transparent'}`}
                                            >
                                                <span className="truncate flex-1 text-left font-mono font-medium">{page.name}</span>
                                            </button>
                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); movePage(page.id, 'down'); }}
                                                    disabled={originalIdx === pages.length - 1}
                                                    className="p-1 text-zinc-500 hover:text-white disabled:opacity-0 transition-colors"
                                                    title="上に移動"
                                                >
                                                    <ChevronUp size={14} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); movePage(page.id, 'up'); }}
                                                    disabled={originalIdx === 0}
                                                    className="p-1 text-zinc-500 hover:text-white disabled:opacity-0 transition-colors"
                                                    title="下に移動"
                                                >
                                                    <ChevronDown size={14} />
                                                </button>
                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        const ok = await confirmMessage('このページを削除しますか？')
                                                        if (ok) {
                                                            removePage(page.id);
                                                        }
                                                    }}
                                                    className="p-1 text-zinc-500 hover:text-red-500 transition-colors"
                                                    title="ページを削除"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="pt-4 mt-4 border-t border-zinc-800">
                                <button
                                    onClick={cleanupAssets}
                                    title="参照されていない画像を assets/dust/ に移動します（完全削除しません）"
                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-red-900/20 border border-zinc-700 hover:border-red-900/30 transition-all text-zinc-400 hover:text-red-400 group"
                                >
                                    <Eraser size={18} className="group-hover:animate-pulse" />
                                    <span className="text-sm font-bold">Assets整理（ゴミ箱へ移動）</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <ReferenceCharactersModal
                isOpen={referenceModalOpen}
                onClose={() => setReferenceModalOpen(false)}
            />
            <BackgroundLibraryModal
                isOpen={backgroundLibraryOpen}
                onClose={() => setBackgroundLibraryOpen(false)}
            />
            <ImageCompositorModal
                isOpen={compositorOpen}
                onClose={() => setCompositorOpen(false)}
                currentProjectPath={currentProjectPath}
            />
        </div>
    )
}

export default SidebarLeft
