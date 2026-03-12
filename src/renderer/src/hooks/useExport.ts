import { useRef } from 'react'
import { useMangaStore } from '../store/useMangaStore'

export const useExport = () => {
    const { 
        pages, 
        currentPageId, 
        currentProjectPath, 
        setExporting 
    } = useMangaStore()
    const stageRef = useRef<any>(null)

    const handleExportPNG = async () => {
        if (!stageRef.current || !currentPageId || !currentProjectPath) return

        setExporting(true)

        // Give React a moment to hide the transformers
        setTimeout(async () => {
            try {
                const dataUrl = stageRef.current.toDataURL({
                    pixelRatio: 2 // High quality export
                })
                const pageName = pages.find(p => p.id === currentPageId)?.name || 'page'
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
        }, 100)
    }

    return {
        stageRef,
        handleExportPNG
    }
}
