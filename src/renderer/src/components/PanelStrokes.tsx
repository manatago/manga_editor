import React from 'react'
import { Group, Line } from 'react-konva'
import { Panel } from '../store/useMangaStore'
import type { Page } from '../store/types'

export const PanelStrokes: React.FC<{ panel: Panel; points: number[]; page: Page }> = ({ panel, points, page }) => {
    const strokeColor = panel.strokeColor ?? 'black'
    if (!points || points.length !== 8) {
        return <Line points={points} closed={true} stroke={strokeColor} strokeWidth={panel.strokeWidth} />
    }
    if (!panel.fadeDirection || panel.fadeDirection === 'none') {
        return <Line points={points} closed={true} stroke={strokeColor} strokeWidth={panel.strokeWidth} />
    }

    const bg = page?.backgroundColor || '#ffffff'
    const sw = panel.strokeWidth
    const dir = panel.fadeDirection || 'none'
    const fadeTop = dir === 'top' || dir === 'top-left' || dir === 'top-right'
    const fadeRight = dir === 'right' || dir === 'top-right' || dir === 'bottom-right'
    const fadeBottom = dir === 'bottom' || dir === 'bottom-left' || dir === 'bottom-right'
    const fadeLeft = dir === 'left' || dir === 'top-left' || dir === 'bottom-left'

    const Segment = ({ p, fadeType }: { p: number[]; fadeType?: 'start' | 'end' }) => {
        if (!fadeType) return <Line points={p} stroke={strokeColor} strokeWidth={sw} />
        const gStart = { x: p[0], y: p[1] }
        const gEnd = { x: p[2], y: p[3] }
        const stops = fadeType === 'end' ? [0, strokeColor, 1, bg] : [0, bg, 1, strokeColor]
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

    return (
        <Group>
            {!fadeTop && (
                <Segment
                    p={[points[0], points[1], points[2], points[3]]}
                    fadeType={fadeLeft ? 'start' : (fadeRight ? 'end' : undefined)}
                />
            )}
            {!fadeRight && (
                <Segment
                    p={[points[2], points[3], points[4], points[5]]}
                    fadeType={fadeTop ? 'start' : (fadeBottom ? 'end' : undefined)}
                />
            )}
            {!fadeBottom && (
                <Segment
                    p={[points[4], points[5], points[6], points[7]]}
                    fadeType={fadeRight ? 'start' : (fadeLeft ? 'end' : undefined)}
                />
            )}
            {!fadeLeft && (
                <Segment
                    p={[points[6], points[7], points[0], points[1]]}
                    fadeType={fadeBottom ? 'start' : (fadeTop ? 'end' : undefined)}
                />
            )}
        </Group>
    )
}
