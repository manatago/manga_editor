import React, { useState } from 'react'
import { Plus, FolderOpen, Download, FileText, ChevronUp, ChevronDown, Plus as PlusIcon, Layout, Trash2, Copy, Eraser, ChevronLeft, Users, Layers, ImagePlus, Grid2x2, Eye, EyeOff, Pencil, Archive, RotateCcw, FileDown } from 'lucide-react'
import { ReferenceCharactersModal } from './ReferenceCharactersModal'
import { BackgroundLibraryModal } from './BackgroundLibraryModal'
import { ImageCompositorModal } from './ImageCompositorModal'
import { useMangaStore } from '../store/useMangaStore'
import { useShallow } from 'zustand/react/shallow'
import type { MosaicType } from '../store/types'
import { confirmMessage } from '../utils/dialogs'

type ExportFormat = 'png' | 'jpeg'

interface SidebarLeftProps {
    onExportPNG: (format: ExportFormat) => void;
    onExportAllPagesPNG: (format: ExportFormat) => void;
    onExportAllPagesPNGNoMosaic: (format: ExportFormat) => void;
    onExportAllPagesPDF: (format: ExportFormat, hideMosaic: boolean) => void;
    onExportText: () => void;
    onOpenTemplateModal: () => void;
    handleCreateNew: () => void;
    handleOpenProject: () => void;
    currentProjectPath: string | null;
    onCollapse?: () => void;
}

