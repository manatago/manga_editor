import React from 'react'
import { Group, Circle, Arc } from 'react-konva'
import { Panel } from '../../store/useMangaStore'
import { hashStringSeed, sinRandom } from '../../utils/seededRandom'

/**
 * シャボン玉エフェクト。半透明の円をふわりと浮かべ、上部にハイライトを添える。
 * panel.id をシードにした擬似乱数で固定生成し、再描画のちらつきを防ぐ。
 */
export const SoapBubbles: React.FC<{ panel: Panel; points: number[] }> = ({ panel, points }) => {
    if (!panel.hasBubbleEffect) return null
    if (!points || points.length < 6) return null

    const width = panel.width || 1
    const height = panel.height || 1
    const opacity = panel.bubbleEffectOpacity ?? 0.5
    const count = Math.min(Math.max(3, panel.bubbleEffectDensity ?? 20), 200)

    const seed = hashStringSeed(panel.id)
    const random = sinRandom

    const shapes: React.ReactNode[] = []
    for (let i = 0; i < count; i++) {
        const cx = random(seed + i) * width
        const cy = random(seed + i + 100) * height
        const r = 6 + random(seed + i + 200) * Math.min(48, Math.max(width, height) * 0.12)
        if (isNaN(cx) || isNaN(cy) || isNaN(r)) continue
        const ringOp = opacity * (0.6 + random(seed + i + 300) * 0.4)

        // 白黒漫画でも見えるよう線画寄りに: 濃い輪郭線 + 縁の陰り + 白ハイライト（艶）+ 反対側の弧
        shapes.push(
            <Group key={i} listening={false}>
                {/* 縁に向かって暗くなる陰り（球体感・白背景でも縁が見える） */}
                <Circle
                    x={cx}
                    y={cy}
                    radius={r}
                    fillRadialGradientStartPoint={{ x: 0, y: 0 }}
                    fillRadialGradientEndPoint={{ x: 0, y: 0 }}
                    fillRadialGradientStartRadius={0}
                    fillRadialGradientEndRadius={r}
                    fillRadialGradientColorStops={[
                        0,
                        'rgba(0,0,0,0)',
                        0.7,
                        'rgba(0,0,0,0)',
                        1,
                        `rgba(30,30,30,${0.28 * opacity})`
                    ]}
                    // 濃いめの輪郭線（白地の漫画でもはっきり見える）
                    stroke={`rgba(25,25,25,${ringOp})`}
                    strokeWidth={1.2}
                />
                {/* 左上の艶ハイライト（トーン/濃い背景で映える） */}
                <Circle
                    x={cx - r * 0.34}
                    y={cy - r * 0.36}
                    radius={Math.max(1, r * 0.16)}
                    fill="white"
                    opacity={Math.min(1, ringOp + 0.2)}
                />
                {/* 左上の細い反射弧（シャボン玉らしさ） */}
                <Arc
                    x={cx}
                    y={cy}
                    innerRadius={r * 0.62}
                    outerRadius={r * 0.68}
                    angle={60}
                    rotation={200}
                    fill={`rgba(255,255,255,${0.55 * opacity})`}
                />
            </Group>
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
