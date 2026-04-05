import React, { useState } from 'react'
import { Plus, FolderOpen, Download, FileText, ChevronUp, ChevronDown, Plus as PlusIcon, Layout, Trash2, Eraser, ChevronLeft, Users, Layers, ImagePlus } from 'lucide-react'
import { ReferenceCharactersModal } from './ReferenceCharactersModal'
import { BackgroundLibraryModal } from './BackgroundLibraryModal'
import { ImageCompositorModal } from './ImageCompositorModal'
import { useMangaStore } from '../store/useMangaStore'
import type { Page, Panel } from '../store/types'
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
        saveAsTemplate, // Not used in this component, but part of the store destructuring
        cleanupAssets
    } = useMangaStore()

    const [referenceModalOpen, setReferenceModalOpen] = useState(false)
    const [backgroundLibraryOpen, setBackgroundLibraryOpen] = useState(false)
    const [compositorOpen, setCompositorOpen] = useState(false)

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
                        <div className="space-y-2">
                            <button
                                onClick={onExportPNG}
                                disabled={!currentPageId}
                                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-600/20 transition-colors text-emerald-400 hover:text-emerald-300 font-bold group disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Download size={18} />
                                <span className="text-sm">PNG出力（現在ページ）</span>
                            </button>
                            <button
                                onClick={onExportAllPagesPNG}
                                disabled={!currentPageId || pages.length === 0}
                                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors text-zinc-300 hover:text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Download size={18} />
                                <span>全ページ一括 PNG</span>
                            </button>
                            <button
                                onClick={onExportText}
                                disabled={pages.length === 0}
                                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors text-zinc-300 hover:text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <FileText size={18} />
                                <span>セリフ一覧 TXT</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setReferenceModalOpen(true)}
                                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-violet-950/40 hover:bg-violet-900/40 border border-violet-800/40 transition-colors text-violet-200 hover:text-violet-100 font-bold text-sm"
                            >
                                <Users size={18} />
                                <span>参照キャラクター</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setBackgroundLibraryOpen(true)}
                                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-sky-950/40 hover:bg-sky-900/40 border border-sky-800/40 transition-colors text-sky-200 hover:text-sky-100 font-bold text-sm"
                            >
                                <Layers size={18} />
                                <span>背景ライブラリ</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setCompositorOpen(true)}
                                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-pink-950/40 hover:bg-pink-900/40 border border-pink-900/40 transition-colors text-pink-100 hover:text-pink-50 font-bold text-sm"
                            >
                                <ImagePlus size={18} />
                                <span>背景＋人物の合成</span>
                            </button>
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
