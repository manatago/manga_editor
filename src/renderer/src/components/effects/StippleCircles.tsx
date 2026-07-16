import React from 'react'
import { Group, Shape } from 'react-konva'
import { Panel } from '../../store/useMangaStore'

/**
 * 点描（砂目）サークル。漫画でよくある「円の内側は完全に空（白抜き）で、円の外側・
 * とくに縁のすぐ外に点が集中し、外へ向かってフェードする」表現。円は重なって配置される。
 * 点は下側ほど濃い（上からの光）。
 *
 * 大量の点を打つため、多数の Konva ノードではなく 1 つの Shape の sceneFunc で
 * 生 canvas に直接 fillRect する（軽量）。panel.id をシードに固定生成しちらつかない。
 */
export const StippleCircles: React.FC<{ panel: Panel; points: number[] }> = ({ panel, points }) => {
    if (!panel.hasDotCircles) return null
    if (!points || points.length < 6) return null

    const width = panel.width || 1
    const height = panel.height || 1
    const opacity = panel.dotCircleOpacity ?? 0.85
    const count = Math.min(Math.max(1, panel.dotCircleCount ?? 8), 60)

    // panel.id 由来の固定シード + ユーザー指定シード（変えると配置が変わる）
    const seed =
        panel.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + (panel.dotCircleSeed ?? 0) * 101.3
    const rnd = (s: number): number => {
        const x = Math.sin(s) * 10000
        return x - Math.floor(x)
    }

    // 円のパラメータを事前生成（中心・半径・個別シード）
    const minDim = Math.min(width, height)
    const sizeScale = panel.dotCircleSize ?? 0.5
    const circles = Array.from({ length: count }, (_, i) => ({
        cx: rnd(seed + i * 3.1) * width,
        cy: rnd(seed + i * 3.7 + 11) * height,
        // 半径は 12%〜34% の範囲でばらつき、サイズ倍率で全体を拡縮
        r: (0.12 + rnd(seed + i * 2.3 + 5) * 0.22) * minDim * sizeScale,
        k: seed + i * 131.1
    }))

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
                    // 生 canvas に直接描く（点が多いのでノード化せず高速に）
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const c: CanvasRenderingContext2D = (context as any)._context
                    c.save()
                    c.fillStyle = '#111'
                    for (const circle of circles) {
                        const R = circle.r
                        // 縁の周長に比例した点数（面積ではないのでリングになる）
                        const samples = Math.min(3500, Math.max(60, Math.floor(2 * Math.PI * R * 2.6)))
                        // 縁の外側へどこまで点が広がるか（縁に密集し外へフェード）
                        const bandOut = R * 0.3
                        for (let j = 0; j < samples; j++) {
                            const a = rnd(circle.k + j * 2.9 + 1) * Math.PI * 2
                            const u = rnd(circle.k + j * 1.7)
                            // 円の外側だけ。u^4 で縁のすぐ外により強く密集させ、外へ急速にフェード。
                            const rr = R + bandOut * (u * u * u * u)
                            // 上から光→下側(sin(a)>0)ほど濃い
                            const shade = 0.22 + 0.78 * (0.5 + 0.5 * Math.sin(a))
                            const keep = shade * opacity
                            if (rnd(circle.k + j * 5.3 + 2) > keep) continue
                            const px = circle.cx + Math.cos(a) * rr
                            const py = circle.cy + Math.sin(a) * rr
                            const size = rnd(circle.k + j * 3.3 + 4) < 0.22 ? 1.3 : 0.8
                            c.fillRect(px, py, size, size)
                        }
                    }
                    c.restore()
                }}
            />
        </Group>
    )
}
