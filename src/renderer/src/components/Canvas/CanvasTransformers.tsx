import React from 'react'
import { Transformer } from 'react-konva'
import Konva from 'konva'
import { PANEL_MIN_SIZE } from './helpers'

type Props = {
    transformerRef: React.RefObject<Konva.Transformer | null>
    bubbleTransformerRef: React.RefObject<Konva.Transformer | null>
    materialTransformerRef: React.RefObject<Konva.Transformer | null>
    showGrid: boolean
    snap: (value: number) => number
    selectedBubbleId: string | null
    selectedMaterialId: string | null
}

export const CanvasTransformers: React.FC<Props> = ({
    transformerRef,
    bubbleTransformerRef,
    materialTransformerRef,
    showGrid,
    snap,
    selectedBubbleId,
    selectedMaterialId
}) => {
    return (
        <>
            <Transformer
                ref={transformerRef}
                rotateEnabled={false}
                keepRatio={false}
                flipEnabled={false}
                boundBoxFunc={(oldBox, newBox) => {
                    if (newBox.width < PANEL_MIN_SIZE || newBox.height < PANEL_MIN_SIZE) {
                        return oldBox
                    }
                    if (showGrid) {
                        const width = Math.max(PANEL_MIN_SIZE, snap(newBox.width))
                        const height = Math.max(PANEL_MIN_SIZE, snap(newBox.height))
                        return {
                            ...newBox,
                            x: snap(newBox.x),
                            y: snap(newBox.y),
                            width,
                            height
                        }
                    }
                    return newBox
                }}
            />
            <Transformer
                ref={bubbleTransformerRef}
                rotateEnabled={true}
                keepRatio={false}
                flipEnabled={false}
                rotateAnchorOffset={24}
                rotateAnchorCursor="crosshair"
                anchorStyleFunc={(anchor) => {
                    if (anchor.hasName('rotater')) {
                        anchor.cornerRadius(12)
                        anchor.fill('#3b82f6')
                        anchor.stroke('white')
                        anchor.strokeWidth(2)
                        anchor.width(16)
                        anchor.height(16)
                        anchor.offsetX(8)
                        anchor.offsetY(8)
                    }
                }}
                enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'top-center', 'bottom-center', 'middle-left', 'middle-right']}
                boundBoxFunc={(oldBox, newBox) => {
                    if (newBox.width < 20 || newBox.height < 20) {
                        return oldBox
                    }
                    if (showGrid) {
                        return {
                            ...newBox,
                            x: snap(newBox.x),
                            y: snap(newBox.y),
                            width: Math.max(20, snap(newBox.width)),
                            height: Math.max(20, snap(newBox.height))
                        }
                    }
                    return newBox
                }}
                visible={!!selectedBubbleId}
            />
            <Transformer
                ref={materialTransformerRef}
                rotateEnabled={true}
                keepRatio={true}
                flipEnabled={false}
                enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
                boundBoxFunc={(oldBox, newBox) => {
                    if (newBox.width < 5 || newBox.height < 5) {
                        return oldBox
                    }
                    if (showGrid) {
                        return {
                            ...newBox,
                            x: snap(newBox.x),
                            y: snap(newBox.y),
                            width: Math.max(5, snap(newBox.width)),
                            height: Math.max(5, snap(newBox.height))
                        }
                    }
                    return newBox
                }}
                visible={!!selectedMaterialId}
            />
        </>
    )
}
