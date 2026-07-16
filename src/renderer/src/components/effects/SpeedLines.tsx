import React from 'react'
import { Group, Line } from 'react-konva'
import { Panel } from '../../store/useMangaStore'

/**
 * スピード線（流線）エフェクト。漫画でよくある「横にバーっと入った線」。
 * 端がすぼまる（テーパーする）帯を平行に並べて疾走感を出す。方向は横／縦。
 * panel.id をシードにした擬似乱数で固定生成し、再描画のちらつきを防ぐ。
 */
export const SpeedLines: React.FC<{ panel: Panel; points: number[] }> = ({ panel, points }) => {
    if (!panel.hasSpeedLines) return null
    if (!points || points.length < 6) return null

    const width = panel.width || 1
    const height = panel.height || 1
    const opacity = panel.speedLineOpacity ?? 0.85
    const vertical = panel.speedLineDirection === 'vertical'
    const lineCount = Math.min(Math.max(10, panel.speedLineDensity ?? 120), 800)

    const seed = panel.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const random = (s: number): number => {
        const x = Math.sin(s) * 10000
        return x - Math.floor(x)
    }

    // 主方向の全長（横なら幅、縦なら高さ）と直交方向の広がり
    const span = vertical ? height : width
    const cross = vertical ? width : height

    const shapes: React.ReactNode[] = []
    for (let i = 0; i < lineCount; i++) {
        // 直交方向の位置（線が並ぶ位置）
        const pos = random(seed + i) * cross
        // 帯の太さ（端は 0 にすぼめる）
        const thickness = 0.6 + random(seed + i + 100) * 2.6
        // 主方向にランダムな開始点・長さ（全部は貫かず、疎密を作る）
        const startFrac = random(seed + i + 200) * 0.35
        const lenFrac = 0.55 + random(seed + i + 300) * 0.45
        const a = startFrac * span
        const b = Math.min(span, a + lenFrac * span)
        const op = opacity * (0.45 + random(seed + i + 400) * 0.55)

        // 先すぼまりの三角帯（開始側を尖らせ、終端側を太く）
        let poly: number[]
        if (vertical) {
            poly = [pos, a, pos - thickness, b, pos + thickness, b]
        } else {
            poly = [a, pos, b, pos - thickness, b, pos + thickness]
        }
        if (poly.some((n) => isNaN(n))) continue

        shapes.push(<Line key={i} points={poly} closed fill="black" opacity={op} listening={false} />)
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
