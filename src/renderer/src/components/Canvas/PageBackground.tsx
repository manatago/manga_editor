import React from 'react'
import { Line } from 'react-konva'
import Konva from 'konva'
import type { Page } from '../../store/useMangaStore'

type Props = {
    currentPage: Page | undefined
    canvasWidth: number
    canvasHeight: number
}

export const PageBackground: React.FC<Props> = ({ currentPage, canvasWidth, canvasHeight }) => {
    const bgType = currentPage?.bgGradientType || 'none'
    const bgColor = currentPage?.backgroundColor || '#ffffff'
    const bgOpacity = currentPage?.backgroundOpacity ?? 1
    const startColor = currentPage?.bgGradientStartColor || bgColor
    const endColor = currentPage?.bgGradientEndColor || '#ffffff'
    const rotation = (currentPage?.bgGradientRotation || 0) * Math.PI / 180

    const bgProps: Partial<Konva.LineConfig> = { opacity: bgOpacity }
    if (bgType === 'none') {
        bgProps.fill = bgColor
    } else if (bgType === 'linear') {
        const radius = Math.sqrt(canvasWidth ** 2 + canvasHeight ** 2) / 2
        const cx = canvasWidth / 2
        const cy = canvasHeight / 2
        bgProps.fillLinearGradientStartPoint = {
            x: cx - Math.cos(rotation) * radius,
            y: cy - Math.sin(rotation) * radius
        }
        bgProps.fillLinearGradientEndPoint = {
            x: cx + Math.cos(rotation) * radius,
            y: cy + Math.sin(rotation) * radius
        }
        bgProps.fillLinearGradientColorStops = [0, startColor, 1, endColor]
    } else if (bgType === 'radial') {
        const cx = canvasWidth / 2
        const cy = canvasHeight / 2
        const radius = Math.max(canvasWidth, canvasHeight) / 2
        bgProps.fillRadialGradientStartPoint = { x: cx, y: cy }
        bgProps.fillRadialGradientEndPoint = { x: cx, y: cy }
        bgProps.fillRadialGradientStartRadius = 0
        bgProps.fillRadialGradientEndRadius = radius
        bgProps.fillRadialGradientColorStops = [0, startColor, 1, endColor]
    }

    return (
        <Line
            points={[0, 0, canvasWidth, 0, canvasWidth, canvasHeight, 0, canvasHeight]}
            closed
            {...bgProps}
            listening={false}
        />
    )
}
