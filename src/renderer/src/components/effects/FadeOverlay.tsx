import React from 'react'
import { Line } from 'react-konva'
import { Panel } from '../../store/useMangaStore'
import type { FadeDirection } from '../../store/types'

function getGradientPoints(dir: FadeDirection, width: number, height: number, strength: number) {
    switch (dir) {
        case 'top':
            return { start: { x: width / 2, y: 0 }, end: { x: width / 2, y: height * strength } }
        case 'bottom':
            return { start: { x: width / 2, y: height }, end: { x: width / 2, y: height * (1 - strength) } }
        case 'left':
            return { start: { x: 0, y: height / 2 }, end: { x: width * strength, y: height / 2 } }
        case 'right':
            return { start: { x: width, y: height / 2 }, end: { x: width * (1 - strength), y: height / 2 } }
        case 'top-left':
            return { start: { x: 0, y: 0 }, end: { x: width * strength, y: height * strength } }
        case 'top-right':
            return { start: { x: width, y: 0 }, end: { x: width * (1 - strength), y: height * strength } }
        case 'bottom-left':
            return { start: { x: 0, y: height }, end: { x: width * strength, y: height * (1 - strength) } }
        case 'bottom-right':
            return { start: { x: width, y: height }, end: { x: width * (1 - strength), y: height * (1 - strength) } }
        default:
            return null
    }
}

export const FadeOverlay: React.FC<{ panel: Panel; points: number[]; backgroundColor: string }> = ({ panel, points, backgroundColor }) => {
    if (!points || points.length < 6) return null

    const width = panel.width || 1
    const height = panel.height || 1
    const strength = panel.fadeStrength ?? 0.4

    // fadeDirections が優先。なければ旧 fadeDirection から変換
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
