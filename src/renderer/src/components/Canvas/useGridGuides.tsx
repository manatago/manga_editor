import React, { useMemo } from 'react'
import { Line } from 'react-konva'
import type { Page } from '../../store/useMangaStore'
import { snapToGrid } from '../../utils/gridUtils'

type SelectedTarget = { x: number; y: number; width: number; height: number } | null | undefined

type Args = {
    currentPage: Page | undefined
    canvasWidth: number
    canvasHeight: number
    selectedPanel: SelectedTarget
    selectedBubble: SelectedTarget
    selectedMaterial: SelectedTarget
}

export function useGridGuides({
    currentPage,
    canvasWidth,
    canvasHeight,
    selectedPanel,
    selectedBubble,
    selectedMaterial
}: Args): { gridLines: React.ReactNode[]; snapGuides: React.ReactNode[] } {
    const showGrid = !!currentPage?.gridEnabled
    const gridSize = Math.max(8, Number(currentPage?.gridSize ?? 24))
    const snap = (value: number): number => snapToGrid(value, currentPage)

    const gridLines = useMemo(() => {
        if (!showGrid) return []
        const lines: React.ReactNode[] = []
        for (let x = gridSize; x < canvasWidth; x += gridSize) {
            lines.push(
                <Line
                    key={`grid-v-${x}`}
                    points={[x, 0, x, canvasHeight]}
                    stroke="rgba(0,0,0,0.08)"
                    strokeWidth={1}
                    listening={false}
                />
            )
        }
        for (let y = gridSize; y < canvasHeight; y += gridSize) {
            lines.push(
                <Line
                    key={`grid-h-${y}`}
                    points={[0, y, canvasWidth, y]}
                    stroke="rgba(0,0,0,0.08)"
                    strokeWidth={1}
                    listening={false}
                />
            )
        }
        return lines
    }, [showGrid, gridSize, canvasWidth, canvasHeight])

    const snapGuides = useMemo(() => {
        if (!showGrid) return []
        const target =
            (selectedPanel ? { x: selectedPanel.x, y: selectedPanel.y, width: selectedPanel.width, height: selectedPanel.height } : null) ||
            (selectedBubble ? { x: selectedBubble.x, y: selectedBubble.y, width: selectedBubble.width, height: selectedBubble.height } : null) ||
            (selectedMaterial ? { x: selectedMaterial.x, y: selectedMaterial.y, width: selectedMaterial.width, height: selectedMaterial.height } : null)
        if (!target) return []

        const x1 = snap(target.x)
        const y1 = snap(target.y)
        const x2 = snap(target.x + target.width)
        const y2 = snap(target.y + target.height)
        const cx = snap(target.x + target.width / 2)
        const cy = snap(target.y + target.height / 2)

        return [
            <Line key="guide-v-left" points={[x1, 0, x1, canvasHeight]} stroke="rgba(59,130,246,0.8)" strokeWidth={1} dash={[6, 4]} listening={false} />,
            <Line key="guide-v-right" points={[x2, 0, x2, canvasHeight]} stroke="rgba(59,130,246,0.8)" strokeWidth={1} dash={[6, 4]} listening={false} />,
            <Line key="guide-h-top" points={[0, y1, canvasWidth, y1]} stroke="rgba(59,130,246,0.8)" strokeWidth={1} dash={[6, 4]} listening={false} />,
            <Line key="guide-h-bottom" points={[0, y2, canvasWidth, y2]} stroke="rgba(59,130,246,0.8)" strokeWidth={1} dash={[6, 4]} listening={false} />,
            <Line key="guide-v-center" points={[cx, 0, cx, canvasHeight]} stroke="rgba(34,197,94,0.85)" strokeWidth={1} dash={[3, 5]} listening={false} />,
            <Line key="guide-h-center" points={[0, cy, canvasWidth, cy]} stroke="rgba(34,197,94,0.85)" strokeWidth={1} dash={[3, 5]} listening={false} />
        ]
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showGrid, selectedPanel, selectedBubble, selectedMaterial, canvasWidth, canvasHeight, gridSize])

    return { gridLines, snapGuides }
}
