import React, { useMemo, useState } from 'react'
import { X, Languages, FileDown, FileUp, FolderPlus, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useMangaStore } from '../../store/useMangaStore'
import { showError, showInfo, confirmMessage } from '../../utils/dialogs'
import { TARGET_LOCALES, localeMeta, type TargetLocale } from '../../data/i18nFonts'
import {
    buildTranslationSheet,
    parseTranslationSheet,
    applyTranslationSheet,
    flattenLines,
    type TranslationSheet
} from '../../utils/i18n/translationSheet'

interface TranslationModalProps {
    isOpen: boolean
    onClose: () => void
    /** 生成した翻訳版を開く（元プロジェクトから切り替え） */
    onOpenProject: (path: string) => Promise<unknown>
}

function basename(p: string): string {
    return p.split('/').filter(Boolean).pop() ?? p
}

export const TranslationModal: React.FC<TranslationModalProps> = ({ isOpen, onClose, onOpenProject }) => {
    const currentProjectPath = useMangaStore((s) => s.currentProjectPath)
    const pages = useMangaStore((s) => s.pages)
    const getProjectData = useMangaStore((s) => s.getProjectData)

    const [locale, setLocale] = useState<TargetLocale>('zh-Hans')
    const [horizontal, setHorizontal] = useState<boolean>(localeMeta('zh-Hans').defaultHorizontal)
    const [sheet, setSheet] = useState<TranslationSheet | null>(null)
    const [sheetFileName, setSheetFileName] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    // 字体を切り替えたら、そのロケールの既定の書字方向に合わせる（手動で上書き可）
    const changeLocale = (next: TargetLocale): void => {
        setLocale(next)
        setHorizontal(localeMeta(next).defaultHorizontal)
    }

    const projectName = currentProjectPath ? basename(currentProjectPath) : ''

    const textBubbleCount = useMemo(
        () => pages.reduce((n, p) => n + (p.bubbles || []).filter((b) => (b.text ?? '').trim() !== '').length, 0),
        [pages]
    )

    const sheetStats = useMemo(() => {
        if (!sheet) return null
        const lines = flattenLines(sheet)
        const translated = lines.filter((l) => l.target && l.target.trim() !== '').length
        return { translated, total: lines.length }
    }, [sheet])

    if (!isOpen) return null

    const handleExport = async () => {
        if (!currentProjectPath || !window.electron) return
        try {
            const data = getProjectData()
            const built = buildTranslationSheet(data.pages, { sourceName: projectName, locale })
            const lineCount = flattenLines(built).length
            const suffix = localeMeta(locale).folderSuffix
            const defaultName = `${projectName}_${suffix}_翻訳シート.json`
            const savedPath = await window.electron.exportTranslationSheet(
                defaultName,
                JSON.stringify(built, null, 2)
            )
            if (savedPath) {
                await showInfo(
                    `翻訳シートを書き出しました（${lineCount} 件）:\n${savedPath}\n\n` +
                        'このJSONの各 "target" に訳文を入れて保存し、下の「翻訳シートを選ぶ」で読み込んでください。'
                )
            }
        } catch (e) {
            await showError('翻訳シートの書き出しに失敗しました:\n' + (e instanceof Error ? e.message : String(e)))
        }
    }

    const handlePickSheet = async () => {
        if (!window.electron) return
        try {
            const res = await window.electron.selectTranslationSheet()
            if (!res) return
            const parsed = parseTranslationSheet(JSON.parse(res.content))
            setSheet(parsed)
            setSheetFileName(basename(res.path))
            // シートに記録されたロケールへ自動追従（書き出し時の字体に合わせる）
            if (parsed.locale === 'zh-Hans' || parsed.locale === 'zh-Hant') changeLocale(parsed.locale)
        } catch (e) {
            setSheet(null)
            setSheetFileName(null)
            await showError('翻訳シートの読み込みに失敗しました:\n' + (e instanceof Error ? e.message : String(e)))
        }
    }

    const handleBuild = async () => {
        if (!currentProjectPath || !window.electron || !sheet) return
        setBusy(true)
        try {
            const data = getProjectData()
            const { data: localized, stats } = applyTranslationSheet(data, sheet, locale, {
                forceHorizontal: horizontal,
                minLineHeight: localeMeta(locale).minLineHeight
            })
            const suffix = localeMeta(locale).folderSuffix
            const folderName = `${projectName}_${suffix}`
            const targetPath = await window.electron.createLocalizedProject(
                currentProjectPath,
                folderName,
                localized
            )
            const open = await confirmMessage(
                `翻訳版を作成しました:\n${targetPath}\n\n` +
                    `訳済み ${stats.translated} / ${stats.total}（未訳 ${stats.missing}）、フォント置換 ${stats.fontsChanged} 箇所\n\n` +
                    'この翻訳版を今すぐ開きますか？'
            )
            onClose()
            if (open) await onOpenProject(targetPath)
        } catch (e) {
            await showError('翻訳版の作成に失敗しました:\n' + (e instanceof Error ? e.message : String(e)))
        } finally {
            setBusy(false)
        }
    }

    const localeMismatch = sheet ? sheet.locale !== locale : false

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl">
                {/* ヘッダ */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
                    <div className="flex items-center gap-2 text-white">
                        <Languages size={18} className="text-indigo-400" />
                        <h2 className="text-base font-semibold">翻訳版を作成</h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    <p className="text-xs text-zinc-500 leading-relaxed">
                        セリフを翻訳シート(JSON)に書き出し → DeepSeek 等で訳文を埋めて → 取り込むと、
                        元プロジェクトの隣に翻訳版フォルダを生成します。座標・エフェクト・画像はそのまま、
                        訳文とフォント（中文フォントへ自動置換）だけが差し替わります。
                    </p>

                    {/* 字体選択 */}
                    <div>
                        <div className="text-xs font-medium text-zinc-400 mb-2">字体</div>
                        <div className="flex gap-2">
                            {TARGET_LOCALES.map((l) => (
                                <button
                                    key={l.value}
                                    type="button"
                                    onClick={() => changeLocale(l.value)}
                                    className={`px-3 py-1.5 rounded-md text-sm border transition-all ${
                                        locale === l.value
                                            ? 'bg-indigo-600 border-indigo-500 text-white'
                                            : 'bg-zinc-800/60 border-zinc-700 text-zinc-300 hover:text-white'
                                    }`}
                                >
                                    {l.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 書字方向 */}
                    <div>
                        <div className="text-xs font-medium text-zinc-400 mb-2">書字方向</div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setHorizontal(false)}
                                className={`px-3 py-1.5 rounded-md text-sm border transition-all ${
                                    !horizontal
                                        ? 'bg-indigo-600 border-indigo-500 text-white'
                                        : 'bg-zinc-800/60 border-zinc-700 text-zinc-300 hover:text-white'
                                }`}
                            >
                                縦書き（原版のまま）
                            </button>
                            <button
                                type="button"
                                onClick={() => setHorizontal(true)}
                                className={`px-3 py-1.5 rounded-md text-sm border transition-all ${
                                    horizontal
                                        ? 'bg-indigo-600 border-indigo-500 text-white'
                                        : 'bg-zinc-800/60 border-zinc-700 text-zinc-300 hover:text-white'
                                }`}
                            >
                                横書きにする
                            </button>
                        </div>
                        <div className="text-[11px] text-zinc-600 mt-1">
                            {localeMeta(locale).defaultHorizontal
                                ? '简体字は横書きが既定です（繁體字は縦書き）。'
                                : '繁體字は縦書きが既定です（简体字は横書き）。'}
                            必要に応じて上書きできます。
                        </div>
                    </div>

                    {/* Step 1: 書き出し */}
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
                        <div className="text-sm font-medium text-zinc-200 mb-1">1. 翻訳シートを書き出す</div>
                        <div className="text-xs text-zinc-500 mb-3">
                            この作品のセリフ {textBubbleCount} 件を JSON に書き出します。
                        </div>
                        <button
                            type="button"
                            onClick={handleExport}
                            disabled={!currentProjectPath || textBubbleCount === 0}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <FileDown size={15} />
                            翻訳シートを書き出す（{textBubbleCount} 件）
                        </button>
                    </div>

                    {/* Step 2: 翻訳（案内のみ） */}
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
                        <div className="text-sm font-medium text-zinc-200 mb-1">2. 訳文を入れる（アプリ外）</div>
                        <div className="text-xs text-zinc-500 leading-relaxed">
                            書き出した JSON を DeepSeek などに渡し、各 <code className="text-zinc-300">"target"</code> に訳文を入れて保存します。
                            <span className="text-zinc-400">id と source は変更しない</span>でください。改行は
                            <code className="text-zinc-300"> \n </code>で表します。
                        </div>
                    </div>

                    {/* Step 3: 取り込み＆生成 */}
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
                        <div className="text-sm font-medium text-zinc-200 mb-1">3. 取り込んで翻訳版を作成</div>
                        <div className="text-xs text-zinc-500 mb-3">
                            訳文入りの JSON を読み込み、翻訳版プロジェクト
                            <code className="text-zinc-300"> {projectName || '(作品名)'}_{localeMeta(locale).folderSuffix} </code>
                            を生成します。
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mb-3">
                            <button
                                type="button"
                                onClick={handlePickSheet}
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700"
                            >
                                <FileUp size={15} />
                                翻訳シートを選ぶ
                            </button>
                            {sheetFileName && (
                                <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
                                    <CheckCircle2 size={14} className="text-emerald-400" />
                                    {sheetFileName}
                                    {sheetStats && (
                                        <span className="text-zinc-500">
                                            （訳済み {sheetStats.translated}/{sheetStats.total}）
                                        </span>
                                    )}
                                </span>
                            )}
                        </div>

                        {localeMismatch && (
                            <div className="flex items-start gap-1.5 text-xs text-amber-400 mb-3">
                                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                                このシートは「{localeMeta(sheet!.locale).label}」用に書き出されています。字体を合わせて取り込みます。
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={handleBuild}
                            disabled={!sheet || busy}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {busy ? <Loader2 size={15} className="animate-spin" /> : <FolderPlus size={15} />}
                            {busy ? '作成中…' : '翻訳版プロジェクトを作成'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default TranslationModal
