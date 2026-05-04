import React, { useState } from 'react'
import Konva from 'konva'
import type { MosaicRegion, MosaicType } from '../../store/types'

type Args = {
    stageRef: React.RefObject<Konva.Stage | null>
    isMosaicMode: boolean
    mosaicType: MosaicType
    addMosaic: (props: Omit<MosaicRegion, 'id'>) => void
    setSelectedMosaicId: (id: string | null) => void
}

export function useMosaicDrawing({
    stageRef,
    isMosaicMode,
    mosaicType,
    addMosaic,
    setSelectedMosaicId
}: Args): {
    mosaicDrawing: boolean
    mosaicStart: { x: number; y: number } | null
    mosaicCurrent: { x: number; y: number } | null
    handleMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => void
    handleMouseMove: (e: Konva.KonvaEventObject<MouseEvent>) => void
    handleMouseUp: () => void
} {
    const [mosaicDrawing, setMosaicDrawing] = useState(false)
    const [mosaicStart, setMosaicStart] = useState<{ x: number; y: number } | null>(null)
    const [mosaicCurrent, setMosaicCurrent] = useState<{ x: number; y: number } | null>(null)

    const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>): void => {
        if (!isMosaicMode) return
        const stage = stageRef.current
        if (!stage) return
        // Only start drawing when clicking on stage background (not on a mosaic item)
        if (e.target !== stage) return
        const pos = stage.getPointerPosition()
        if (!pos) return
        setSelectedMosaicId(null)
        setMosaicDrawing(true)
        setMosaicStart(pos)
        setMosaicCurrent(pos)
    }

    const handleMouseMove = (_e: Konva.KonvaEventObject<MouseEvent>): void => {
        if (!mosaicDrawing) return
        const stage = stageRef.current
        if (!stage) return
        const pos = stage.getPointerPosition()
        if (pos) setMosaicCurrent(pos)
    }

    const handleMouseUp = (): void => {
        if (!mosaicDrawing || !mosaicStart || !mosaicCurrent) return
        setMosaicDrawing(false)
        const x = Math.min(mosaicStart.x, mosaicCurrent.x)
        const y = Math.min(mosaicStart.y, mosaicCurrent.y)
        const w = Math.abs(mosaicCurrent.x - mosaicStart.x)
        const h = Math.abs(mosaicCurrent.y - mosaicStart.y)
        if (w > 10 && h > 10) {
            addMosaic({ x, y, width: w, height: h, type: mosaicType })
        }
        setMosaicStart(null)
        setMosaicCurrent(null)
    }

    return {
        mosaicDrawing,
        mosaicStart,
        mosaicCurrent,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp
    }
}
