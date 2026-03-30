import { useRef } from 'react'
import { useMangaStore } from '../store/useMangaStore'

const PAGE_SWITCH_MS = 150
const EXPORT_HIDE_MS = 100

export const useExport = () => {
    const stageRef = useRef<any>(null)

    const handleExportPNG = async () => {
        const { currentPageId, currentProjectPath, pages, setExporting } = useMangaStore.getState()
        if (!stageRef.current || !currentPageId || !currentProjectPath) return

        setExporting(true)

        setTimeout(async () => {
            try {
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
                alert('エクスポートに失敗しました')
            } finally {
                setExporting(false)
            }
        }, EXPORT_HIDE_MS)
    }

    const handleExportAllPagesPNG = async () => {
        const { pages, currentPageId, currentProjectPath, setExporting, selectPage } = useMangaStore.getState()
        if (!stageRef.current || !currentProjectPath || pages.length === 0) return

        const originalPageId = currentPageId
        setExporting(true)
        await new Promise((r) => setTimeout(r, EXPORT_HIDE_MS))

        try {
            for (const page of pages) {
                selectPage(page.id)
                await new Promise((r) => setTimeout(r, PAGE_SWITCH_MS))
                const dataUrl = stageRef.current.toDataURL({
                    pixelRatio: 2
                })
                if (window.electron) {
                    await window.electron.exportPNG(currentProjectPath, page.name, dataUrl)
                }
            }
            console.log('useExport: all pages exported', pages.length)
            alert(`全 ${pages.length} ページを PNG 出力しました（exports/）`)
        } catch (error) {
            console.error('useExport: batch export failed', error)
            alert('一括エクスポートに失敗しました')
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
