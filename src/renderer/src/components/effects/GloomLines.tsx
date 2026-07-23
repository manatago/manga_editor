import React from 'react'
import { Group, Line } from 'react-konva'
import { Panel } from '../../store/useMangaStore'
import { hashStringSeed, sinRandom } from '../../utils/seededRandom'

/**
 * ドヨーン（憂鬱）エフェクト。漫画でよくある「人物の頭上から下に向かって
 * 細い縦線がたくさん垂れている」表現。コマ上端から下へ、長さをばらつかせた
 * 細い縦線を並べる。panel.id をシードにした擬似乱数で固定生成し、ちらつかない。
 */
export const GloomLines: React.FC<{ panel: Panel; points: number[] }> = ({ panel, points }) => {
    if (!panel.hasGloomLines) return null
    if (!points || points.length < 6) return null

    const width = panel.width || 1
    const height = panel.height || 1
    const opacity = panel.gloomLineOpacity ?? 0.6
    const lineCount = Math.min(Math.max(10, panel.gloomLineDensity ?? 60), 400)
    // 線がどこまで垂れ下がるか（コマ高さに対する割合）
    const lengthFrac = Math.min(Math.max(0.1, panel.gloomLineLength ?? 0.6), 1)

    const seed = hashStringSeed(panel.id)
    const random = sinRandom

    const shapes: React.ReactNode[] = []
    for (let i = 0; i < lineCount; i++) {
        const x = random(seed + i) * width
        // 上端からの垂れ下がる長さ（基準割合の 55%〜100% でばらつかせる）
        const len = height * lengthFrac * (0.55 + random(seed + i + 500) * 0.45)
        // 細い線。1px 前後
        const thickness = 0.5 + random(seed + i + 1000) * 0.9
        const op = opacity * (0.4 + random(seed + i + 1500) * 0.6)
        const poly = [x, 0, x, len]
        if (poly.some((n) => isNaN(n))) continue
        shapes.push(
            <Line
                key={i}
                points={poly}
                stroke="black"
                strokeWidth={thickness}
                opacity={op}
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
            {shapes}
        </Group>
    )
}
