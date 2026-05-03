import { useRef } from 'react'
import { flushSync } from 'react-dom'
import Konva from 'konva'
import { useMangaStore } from '../store/useMangaStore'
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

/**
 * ページ切替後、use-image 等の非同期デコードが終わるまで待つ。
 * 待ちが短いと一括 PNG でコマ画像だけ欠けた状態で toDataURL される（1ページ目は既に表示中で再現しにくい）。
 */
const waitForImagesAfterPageSwitch = async (stage: Konva.Stage | null) => {
    stage?.batchDraw?.()
    await waitFrames(6)
    await new Promise<void>((r) => setTimeout(r, 350))
    stage?.batchDraw?.()
    await waitFrames(2)
}

export const useExport = () => {
    const stageRef = useRef<any>(null)

    const handleExportPNG = async () => {
        const { currentPageId, currentProjectPath, pages, setExporting } = useMangaStore.getState()
        if (!stageRef.current || !currentPageId || !currentProjectPath) return

        setExporting(true)

        try {
            await prepareStageForCapture(stageRef.current)
            const dataUrl = stageRef.current.toDataURL({
                pixelRatio: 2
            })
            const pageName = pages.find((p) => p.id === currentPageId)?.name || 'page'
            if (window.electron) {
                await window.electron.exportPNG(currentProjectPath, pageName, dataUrl)
                console.log('useExport: PNG exported successfully')
            }
        } catch (error) {
            console.error('useExport: export failed', error)
            await showError('エクスポートに失敗しました')
        } finally {
            setExporting(false)
        }
    }

    const handleExportAllPagesPNG = async (options?: { hideMosaic?: boolean }) => {
        const {
            pages,
            currentPageId,
            currentProjectPath,
            setExporting,
            selectPage,
            mosaicVisible,
            setMosaicVisible
        } = useMangaStore.getState()
        if (!stageRef.current || !currentProjectPath || pages.length === 0) return

        const originalPageId = currentPageId
        const originalMosaicVisible = mosaicVisible
        const shouldToggleMosaic = options?.hideMosaic === true && originalMosaicVisible
        setExporting(true)
        if (shouldToggleMosaic) {
            flushSync(() => {
                setMosaicVisible(false)
            })
        }
        await prepareStageForCapture(stageRef.current)

        try {
            for (const page of pages) {
                flushSync(() => {
                    selectPage(page.id, { skipAutosave: true })
                })
                await waitForImagesAfterPageSwitch(stageRef.current)
                const dataUrl = stageRef.current.toDataURL({
                    pixelRatio: 2
                })
                if (window.electron) {
                    await window.electron.exportPNG(currentProjectPath, page.name, dataUrl)
                }
            }
            console.log('useExport: all pages exported', pages.length, options)
            const suffix = options?.hideMosaic ? '（モザイクなし）' : ''
            await showInfo(`全 ${pages.length} ページを PNG 出力しました${suffix}（exports/）`)
        } catch (error) {
            console.error('useExport: batch export failed', error)
            await showError('一括エクスポートに失敗しました')
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
        handleExportText
    }
}
