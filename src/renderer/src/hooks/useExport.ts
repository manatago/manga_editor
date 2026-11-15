import { useRef } from 'react'
import { flushSync } from 'react-dom'
import Konva from 'konva'
import { useMangaStore } from '../store/useMangaStore'
import type { Page } from '../store/types'
import { showError, showInfo } from '../utils/dialogs'

const waitNextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
const waitFrames = async (count: number) => {
    for (let i = 0; i < count; i += 1) {
        await waitNextFrame()
    }
}

const prepareStageForCapture = async (stage: Konva.Stage | null) => {
    stage?.batchDraw?.()
    // 1フレーム目: React/Konva の変更反映、2フレーム目: レイアウト確定後の描画安定化
    await waitFrames(2)
}

/** ステージ上で実際に描画に使われている HTMLImageElement を全部集める。
 *  コマ主画像は Shape の fillPatternImage、はみ出し人物は Konva.Image の image() に入る。 */
const collectImageEls = (stage: Konva.Stage | null): HTMLImageElement[] => {
    if (!stage) return []
    const els = new Set<HTMLImageElement>()
    for (const node of stage.find('Shape')) {
        const anyNode = node as unknown as { fillPatternImage?: () => unknown; image?: () => unknown }
        const fp = anyNode.fillPatternImage?.()
        if (fp instanceof HTMLImageElement) els.add(fp)
        const im = anyNode.image?.()
        if (im instanceof HTMLImageElement) els.add(im)
    }
    return [...els]
}

const isLoaded = (img: HTMLImageElement): boolean => img.complete && img.naturalWidth > 0

/** 与えられた画像要素がデコード完了するまで待つ（全体で deadline まで）。 */
const decodeAll = async (els: HTMLImageElement[], deadline: number): Promise<void> => {
    const waitOne = (img: HTMLImageElement): Promise<void> =>
        isLoaded(img)
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                  const done = (): void => {
                      img.removeEventListener('load', done)
                      img.removeEventListener('error', done)
                      resolve()
                  }
                  img.addEventListener('load', done, { once: true })
                  img.addEventListener('error', done, { once: true })
              })
    const all = Promise.all(els.map(waitOne)).then(() => undefined)
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, deadline - Date.now())))
    await Promise.race([all, timeout])
}

/**
 * ページ切替後、コマ画像（fillPattern）やはみ出し画像（Konva.Image）の非同期デコードが
 * 実際に終わるまで待つ。use-image は描画後の effect で読み込みを始めるため、要素は数フレーム
 * 遅れて差し替わる。固定待ち（旧実装の setTimeout 350ms）だと大きい画像・多コマのページで
 * コマだけ欠けた状態のまま toDataURL され、無言で白抜け PNG/PDF が焼かれることがあった。
 * ここでは「読み込み済み画像の枚数が 2 回連続で変化しなくなる」まで待ち、最大 2.5 秒で打ち切る。
 */
const waitForImagesAfterPageSwitch = async (stage: Konva.Stage | null): Promise<void> => {
    stage?.batchDraw?.()
    const deadline = Date.now() + 2500
    let prevCount = -1
    let stable = 0
    while (Date.now() < deadline) {
        await decodeAll(collectImageEls(stage), deadline)
        await waitFrames(2)
        const count = collectImageEls(stage).filter(isLoaded).length
        if (count === prevCount) {
            stable += 1
            if (stable >= 2) break
        } else {
            stable = 0
            prevCount = count
        }
    }
    stage?.batchDraw?.()
    await waitFrames(2)
}

export type ExportFormat = 'png' | 'jpeg'

// JPEG 品質（0..1）。ファイルサイズと画質のバランスで既定 0.9。
const JPEG_QUALITY = 0.9

const toDataUrlForFormat = (stage: any, format: ExportFormat): string =>
    stage.toDataURL(
        format === 'jpeg'
            ? { pixelRatio: 2, mimeType: 'image/jpeg', quality: JPEG_QUALITY }
            : { pixelRatio: 2 }
    )

