import React from 'react'
import { Group, Ring } from 'react-konva'
import type { Panel } from '../store/useMangaStore'
import type { Page } from '../store/types'
import { useMangaStore } from '../store/useMangaStore'
import {
    computeParallelAlignment,
    getDiagonalEdges,
    snapCornerXForAngle
} from '../utils/edgeAlignment'
import { TrapezoidHandles } from './TrapezoidHandles'

interface Props {
    panel: Panel
    page: Page
    onUpdate: (id: string, updates: Partial<Panel>, undoable?: boolean) => void
}

/**
 * 選択中パネルの角ハンドル（slanted / trapezoid-h / trapezoid-v）を最前面に描く専用レイヤー。
 * 通常 PanelItem の interaction pass に置いていたが、吹き出しの interaction ノードより手前に
 * 来てほしいので Canvas 側で吹き出し／素材の後に呼び出す。
 */
export const PanelSelectionHandles: React.FC<Props> = ({ panel, page, onUpdate }) => {
    const setActiveParallelGuides = useMangaStore((s) => s.setActiveParallelGuides)
    const clearActiveAlignmentGuides = useMangaStore((s) => s.clearActiveAlignmentGuides)

    if ((panel.rotation ?? 0) !== 0) return null
    if (panel.type !== 'slanted' && panel.type !== 'trapezoid-h' && panel.type !== 'trapezoid-v') {
        return null
    }

    const siblings = (page?.panels ?? []).filter((p) => p.id !== panel.id)

    return (
        <Group
            x={panel.x + panel.width / 2}
            y={panel.y + panel.height / 2}
            offsetX={panel.width / 2}
            offsetY={panel.height / 2}
            listening
        >
            {panel.type === 'slanted' && (() => {
                const otherEdges = siblings.flatMap(getDiagonalEdges)
                const applySlanted = (rawSlant: number, finalize: boolean): void => {
                    let nextSlant = rawSlant
                    if (otherEdges.length > 0) {
                        const leftStart = { x: panel.x + rawSlant, y: panel.y }
                        const leftEnd = { x: panel.x, y: panel.y + panel.height }
                        const result = computeParallelAlignment({ start: leftStart, end: leftEnd }, otherEdges)
                        if (result.matchedEdge) {
                            const newAbsX = snapCornerXForAngle(leftStart.y, leftEnd, result.matchedEdge.angle)
                            if (newAbsX !== null) nextSlant = Math.round(newAbsX - panel.x)
                        }
                        setActiveParallelGuides(result.guides)
                    } else {
                        setActiveParallelGuides([])
                    }
                    onUpdate(panel.id, { slant: nextSlant }, finalize)
                    if (finalize) clearActiveAlignmentGuides()
                }
                return (
                    <Ring
                        x={panel.slant}
                        y={0}
                        innerRadius={7}
                        outerRadius={10}
                        fill="#10b981"
                        stroke="white"
                        strokeWidth={1.5}
                        draggable
                        onDragStart={(e) => { e.cancelBubble = true }}
                        onDragMove={(e) => {
                            e.cancelBubble = true
                            e.target.y(0)
                            applySlanted(Math.round(e.target.x()), false)
                        }}
                        onDragEnd={(e) => {
                            e.cancelBubble = true
                            applySlanted(Math.round(e.target.x()), true)
                            e.target.x(panel.slant)
                            e.target.y(0)
                        }}
                    />
                )
            })()}
            {(panel.type === 'trapezoid-h' || panel.type === 'trapezoid-v') && (
                <TrapezoidHandles panel={panel} siblings={siblings} onUpdate={onUpdate} />
            )}
        </Group>
    )
}
