import React from 'react'
import Konva from 'konva'
import { Ring } from 'react-konva'
import type { Panel } from '../store/useMangaStore'
import {
    computeParallelAlignment,
    getDiagonalEdges,
    snapCornerXForAngle,
    snapCornerYForAngle
} from '../utils/edgeAlignment'
import { useMangaStore } from '../store/useMangaStore'

type CornerKeyH = 'TL' | 'TR' | 'BR' | 'BL'
type CornerKeyV = 'TL' | 'TR' | 'BR' | 'BL'

// 中央を抜いた輪っか形状にして、Transformer の四角ハンドルと重なっても両方クリックできるようにする。
// 内側の穴部分は当たり判定が無いため、その上に乗っている Transformer 四角はそのままドラッグできる。
const HANDLE_PROPS = {
    innerRadius: 7,
    outerRadius: 10,
    fill: '#10b981',
    stroke: 'white',
    strokeWidth: 1.5
}

interface Props {
    panel: Panel
    siblings: Panel[]
    onUpdate: (id: string, updates: Partial<Panel>, undoable?: boolean) => void
}

/**
 * trapezoid-h / trapezoid-v の角ハンドル。
 * 各角を1自由度（X または Y）で動かし、平行整列スナップを適用する。
 */
export const TrapezoidHandles: React.FC<Props> = ({ panel, siblings, onUpdate }) => {
    const setActiveParallelGuides = useMangaStore((s) => s.setActiveParallelGuides)
    const clearActiveAlignmentGuides = useMangaStore((s) => s.clearActiveAlignmentGuides)
    if ((panel.rotation ?? 0) !== 0) return null
    if (panel.type !== 'trapezoid-h' && panel.type !== 'trapezoid-v') return null

    const w = panel.width
    const h = panel.height

    // 角の座標と、ドラッグで更新するフィールド名と、対辺の頂点座標（local）を返す
    const cornersH = [
        {
            key: 'TL' as CornerKeyH,
            local: { x: panel.slant, y: 0 },
            counterLocal: { x: panel.offsetD, y: h },
            field: 'slant' as const,
            valueFromX: (lx: number) => lx
        },
        {
            key: 'TR' as CornerKeyH,
            local: { x: w + panel.offsetB, y: 0 },
            counterLocal: { x: w + panel.offsetC, y: h },
            field: 'offsetB' as const,
            valueFromX: (lx: number) => lx - w
        },
        {
            key: 'BR' as CornerKeyH,
            local: { x: w + panel.offsetC, y: h },
            counterLocal: { x: w + panel.offsetB, y: 0 },
            field: 'offsetC' as const,
            valueFromX: (lx: number) => lx - w
        },
        {
            key: 'BL' as CornerKeyH,
            local: { x: panel.offsetD, y: h },
            counterLocal: { x: panel.slant, y: 0 },
            field: 'offsetD' as const,
            valueFromX: (lx: number) => lx
        }
    ]

    const cornersV = [
        {
            key: 'TL' as CornerKeyV,
            local: { x: 0, y: panel.slant },
            counterLocal: { x: w, y: panel.offsetD },
            field: 'slant' as const,
            valueFromY: (ly: number) => ly
        },
        {
            key: 'TR' as CornerKeyV,
            local: { x: w, y: panel.offsetD },
            counterLocal: { x: 0, y: panel.slant },
            field: 'offsetD' as const,
            valueFromY: (ly: number) => ly
        },
        {
            key: 'BR' as CornerKeyV,
            local: { x: w, y: h + panel.offsetC },
            counterLocal: { x: 0, y: h + panel.offsetB },
            field: 'offsetC' as const,
            valueFromY: (ly: number) => ly - h
        },
        {
            key: 'BL' as CornerKeyV,
            local: { x: 0, y: h + panel.offsetB },
            counterLocal: { x: w, y: h + panel.offsetC },
            field: 'offsetB' as const,
            valueFromY: (ly: number) => ly - h
        }
    ]

    const otherEdges = siblings.flatMap((p) => getDiagonalEdges(p))

    const applyHorizontal = (
        corner: typeof cornersH[number],
        rawLocalX: number,
        finalize: boolean
    ): void => {
        const cornerAbs = { x: panel.x + rawLocalX, y: panel.y + corner.local.y }
        const counterAbs = { x: panel.x + corner.counterLocal.x, y: panel.y + corner.counterLocal.y }
        let snappedLocalX = rawLocalX
        const result = computeParallelAlignment({ start: cornerAbs, end: counterAbs }, otherEdges)
        if (result.matchedEdge) {
            const newAbsX = snapCornerXForAngle(cornerAbs.y, counterAbs, result.matchedEdge.angle)
            if (newAbsX !== null) snappedLocalX = newAbsX - panel.x
        }
        const value = Math.round(corner.valueFromX(snappedLocalX))
        onUpdate(panel.id, { [corner.field]: value } as Partial<Panel>, finalize)
        setActiveParallelGuides(result.guides)
        if (finalize) clearActiveAlignmentGuides()
    }

    const applyVertical = (
        corner: typeof cornersV[number],
        rawLocalY: number,
        finalize: boolean
    ): void => {
        const cornerAbs = { x: panel.x + corner.local.x, y: panel.y + rawLocalY }
        const counterAbs = { x: panel.x + corner.counterLocal.x, y: panel.y + corner.counterLocal.y }
        let snappedLocalY = rawLocalY
        const result = computeParallelAlignment({ start: cornerAbs, end: counterAbs }, otherEdges)
        if (result.matchedEdge) {
            const newAbsY = snapCornerYForAngle(cornerAbs.x, counterAbs, result.matchedEdge.angle)
            if (newAbsY !== null) snappedLocalY = newAbsY - panel.y
        }
        const value = Math.round(corner.valueFromY(snappedLocalY))
        onUpdate(panel.id, { [corner.field]: value } as Partial<Panel>, finalize)
        setActiveParallelGuides(result.guides)
        if (finalize) clearActiveAlignmentGuides()
    }

    if (panel.type === 'trapezoid-h') {
        return (
            <>
                {cornersH.map((c) => (
                    <Ring
                        key={c.key}
                        x={c.local.x}
                        y={c.local.y}
                        {...HANDLE_PROPS}
                        draggable
                        onDragStart={(e) => { e.cancelBubble = true }}
                        onDragMove={(e: Konva.KonvaEventObject<DragEvent>) => {
                            e.cancelBubble = true
                            // Y は固定。X だけを使う
                            e.target.y(c.local.y)
                            applyHorizontal(c, e.target.x(), false)
                        }}
                        onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => {
                            e.cancelBubble = true
                            e.target.y(c.local.y)
                            applyHorizontal(c, e.target.x(), true)
                        }}
                    />
                ))}
            </>
        )
    }

    return (
        <>
            {cornersV.map((c) => (
                <Ring
                    key={c.key}
                    x={c.local.x}
                    y={c.local.y}
                    {...HANDLE_PROPS}
                    draggable
                    onDragStart={(e) => { e.cancelBubble = true }}
                    onDragMove={(e: Konva.KonvaEventObject<DragEvent>) => {
                        e.cancelBubble = true
                        e.target.x(c.local.x)
                        applyVertical(c, e.target.y(), false)
                    }}
                    onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => {
                        e.cancelBubble = true
                        e.target.x(c.local.x)
                        applyVertical(c, e.target.y(), true)
                    }}
                />
            ))}
        </>
    )
}