const SidebarLeft: React.FC<SidebarLeftProps> = ({
    onExportPNG,
    onExportAllPagesPNG,
    onExportAllPagesPNGNoMosaic,
    onExportAllPagesPDF,
    onExportText,
    onOpenTemplateModal,
    handleCreateNew,
    handleOpenProject,
    currentProjectPath,
    onCollapse
}) => {
    const {
        pages,
        archivedPages,
        currentPageId,
        selectPage,
        addPage,
        movePage,
        duplicatePage,
        removePage,
        restorePage,
        deleteArchivedPage,
        cleanupAssets,
        mosaicType,
        mosaicVisible,
        isMosaicMode,
        selectedMosaicId,
        setMosaicType,
        setMosaicVisible,
        setIsMosaicMode,
        updateMosaicType,
        updateMosaic
    } = useMangaStore(
        useShallow((s) => ({
            pages: s.pages,
            archivedPages: s.archivedPages,
            currentPageId: s.currentPageId,
            selectPage: s.selectPage,
            addPage: s.addPage,
            movePage: s.movePage,
            duplicatePage: s.duplicatePage,
            removePage: s.removePage,
            restorePage: s.restorePage,
            deleteArchivedPage: s.deleteArchivedPage,
            cleanupAssets: s.cleanupAssets,
            mosaicType: s.mosaicType,
            mosaicVisible: s.mosaicVisible,
            isMosaicMode: s.isMosaicMode,
            selectedMosaicId: s.selectedMosaicId,
            setMosaicType: s.setMosaicType,
            setMosaicVisible: s.setMosaicVisible,
            setIsMosaicMode: s.setIsMosaicMode,
            updateMosaicType: s.updateMosaicType,
            updateMosaic: s.updateMosaic
        }))
    )

    const currentPage = pages.find((p) => p.id === currentPageId)
    const selectedMosaic = currentPage?.mosaics?.find((m) => m.id === selectedMosaicId)
    const activeType = selectedMosaic ? selectedMosaic.type : mosaicType

    const [referenceModalOpen, setReferenceModalOpen] = useState(false)
    const [backgroundLibraryOpen, setBackgroundLibraryOpen] = useState(false)
    const [compositorOpen, setCompositorOpen] = useState(false)
    const [toolsOpen, setToolsOpen] = useState(false)
    const [archiveOpen, setArchiveOpen] = useState(false)
    const [exportFormat, setExportFormat] = useState<ExportFormat>('png')

    return (
        <div className="h-full flex flex-col min-h-0 bg-zinc-900">
            <div className="p-3 sm:p-4 border-b border-zinc-800 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center shrink-0">
                        <span className="text-zinc-50 font-bold text-xs">M</span>
                    </div>
                    <h1 className="font-bold text-zinc-50 tracking-tight truncate text-sm sm:text-base">漫画野郎</h1>
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
                        <button onClick={handleCreateNew} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-50 group">
                            <Plus size={18} className="group-hover:text-blue-500 transition-colors" />
                            <span className="text-sm font-medium">新規プロジェクト</span>
                        </button>
                        <button onClick={handleOpenProject} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-50 group">
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
                                className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors text-zinc-300 hover:text-zinc-50 text-sm font-bold"
                            >
                                <span>ツール</span>
                                <ChevronDown size={15} className={`transition-transform duration-200 ${toolsOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {toolsOpen && (
                                <div className="mt-2 space-y-1.5 px-1">
                                    {/* 書き出し形式トグル。JPEG はファイルサイズが軽い（透過は不可） */}
                                    <div className="flex items-center gap-1 p-0.5 rounded-lg bg-zinc-800 border border-zinc-700">
                                        {(['png', 'jpeg'] as const).map((fmt) => (
                                            <button
                                                key={fmt}
                                                onClick={() => setExportFormat(fmt)}
                                                className={`flex-1 py-1 rounded-md text-[10px] font-bold transition-colors ${exportFormat === fmt ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
                                            >
                                                {fmt === 'png' ? 'PNG' : 'JPEG（軽量）'}
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => onExportPNG(exportFormat)}
                                        disabled={!currentPageId}
                                        className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-600/20 transition-colors text-emerald-400 hover:text-emerald-300 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Download size={15} />
                                        <span>{exportFormat === 'jpeg' ? 'JPEG' : 'PNG'}出力（現在ページ）</span>
                                    </button>
                                    <button
                                        onClick={() => onExportAllPagesPNG(exportFormat)}
                                        disabled={!currentPageId || pages.length === 0}
                                        className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors text-zinc-300 hover:text-zinc-50 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Download size={15} />
                                        <span>全ページ一括 {exportFormat === 'jpeg' ? 'JPEG' : 'PNG'}（モザイクあり）</span>
                                    </button>
                                    <button
                                        onClick={() => onExportAllPagesPNGNoMosaic(exportFormat)}
                                        disabled={!currentPageId || pages.length === 0}
                                        className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors text-zinc-300 hover:text-zinc-50 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Download size={15} />
                                        <span>全ページ一括 {exportFormat === 'jpeg' ? 'JPEG' : 'PNG'}（モザイクなし）</span>
                                    </button>
                                    {/* PDF: PNG 選択時は劣化なし、JPEG 選択時は軽量 */}
                                    <div className="flex items-center gap-1">
                                        <span className="flex items-center gap-1.5 pl-3 pr-1 text-xs font-bold text-zinc-300 shrink-0">
                                            <FileDown size={15} />
                                            全ページ PDF
                                        </span>
                                        {([false, true] as const).map((hide) => (
                                            <button
                                                key={String(hide)}
                                                onClick={() => onExportAllPagesPDF(exportFormat, hide)}
                                                disabled={!currentPageId || pages.length === 0}
                                                title={`全ページを 1 つの PDF に書き出し（${exportFormat === 'jpeg' ? 'JPEG 圧縮・軽量' : '劣化なし'}）`}
                                                className="flex-1 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors text-zinc-300 hover:text-zinc-50 text-[10px] font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {hide ? 'モザイクなし' : 'モザイクあり'}
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        onClick={onExportText}
                                        disabled={pages.length === 0}
                                        className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors text-zinc-300 hover:text-zinc-50 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
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
                                <div className="grid grid-cols-5 gap-1">
                                    {(['pixel-12', 'frosted', 'white-blur', 'bars', 'none'] as MosaicType[]).map((t) => {
                                        const labels: Record<MosaicType, string> = {
                                            'pixel-12': 'px12',
                                            'frosted': '曇',
                                            'white-blur': '白',
                                            'bars': '縞',
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
                                {/* 棒線モザイク専用: 色（白縞/黒縞）と回転 */}
                                {selectedMosaic && selectedMosaic.type === 'bars' && (
                                    <div className="mt-2 space-y-2 px-1">
                                        <div className="flex items-center gap-1">
                                            <span className="text-[10px] text-zinc-500 w-8 shrink-0">色</span>
                                            {(['white', 'black'] as const).map((c) => (
                                                <button
                                                    key={c}
                                                    type="button"
                                                    onClick={() => updateMosaic(selectedMosaic.id, { barColor: c })}
                                                    className={`flex-1 py-1 rounded text-[10px] font-bold border transition-colors ${
                                                        (selectedMosaic.barColor ?? 'white') === c
                                                            ? 'bg-blue-600 border-blue-500 text-white'
                                                            : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'
                                                    }`}
                                                >
                                                    {c === 'white' ? '白縞' : '黒縞'}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-zinc-500 w-8 shrink-0">回転</span>
                                            <input
                                                type="range"
                                                min={-90}
                                                max={90}
                                                value={Math.round(selectedMosaic.barAngle ?? 0)}
                                                onChange={(e) => updateMosaic(selectedMosaic.id, { barAngle: Number(e.target.value) })}
                                                className="flex-1 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                            />
                                            <span className="text-[10px] text-blue-500 font-mono w-9 text-right shrink-0">{Math.round(selectedMosaic.barAngle ?? 0)}°</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-zinc-500 w-8 shrink-0">太さ</span>
                                            <input
                                                type="range"
                                                min={1}
                                                max={40}
                                                value={Math.round(selectedMosaic.barWidth ?? 4)}
                                                onChange={(e) => updateMosaic(selectedMosaic.id, { barWidth: Number(e.target.value) })}
                                                className="flex-1 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                            />
                                            <span className="text-[10px] text-blue-500 font-mono w-9 text-right shrink-0">{Math.round(selectedMosaic.barWidth ?? 4)}px</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-zinc-500 w-8 shrink-0">透明度</span>
                                            <input
                                                type="range"
                                                min={0}
                                                max={100}
                                                value={Math.round((selectedMosaic.barOpacity ?? 1) * 100)}
                                                onChange={(e) => updateMosaic(selectedMosaic.id, { barOpacity: Number(e.target.value) / 100 })}
                                                className="flex-1 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                            />
                                            <span className="text-[10px] text-blue-500 font-mono w-9 text-right shrink-0">{Math.round((selectedMosaic.barOpacity ?? 1) * 100)}%</span>
                                        </div>
                                    </div>
                                )}
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
                                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm ${currentPageId === page.id ? 'bg-zinc-800 text-zinc-50 border border-zinc-700' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 border border-transparent'}`}
                                            >
                                                <span className="truncate flex-1 text-left font-mono font-medium">{page.name}</span>
                                            </button>
                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); movePage(page.id, 'down'); }}
                                                    disabled={originalIdx === pages.length - 1}
                                                    className="p-1 text-zinc-500 hover:text-zinc-50 disabled:opacity-0 transition-colors"
                                                    title="上に移動"
                                                >
                                                    <ChevronUp size={14} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); movePage(page.id, 'up'); }}
                                                    disabled={originalIdx === 0}
                                                    className="p-1 text-zinc-500 hover:text-zinc-50 disabled:opacity-0 transition-colors"
                                                    title="下に移動"
                                                >
                                                    <ChevronDown size={14} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); duplicatePage(page.id); }}
                                                    className="p-1 text-zinc-500 hover:text-zinc-50 transition-colors"
                                                    title="ページを複製"
                                                >
                                                    <Copy size={14} />
                                                </button>
                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        const ok = await confirmMessage('このページを保管（アーカイブ）へ移動しますか？\nあとで「保管ページ」から復元できます。')
                                                        if (ok) {
                                                            removePage(page.id);
                                                        }
                                                    }}
                                                    className="p-1 text-zinc-500 hover:text-red-500 transition-colors"
                                                    title="ページを保管（アーカイブ）へ移動"
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
                                    onClick={() => setArchiveOpen((v) => !v)}
                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700 transition-all text-zinc-400 hover:text-zinc-200"
                                >
                                    <Archive size={16} />
                                    <span className="text-sm font-bold flex-1 text-left">保管ページ</span>
                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-700/70 text-zinc-300">{archivedPages.length}</span>
                                    {archiveOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>

                                {archiveOpen && (
                                    <div className="mt-2 space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
                                        {archivedPages.length === 0 ? (
                                            <p className="px-3 py-2 text-[11px] text-zinc-600">
                                                削除したページはここに保管されます。
                                            </p>
                                        ) : (
                                            archivedPages.map((page) => (
                                                <div key={page.id} className="group/arch flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/40 border border-transparent hover:border-zinc-700">
                                                    <Archive size={13} className="text-zinc-600 shrink-0" />
                                                    <span className="truncate flex-1 text-left text-xs text-zinc-400">
                                                        元 {page.name}
                                                        <span className="text-zinc-600"> ・ {page.panels.length}コマ</span>
                                                    </span>
                                                    <button
                                                        onClick={() => restorePage(page.id)}
                                                        className="p-1 text-zinc-500 hover:text-blue-400 transition-colors"
                                                        title="このページを復元（末尾に挿入）"
                                                    >
                                                        <RotateCcw size={14} />
                                                    </button>
                                                    <button
                                                        onClick={async () => {
                                                            const ok = await confirmMessage('この保管ページを完全に削除しますか？\nこの操作は取り消せません。')
                                                            if (ok) deleteArchivedPage(page.id)
                                                        }}
                                                        className="p-1 text-zinc-500 hover:text-red-500 transition-colors"
                                                        title="完全に削除"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
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
