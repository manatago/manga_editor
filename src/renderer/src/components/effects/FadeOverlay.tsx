import React from 'react'
import { Line } from 'react-konva'
import { Panel } from '../../store/useMangaStore'

export const FadeOverlay: React.FC<{ panel: Panel; points: number[]; backgroundColor: string }> = ({ panel, points, backgroundColor }) => {
    if (!panel.fadeDirection || panel.fadeDirection === 'none') return null
    if (!points || points.length < 6) return null

    const width = panel.width || 1
    const height = panel.height || 1
    const strength = panel.fadeStrength ?? 0.4
    let start = { x: 0, y: 0 }
    let end = { x: 0, y: 0 }

    switch (panel.fadeDirection) {
        case 'top':
            start = { x: width / 2, y: 0 }
            end = { x: width / 2, y: height * strength }
            break
        case 'bottom':
            start = { x: width / 2, y: height }
            end = { x: width / 2, y: height * (1 - strength) }
            break
        case 'left':
            start = { x: 0, y: height / 2 }
            end = { x: width * strength, y: height / 2 }
            break
        case 'right':
            start = { x: width, y: height / 2 }
            end = { x: width * (1 - strength), y: height / 2 }
            break
        case 'top-left':
            start = { x: 0, y: 0 }
            end = { x: width * strength, y: height * strength }
            break
        case 'top-right':
            start = { x: width, y: 0 }
            end = { x: width * (1 - strength), y: height * strength }
            break
        case 'bottom-left':
            start = { x: 0, y: height }
            end = { x: width * strength, y: height * (1 - strength) }
            break
        case 'bottom-right':
            start = { x: width, y: height }
            end = { x: width * (1 - strength), y: height * (1 - strength) }
            break
        default:
            start = { x: width / 2, y: 0 }
            end = { x: width / 2, y: height * strength }
            break
    }

    if (isNaN(start.x) || isNaN(start.y) || isNaN(end.x) || isNaN(end.y)) return null

    return (
        <Line
            points={points}
            closed={true}
            fillLinearGradientStartPoint={start}
            fillLinearGradientEndPoint={end}
            fillLinearGradientColorStops={[0, backgroundColor, 1, 'rgba(255, 255, 255, 0)']}
            listening={false}
        />
    )
}