export const useExport = () => {
    const stageRef = useRef<any>(null)

    const handleExportPNG = async (format: ExportFormat = 'png') => {
        const { currentPageId, currentProjectPath, pages, setExporting } = useMangaStore.getState()
        if (!stageRef.current || !currentPageId || !currentProjectPath) return

        setExporting(true)

        try {
            await prepareStageForCapture(stageRef.current)
            const dataUrl = toDataUrlForFormat(stageRef.current, format)
            const pageName = pages.find((p) => p.id === currentPageId)?.name || 'page'
            if (window.electron) {
                await window.electron.exportPNG(currentProjectPath, pageName, dataUrl, format)
                console.log('useExport: image exported successfully', format)
            }
        } catch (error) {
            console.error('useExport: export failed', error)
            await showError('エクスポートに失敗しました')
        } finally {
            setExporting(false)
        }
    }

    /**
     * 全ページを順に表示して画像化し、onPage に渡す（一括 PNG / PDF で共通）。
     * 終わったら元のページ・モザイク表示に戻す。
     */
    const captureAllPages = async (
        options: { hideMosaic?: boolean; format: ExportFormat },
        onPage: (page: Page, dataUrl: string) => Promise<void>
    ): Promise<number> => {
        const { pages, currentPageId, setExporting, selectPage, mosaicVisible, setMosaicVisible } =
            useMangaStore.getState()
        const originalPageId = currentPageId
        const originalMosaicVisible = mosaicVisible
        const shouldToggleMosaic = options.hideMosaic === true && originalMosaicVisible
        setExporting(true)
        if (shouldToggleMosaic) {
            flushSync(() => {
                setMosaicVisible(false)
            })
        }
        try {
            await prepareStageForCapture(stageRef.current)
            for (const page of pages) {
                flushSync(() => {
                    selectPage(page.id, { skipAutosave: true })
                })
                await waitForImagesAfterPageSwitch(stageRef.current)
                await onPage(page, toDataUrlForFormat(stageRef.current, options.format))
            }
            return pages.length
        } finally {
            if (shouldToggleMosaic) {
                flushSync(() => {
                    setMosaicVisible(originalMosaicVisible)
                })
            }
            if (originalPageId) {
                selectPage(originalPageId)
            }
            setExporting(false)
        }
    }

    const handleExportAllPagesPNG = async (options?: { hideMosaic?: boolean; format?: ExportFormat }) => {
        const format: ExportFormat = options?.format ?? 'png'
        const { pages, currentProjectPath } = useMangaStore.getState()
        if (!stageRef.current || !currentProjectPath || pages.length === 0 || !window.electron) return
        try {
            const count = await captureAllPages({ hideMosaic: options?.hideMosaic, format }, async (page, dataUrl) => {
                await window.electron.exportPNG(currentProjectPath, page.name, dataUrl, format)
            })
            const label = format === 'jpeg' ? 'JPEG' : 'PNG'
            const suffix = options?.hideMosaic ? '（モザイクなし）' : ''
            await showInfo(`全 ${count} ページを ${label} 出力しました${suffix}（exports/）`)
        } catch (error) {
            console.error('useExport: batch export failed', error)
            await showError('一括エクスポートに失敗しました')
        }
    }

    /**
     * 全ページを 1 つの PDF に書き出す。PNG 選択時は劣化なし（可逆圧縮）、JPEG 選択時は軽量。
     * 用紙サイズはページのキャンバスサイズ（96dpi 換算）。
     */
    const handleExportAllPagesPDF = async (options?: { hideMosaic?: boolean; format?: ExportFormat }) => {
        const format: ExportFormat = options?.format ?? 'png'
        const { pages, currentProjectPath } = useMangaStore.getState()
        if (!stageRef.current || !currentProjectPath || pages.length === 0 || !window.electron) return
        const sessionId = await window.electron.exportPdfBegin(currentProjectPath)
        try {
            await captureAllPages({ hideMosaic: options?.hideMosaic, format }, async (page, dataUrl) => {
                await window.electron.exportPdfAddPage(sessionId, dataUrl, page.pageWidth ?? 840, page.pageHeight ?? 1188)
            })
            const filePath = await window.electron.exportPdfFinish(sessionId)
            const suffix = options?.hideMosaic ? '（モザイクなし）' : ''
            await showInfo(`全 ${pages.length} ページを PDF に書き出しました${suffix}\n${filePath}`)
        } catch (error) {
            console.error('useExport: PDF export failed', error)
            await window.electron.exportPdfCancel(sessionId).catch(() => {})
            await showError('PDF の書き出しに失敗しました')
        }
    }

    const handleExportText = async () => {
        const { pages, currentProjectPath } = useMangaStore.getState()
        if (!currentProjectPath) return

        const lines: string[] = []
        for (const page of pages) {
            const bubbles = page.bubbles.filter((b) => b.text?.trim())
            if (bubbles.length === 0) continue

            // 上から下、左から右の順に並べる
            const sorted = [...bubbles].sort((a, b) => {
                const yDiff = a.y - b.y
                if (Math.abs(yDiff) > 30) return yDiff
                return a.x - b.x
            })

            lines.push(`P${page.name}`)
            lines.push('')
            for (const bubble of sorted) {
                lines.push(bubble.text)
            }
            lines.push('')
        }

        if (lines.length === 0) {
            await showInfo('エクスポートするセリフがありません')
            return
        }

        const content = lines.join('\n')
        try {
            if (window.electron) {
                const filePath = await window.electron.exportText(currentProjectPath, content)
                await showInfo(`セリフをエクスポートしました\n${filePath}`)
            }
        } catch (error) {
            console.error('useExport: text export failed', error)
            await showError('テキストエクスポートに失敗しました')
        }
    }

    return {
        stageRef,
        handleExportPNG,
        handleExportAllPagesPNG,
        handleExportAllPagesPDF,
        handleExportText
    }
}
