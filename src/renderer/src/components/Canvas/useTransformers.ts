import React, { useEffect, useRef } from 'react'
import Konva from 'konva'
import type { Bubble, Material, Panel } from '../../store/useMangaStore'

type Args = {
    selectedPanelId: string | null
    selectedBubbleId: string | null
    selectedMaterialId: string | null
    selectedMosaicId: string | null
    isMosaicMode: boolean
    panels: Panel[]
    bubbles: Bubble[]
    materials: Material[]
    mosaics: { id: string }[]
}

export function useTransformers({
    selectedPanelId,
    selectedBubbleId,
    selectedMaterialId,
    selectedMosaicId,
    isMosaicMode,
    panels,
    bubbles,
    materials,
    mosaics
}: Args): {
    transformerRef: React.RefObject<Konva.Transformer | null>
    bubbleTransformerRef: React.RefObject<Konva.Transformer | null>
    materialTransformerRef: React.RefObject<Konva.Transformer | null>
    mosaicTransformerRef: React.RefObject<Konva.Transformer | null>
} {
    const transformerRef = useRef<Konva.Transformer>(null)
    const bubbleTransformerRef = useRef<Konva.Transformer>(null)
    const materialTransformerRef = useRef<Konva.Transformer>(null)
    const mosaicTransformerRef = useRef<Konva.Transformer>(null)

    useEffect(() => {
        if (selectedPanelId && transformerRef.current) {
            const stage = transformerRef.current.getStage()
            const node = stage?.findOne('#interaction-' + selectedPanelId)
            if (node) {
                transformerRef.current.nodes([node])
                transformerRef.current.forceUpdate() // Force sync handles to node size
                transformerRef.current.getLayer()?.batchDraw()
            }
        } else {
            transformerRef.current?.nodes([])
        }
    }, [selectedPanelId, panels]) // Re-run when panels change to sync handles after resize

    useEffect(() => {
        if (selectedBubbleId && bubbleTransformerRef.current) {
            const stage = bubbleTransformerRef.current.getStage()
            const node = stage?.findOne('#interaction-' + selectedBubbleId)
            if (node) {
                bubbleTransformerRef.current.nodes([node])
                bubbleTransformerRef.current.forceUpdate() // Force sync handles to node size
                bubbleTransformerRef.current.getLayer()?.batchDraw()
            }
        } else {
            bubbleTransformerRef.current?.nodes([])
        }
    }, [selectedBubbleId, bubbles]) // Re-run when bubbles change to sync handles after resize

    useEffect(() => {
        if (selectedMaterialId && materialTransformerRef.current) {
            const stage = materialTransformerRef.current.getStage()
            const node = stage?.findOne('#interaction-material-' + selectedMaterialId)
            if (node) {
                materialTransformerRef.current.nodes([node])
                materialTransformerRef.current.forceUpdate()
                materialTransformerRef.current.getLayer()?.batchDraw()
            }
        } else {
            materialTransformerRef.current?.nodes([])
        }
    }, [selectedMaterialId, materials])

    useEffect(() => {
        if (isMosaicMode && selectedMosaicId && mosaicTransformerRef.current) {
            const stage = mosaicTransformerRef.current.getStage()
            const node = stage?.findOne('#mosaic-' + selectedMosaicId)
            if (node) {
                mosaicTransformerRef.current.nodes([node])
                mosaicTransformerRef.current.forceUpdate()
                mosaicTransformerRef.current.getLayer()?.batchDraw()
            } else {
                mosaicTransformerRef.current.nodes([])
            }
        } else {
            mosaicTransformerRef.current?.nodes([])
        }
    }, [selectedMosaicId, isMosaicMode, mosaics])

    return { transformerRef, bubbleTransformerRef, materialTransformerRef, mosaicTransformerRef }
}
