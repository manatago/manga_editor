import React from 'react'
import { Group, Line } from 'react-konva'
import { Panel } from '../../store/useMangaStore'

export const FocusLines: React.FC<{ panel: Panel; points: number[] }> = ({ panel, points }) => {
    if (!panel.hasFocusLines) return null
    if (!points || points.length < 6) return null

    const width = panel.width || 1
    const height = panel.height || 1
    const cx = width * (panel.focusCenterX ?? 0.5)
    const cy = height * (panel.focusCenterY ?? 0.5)

    if (isNaN(cx) || isNaN(cy)) return null

    const lineCount = Math.min(Math.max(10, panel.focusDensity ?? 100), 1000)
    const shapes: React.ReactNode[] = []
    const radius = Math.max(width, height) * 2.5
    const fWidth = panel.focusWidth ?? 1
    const fRadius = panel.focusRadius ?? 50

    for (let i = 0; i < lineCount; i++) {
        const angle = (i / lineCount) * Math.PI * 2
        const jitter = (Math.random() - 0.5) * (0.2 / (lineCount / 100))
        const currentAngle = angle + jitter
        const r1 = fRadius + Math.random() * radius * 0.1
        const r2 = radius * 1.5
        const baseWidth = (fWidth * (2 + Math.random() * 3)) * (100 / lineCount)
        const perpAngle = currentAngle + Math.PI / 2
        const x1 = cx + Math.cos(currentAngle) * r1
        const y1 = cy + Math.sin(currentAngle) * r1
        const bx = cx + Math.cos(currentAngle) * r2
        const by = cy + Math.sin(currentAngle) * r2
        const x2 = bx + Math.cos(perpAngle) * baseWidth
        const y2 = by + Math.sin(perpAngle) * baseWidth
        const x3 = bx - Math.cos(perpAngle) * baseWidth
        const y3 = by - Math.sin(perpAngle) * baseWidth

        if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2) || isNaN(x3) || isNaN(y3)) continue

        shapes.push(
            <Line
                key={i}
                points={[x1, y1, x2, y2, x3, y3]}
                closed={true}
                fill="black"
                opacity={0.7 + Math.random() * 0.3}
            />
        )
    }

    return (
        <Group
            clipFunc={(ctx) => {
                ctx.beginPath()
                ctx.moveTo(points[0], points[1])
                for (let i = 2; i < points.length; i += 2) {
                    ctx.lineTo(points[i], points[i + 1])
                }
                ctx.closePath()
            }}
            listening={false}
        >
            <Group opacity={1}>
                {shapes}
            </Group>
        </Group>
    )
}
