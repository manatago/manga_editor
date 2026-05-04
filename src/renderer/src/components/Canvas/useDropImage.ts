import React from 'react'
import Konva from 'konva'
import type { Material, Panel } from '../../store/useMangaStore'
import { getOrientedImagePixelSize, type FileWithNativePath } from './helpers'

type Args = {
    stageRef: React.RefObject<Konva.Stage | null>
    currentProjectPath: string | null
    panels: Panel[]
    selectedPanelId: string | null
    updatePanel: (id: string, updates: Partial<Panel>, undoable?: boolean) => void
    addMaterial: (props: Partial<Omit<Material, 'id'>>) => void
}

export function useDropImage({
    stageRef,
    currentProjectPath,
    panels,
    selectedPanelId,
    updatePanel,
    addMaterial
}: Args): (e: React.DragEvent) => Promise<void> {
    return async (e: React.DragEvent): Promise<void> => {
        e.preventDefault()
        const stage = stageRef.current
        if (!stage) return

        // HTML5 の drop は Stage の pointer イベントを通らない。Konva と同じ式で論理座標にする
        // （setPointersPositions が content の scaleX/Y も踏まえる。ずれるとクリップ素材の位置・ヒットが壊れる）
        stage.setPointersPositions(e.nativeEvent)
        const pointerPos = stage.getPointerPosition()
        if (!pointerPos) return
        const files = Array.from(e.dataTransfer.files)
        const imageFile = files.find((f) => f.type.startsWith('image/'))

        if (!imageFile) return

        // In Electron, use webUtils via preload to get the native path
        let nativePath: string | undefined = undefined
        try {
            if (window.electron?.getPathForFile) {
                nativePath = window.electron.getPathForFile(imageFile)
            }
        } catch (err) {
            console.error('Canvas: Error calling getPathForFile:', err)
        }

        if (!nativePath) {
            nativePath = (imageFile as FileWithNativePath).path
        }

        if (!nativePath || !window.electron || !currentProjectPath) return

        try {
            const { w: nw, h: nh } = await getOrientedImagePixelSize(imageFile)
            const projectLocalPath = await window.electron.copyFileToProject(currentProjectPath, nativePath)

            const maxDim = 200
            let w = nw || maxDim
            let h = nh || maxDim
            const ratio = w / h
            if (w > h) {
                w = maxDim
                h = maxDim / ratio
            } else {
                h = maxDim
                w = maxDim * ratio
            }

            // Contextual drop logic
            let targetPanel: Panel | undefined = undefined

            if (selectedPanelId) {
                targetPanel = panels.find((p) => p.id === selectedPanelId)
            }

            if (!targetPanel) {
                const panelsUnderPointer = panels.filter((p) => {
                    return pointerPos.x >= p.x && pointerPos.x <= p.x + p.width && pointerPos.y >= p.y && pointerPos.y <= p.y + p.height
                })
                targetPanel = panelsUnderPointer[panelsUnderPointer.length - 1] // Topmost panel
            }

            const x = pointerPos.x - w / 2
            const y = pointerPos.y - h / 2

            if (targetPanel && !targetPanel.imagePath) {
                // First image on empty panel: Set as background
                updatePanel(targetPanel.id, {
                    imagePath: projectLocalPath,
                    imageScale: 1,
                    imageRotation: 0,
                    imageX: targetPanel.width / 2,
                    imageY: targetPanel.height / 2
                })
            } else if (targetPanel) {
                // Subsequent image or dropped on panel with background: Create Material (clipped)
                addMaterial({
                    imagePath: projectLocalPath,
                    x,
                    y,
                    width: w,
                    height: h,
                    isClipped: true,
                    panelId: targetPanel.id
                })
            } else {
                // Dropped on empty canvas: Create Material (unclipped)
                addMaterial({
                    imagePath: projectLocalPath,
                    x,
                    y,
                    width: w,
                    height: h,
                    isClipped: false
                })
            }
        } catch (error) {
            console.error('Canvas: Failed to copy dropped image to project:', error)
        }
    }
}
