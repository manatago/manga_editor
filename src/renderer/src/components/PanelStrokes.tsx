import React from 'react'
import { Group, Line } from 'react-konva'
import { Panel } from '../store/useMangaStore'
import type { FadeDirection, Page } from '../store/types'

export const PanelStrokes: React.FC<{ panel: Panel; points: number[]; page: Page }> = ({ panel, points, page }) => {
    const strokeColor = panel.strokeColor ?? 'black'
    if (!points || points.length !== 8) {
        return <Line points={points} closed={true} stroke={strokeColor} strokeWidth={panel.strokeWidth} />
    }

    // 複数方向対応: fadeDirections 優先、旧 fadeDirection にフォールバック
    const dirs: FadeDirection[] =
        panel.fadeDirections && panel.fadeDirections.length > 0
            ? panel.fadeDirections.filter((d) => d !== 'none')
            : panel.fadeDirection && panel.fadeDirection !== 'none'
            ? [panel.fadeDirection]
            : []

    if (dirs.length === 0) {
        return <Line points={points} closed={true} stroke={strokeColor} strokeWidth={panel.strokeWidth} />
    }

    const has = (d: FadeDirection) => dirs.includes(d)
    const fadeTop = has('top') || has('top-left') || has('top-right')
    const fadeRight = has('right') || has('top-right') || has('bottom-right')
    const fadeBottom = has('bottom') || has('bottom-left') || has('bottom-right')
    const fadeLeft = has('left') || has('top-left') || has('bottom-left')

    const bg = page?.backgroundColor || '#ffffff'
    const sw = panel.strokeWidth
    // fadeStrength: ストロークのフェード比率（0.1〜0.5）。両端フェードでもフルカラー区間が残るよう 0.5 でクランプ
    const t = Math.min(0.5, Math.max(0.05, panel.fadeStrength ?? 0.4))

    const Segment = ({ p, fadeStart, fadeEnd }: { p: number[]; fadeStart: boolean; fadeEnd: boolean }) => {
        if (!fadeStart && !fadeEnd) {
            return <Line points={p} stroke={strokeColor} strokeWidth={sw} />
        }
        const gStart = { x: p[0], y: p[1] }
        const gEnd = { x: p[2], y: p[3] }
        let stops: (number | string)[]
        if (fadeStart && fadeEnd) {
            stops = [0, bg, t, strokeColor, 1 - t, strokeColor, 1, bg]
        } else if (fadeStart) {
            stops = [0, bg, t, strokeColor, 1, strokeColor]
        } else {
            stops = [0, strokeColor, 1 - t, strokeColor, 1, bg]
        }
        return (
            <Line
                points={p}
                stroke={strokeColor}
                strokeWidth={sw}
                strokeLinearGradientStartPoint={gStart}
                strokeLinearGradientEndPoint={gEnd}
                strokeLinearGradientColorStops={stops}
            />
        )
    }

    // 各辺: start 側が隣接辺がフェード中なら fadeStart=true、end 側も同様
    return (
        <Group>
            {!fadeTop && (
                <Segment
                    p={[points[0], points[1], points[2], points[3]]}
                    fadeStart={fadeLeft}
                    fadeEnd={fadeRight}
                />
            )}
            {!fadeRight && (
                <Segment
                    p={[points[2], points[3], points[4], points[5]]}
                    fadeStart={fadeTop}
                    fadeEnd={fadeBottom}
                />
            )}
            {!fadeBottom && (
                <Segment
                    p={[points[4], points[5], points[6], points[7]]}
                    fadeStart={fadeRight}
                    fadeEnd={fadeLeft}
                />
            )}
            {!fadeLeft && (
                <Segment
                    p={[points[6], points[7], points[0], points[1]]}
                    fadeStart={fadeBottom}
                    fadeEnd={fadeTop}
                />
            )}
        </Group>
    )
}
