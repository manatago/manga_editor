import React, { useEffect, useMemo, useRef } from 'react'
import { Image as KonvaImage } from 'react-konva'
import useImage from 'use-image'
import Konva from 'konva'
import type { LayerTransform } from './types'

type CompositorCharNodeProps = {
    instanceId: string
    relativePath: string
    projectPath: string | null
    transform: LayerTransform
    stackIndex: number
    canvasW: number
    canvasH: number
    onSelect: () => void
    onDragEnd: (x: number, y: number) => void
    onTransformEnd: (t: LayerTransform) => void
    onInitialLayout: (id: string, t: LayerTransform) => void
    registerNode: (id: string, node: Konva.Image | null) => void
    layoutResolved: boolean
}

export const CompositorCharNode: React.FC<CompositorCharNodeProps> = ({
    instanceId,
    relativePath,
    projectPath,
    transform,
    stackIndex,
    canvasW,
    canvasH,
    onSelect,
    onDragEnd,
    onTransformEnd,
    onInitialLayout,
    registerNode,
    layoutResolved
}) => {
    const url = useMemo(() => {
        if (!projectPath || !window.electron) return ''
        const abs = window.electron.resolveAssetPath(projectPath, relativePath)
        return abs ? window.electron.pathToUrl(abs) : ''
    }, [projectPath, relativePath])
    const [img] = useImage(url, 'anonymous')
    const laidOutRef = useRef(false)

    useEffect(() => {
        if (layoutResolved || !img) return
        if (laidOutRef.current) return
        laidOutRef.current = true
        const targetH = canvasH * 0.48
        const sc = Math.min(2.5, Math.max(0.05, targetH / img.height))
        onInitialLayout(instanceId, {
            x: canvasW / 2 + stackIndex * 28,
            y: canvasH / 2,
            scaleX: sc,
            scaleY: sc,
            rotation: 0
        })
    }, [img, canvasW, canvasH, instanceId, stackIndex, onInitialLayout, layoutResolved])

    const iw = img?.width ?? 0
    const ih = img?.height ?? 0

    if (!img || iw <= 0 || ih <= 0) return null

    return (
        <KonvaImage
            ref={(node) => registerNode(instanceId, node)}
            image={img}
            x={transform.x}
            y={transform.y}
            offsetX={iw / 2}
            offsetY={ih / 2}
            scaleX={transform.scaleX}
            scaleY={transform.scaleY}
            rotation={transform.rotation}
            draggable
            onMouseDown={(e) => {
                e.cancelBubble = true
                onSelect()
            }}
            onDragEnd={(e) => {
                const n = e.target
                onDragEnd(n.x(), n.y())
            }}
            onTransformEnd={(e) => {
                const n = e.target
                onTransformEnd({
                    x: n.x(),
                    y: n.y(),
                    scaleX: n.scaleX(),
                    scaleY: n.scaleY(),
                    rotation: n.rotation()
                })
            }}
        />
    )
}
