import React from 'react'
import { Group, Line } from 'react-konva'
import { Panel } from '../../store/useMangaStore'
import { hashStringSeed, sinRandom } from '../../utils/seededRandom'

export const RainEffect: React.FC<{ panel: Panel; points: number[] }> = ({ panel, points }) => {
    if (!panel.hasRainEffect) return null
    if (!points || points.length < 6) return null

    const width = panel.width || 1
    const height = panel.height || 1
    const lineCount = Math.min(Math.max(10, panel.rainDensity ?? 100), 500)
    const opacity = panel.rainOpacity ?? 0.3

    // Generate fixed random lines based on panel id to avoid flickering
    const seed = hashStringSeed(panel.id)
    const random = sinRandom

    const lines: React.ReactNode[] = []
    for (let i = 0; i < lineCount; i++) {
        const x = random(seed + i) * width
        const yStart = random(seed + i + 100) * height
        const len = 10 + random(seed + i + 200) * 40
        const yEnd = yStart + len

        lines.push(
            <Line
                key={i}
                points={[x, yStart, x, yEnd]}
                stroke="black"
                strokeWidth={0.5 + random(seed + i + 300) * 1}
                opacity={opacity * (0.5 + random(seed + i + 400) * 0.5)}
                listening={false}
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
            {lines}
        </Group>
    )
}
