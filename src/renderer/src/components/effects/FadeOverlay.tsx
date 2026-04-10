import React from 'react'
import { Line } from 'react-konva'
import { Panel } from '../../store/useMangaStore'
import type { FadeDirection } from '../../store/types'
import { getGradientPoints } from './fadeUtils'

export const FadeOverlay: React.FC<{ panel: Panel; points: number[]; backgroundColor: string }> = ({ panel, points, backgroundColor }) => {
    if (!points || points.length < 6) return null

    const width = panel.width || 1
    const height = panel.height || 1
    const strength = panel.fadeStrength ?? 0.4

    const dirs: FadeDirection[] =
        panel.fadeDirections && panel.fadeDirections.length > 0
            ? panel.fadeDirections.filter((d) => d !== 'none')
            : panel.fadeDirection && panel.fadeDirection !== 'none'
            ? [panel.fadeDirection]
            : []

    if (dirs.length === 0) return null

    return (
        <>
            {dirs.map((dir) => {
                const pts = getGradientPoints(dir, width, height, strength)
                if (!pts) return null
                const { start, end } = pts
                if (isNaN(start.x) || isNaN(start.y) || isNaN(end.x) || isNaN(end.y)) return null
                return (
                    <Line
                        key={dir}
                        points={points}
                        closed={true}
                        fillLinearGradientStartPoint={start}
                        fillLinearGradientEndPoint={end}
                        fillLinearGradientColorStops={[0, backgroundColor, 1, 'rgba(255,255,255,0)']}
                        listening={false}
                    />
                )
            })}
        </>
    )
}
