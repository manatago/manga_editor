import React from 'react'
import { Rect } from 'react-konva'
import type { FadeDirection } from '../../store/types'
import { getGradientPoints, toTransparent } from './fadeUtils'

interface ToneFadeOverlayProps {
    width: number
    height: number
    fadeDirections: FadeDirection[]
    fadeStrength: number
    /** フェードが消えていく先の色（コマ背景色）*/
    backgroundColor: string
}

export const ToneFadeOverlay: React.FC<ToneFadeOverlayProps> = ({
    width, height, fadeDirections, fadeStrength, backgroundColor
}) => {
    const dirs = fadeDirections.filter((d) => d !== 'none')
    if (dirs.length === 0) return null
    return (
        <>
            {dirs.map((dir) => {
                const pts = getGradientPoints(dir, width, height, fadeStrength)
                if (!pts) return null
                return (
                    <Rect
                        key={dir}
                        x={0}
                        y={0}
                        width={width}
                        height={height}
                        fillLinearGradientStartPoint={pts.start}
                        fillLinearGradientEndPoint={pts.end}
                        fillLinearGradientColorStops={[0, backgroundColor, 1, toTransparent(backgroundColor)]}
                        listening={false}
                    />
                )
            })}
        </>
    )
}
