import { useRef } from 'react'
import { useMangaStore } from '../store/useMangaStore'
import { showError, showInfo } from '../utils/dialogs'

const waitNextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
const waitFrames = async (count: number) => {
    for (let i = 0; i < count; i += 1) {
        await waitNextFrame()
    }
}

const prepareStageForCapture = async (stage: any) => {
    stage?.batchDraw?.()
    // 1フレーム目: React/Konva の変更反映、2フレーム目: レイアウト確定後の描画安定化
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

    const handleExportAllPagesPNG = async () => {
        const { pages, currentPageId, currentProjectPath, setExporting, selectPage } = useMangaStore.getState()
        if (!stageRef.current || !currentProjectPath || pages.length === 0) return

        const originalPageId = currentPageId
        setExporting(true)
        await prepareStageForCapture(stageRef.current)

        try {
            for (const page of pages) {
                selectPage(page.id)
                await prepareStageForCapture(stageRef.current)
                const dataUrl = stageRef.current.toDataURL({
                    pixelRatio: 2
                })
                if (window.electron) {
                    await window.electron.exportPNG(currentProjectPath, page.name, dataUrl)
                }
            }
            console.log('useExport: all pages exported', pages.length)
            await showInfo(`全 ${pages.length} ページを PNG 出力しました（exports/）`)
        } catch (error) {
            console.error('useExport: batch export failed', error)
            await showError('一括エクスポートに失敗しました')
        } finally {
            if (originalPageId) {
                selectPage(originalPageId)
            }
            setExporting(false)
        }
    }

    return {
        stageRef,
        handleExportPNG,
        handleExportAllPagesPNG
    }
}
