import React from 'react'
import { Group, Shape, Rect } from 'react-konva'
import type { MosaicRegion, MosaicType } from '../../store/types'

const FEATHER = 14

/**
 * Gradient-based feathered alpha mask (no CSS filter dependency).
 * Creates a canvas where center = opaque white, edges fade to transparent.
 */
function createFeatheredMask(w: number, h: number, feather: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, w)
    canvas.height = Math.max(1, h)
    const ctx = canvas.getContext('2d')!

    const f = Math.min(feather, w / 2 - 1, h / 2 - 1)

    // Center solid region
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(f, f, w - 2 * f, h - 2 * f)

    // Top edge
    const top = ctx.createLinearGradient(0, 0, 0, f)
    top.addColorStop(0, 'rgba(255,255,255,0)')
    top.addColorStop(1, 'rgba(255,255,255,1)')
    ctx.fillStyle = top
    ctx.fillRect(f, 0, w - 2 * f, f)

    // Bottom edge
    const bot = ctx.createLinearGradient(0, h - f, 0, h)
    bot.addColorStop(0, 'rgba(255,255,255,1)')
    bot.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = bot
    ctx.fillRect(f, h - f, w - 2 * f, f)

    // Left edge
    const left = ctx.createLinearGradient(0, 0, f, 0)
    left.addColorStop(0, 'rgba(255,255,255,0)')
    left.addColorStop(1, 'rgba(255,255,255,1)')
    ctx.fillStyle = left
    ctx.fillRect(0, f, f, h - 2 * f)

    // Right edge
    const right = ctx.createLinearGradient(w - f, 0, w, 0)
    right.addColorStop(0, 'rgba(255,255,255,1)')
    right.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = right
    ctx.fillRect(w - f, f, f, h - 2 * f)

    // Corners (radial)
    const cornerDefs = [
        { cx: f, cy: f, rx: 0, ry: 0, rw: f, rh: f },
        { cx: w - f, cy: f, rx: w - f, ry: 0, rw: f, rh: f },
        { cx: f, cy: h - f, rx: 0, ry: h - f, rw: f, rh: f },
        { cx: w - f, cy: h - f, rx: w - f, ry: h - f, rw: f, rh: f }
    ]
    for (const c of cornerDefs) {
        const grad = ctx.createRadialGradient(c.cx, c.cy, 0, c.cx, c.cy, f)
        grad.addColorStop(0, 'rgba(255,255,255,1)')
        grad.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.save()
        ctx.beginPath()
        ctx.rect(c.rx, c.ry, f, f)
        ctx.clip()
        ctx.fillStyle = grad
        ctx.fillRect(c.rx, c.ry, f, f)
        ctx.restore()
    }

    return canvas
}

function drawPixelPattern(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    blockSize: number,
    globalX: number,
    globalY: number
) {
    // Global grid alignment: offset so adjacent regions share grid lines
    const offX = ((globalX % blockSize) + blockSize) % blockSize
    const offY = ((globalY % blockSize) + blockSize) % blockSize

    for (let gy = -offY; gy < h; gy += blockSize) {
        for (let gx = -offX; gx < w; gx += blockSize) {
            const col = Math.floor((gx + offX) / blockSize)
            const row = Math.floor((gy + offY) / blockSize)
            const shade = (col + row) % 2 === 0 ? 190 : 155
            ctx.fillStyle = `rgb(${shade},${shade},${shade})`
            ctx.fillRect(gx, gy, blockSize, blockSize)
        }
    }
}

interface MosaicItemProps {
    region: MosaicRegion
    mosaicType: MosaicType
    isSelected: boolean
    onSelect: (id: string) => void
    isExporting: boolean
}

export const MosaicItem: React.FC<MosaicItemProps> = ({
    region,
    mosaicType,
    isSelected,
    onSelect,
    isExporting
}) => {
    const { x, y, width: w, height: h } = region

    if (mosaicType === 'none') {
        // Invisible in export; show a dashed outline in editor
        if (isExporting) return null
        return (
            <Rect
                x={x}
                y={y}
                width={w}
                height={h}
                stroke={isSelected ? '#3b82f6' : '#64748b'}
                strokeWidth={1}
                dash={[5, 4]}
                fill="rgba(100,120,255,0.05)"
                listening={true}
                onClick={() => onSelect(region.id)}
                onTap={() => onSelect(region.id)}
            />
        )
    }

    return (
        <Group x={x} y={y}>
            {/* Visual effect */}
            <Shape
                width={w}
                height={h}
                listening={false}
                perfectDrawEnabled={false}
                sceneFunc={(ctx, shape) => {
                    const rawCtx = (ctx as any)._context as CanvasRenderingContext2D
                    const sw = shape.width()
                    const sh = shape.height()

                    // Create pattern on offscreen canvas
                    const off = document.createElement('canvas')
                    off.width = Math.max(1, sw)
                    off.height = Math.max(1, sh)
                    const octx = off.getContext('2d')!

                    if (mosaicType === 'pixel-4') {
                        drawPixelPattern(octx, sw, sh, 4, x, y)
                    } else if (mosaicType === 'pixel-12') {
                        drawPixelPattern(octx, sw, sh, 12, x, y)
                    } else if (mosaicType === 'frosted') {
                        octx.fillStyle = 'rgba(210, 225, 240, 0.92)'
                        octx.fillRect(0, 0, sw, sh)
                    } else if (mosaicType === 'white-blur') {
                        octx.fillStyle = '#ffffff'
                        octx.fillRect(0, 0, sw, sh)
                    }

                    // Apply feathered alpha mask
                    const mask = createFeatheredMask(sw, sh, FEATHER)
                    octx.globalCompositeOperation = 'destination-in'
                    octx.drawImage(mask, 0, 0)
                    octx.globalCompositeOperation = 'source-over'

                    rawCtx.drawImage(off, 0, 0)
                }}
            />
            {/* Interaction handle (editor only) */}
            {!isExporting && (
                <Rect
                    width={w}
                    height={h}
                    fill="transparent"
                    stroke={isSelected ? '#3b82f6' : 'transparent'}
                    strokeWidth={isSelected ? 2 : 0}
                    dash={isSelected ? [6, 3] : undefined}
                    listening={true}
                    onClick={() => onSelect(region.id)}
                    onTap={() => onSelect(region.id)}
                />
            )}
        </Group>
    )
}
