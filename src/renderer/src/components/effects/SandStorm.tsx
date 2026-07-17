import React from 'react'
import { Group, Shape } from 'react-konva'
import { Panel } from '../../store/useMangaStore'
import { hashStringSeed, sinRandom } from '../../utils/seededRandom'

/**
 * 砂嵐（ノイズ）エフェクト。コマ全体に細かい点を一様に撒く、ざらついた質感。
 * 大量の点なので 1 つの Shape の sceneFunc で生 canvas に直接描く（軽量）。
 * panel.id をシードに固定生成しちらつかない。
 */
export const SandStorm: React.FC<{ panel: Panel; points: number[] }> = ({ panel, points }) => {
    if (!panel.hasSandStorm) return null
    if (!points || points.length < 6) return null

    const width = panel.width || 1
    const height = panel.height || 1
    // 密度: 面積あたりの点の割合（0..1 相当）。既定 0.5。
    const density = panel.sandStormDensity ?? 0.5
    const opacity = panel.sandStormOpacity ?? 0.6

    const seed = hashStringSeed(panel.id)
    const rnd = sinRandom

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
            <Shape
                listening={false}
                sceneFunc={(context) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const c: CanvasRenderingContext2D = (context as any)._context
                    // 点数 = 面積 × 密度係数（上限つき）
                    const samples = Math.min(120000, Math.floor(width * height * 0.25 * density))
                    c.save()
                    c.fillStyle = '#111'
                    for (let j = 0; j < samples; j++) {
                        // 濃さ(opacity)を確率で間引いて反映
                        if (rnd(seed + j * 5.3 + 2) > opacity) continue
                        const px = rnd(seed + j * 1.7) * width
                        const py = rnd(seed + j * 2.9 + 1) * height
                        const size = rnd(seed + j * 3.3 + 4) < 0.15 ? 1.2 : 0.8
                        c.fillRect(px, py, size, size)
                    }
                    c.restore()
                }}
            />
        </Group>
    )
}
