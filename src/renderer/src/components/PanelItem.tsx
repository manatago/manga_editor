import React, { useEffect, useRef } from 'react'
import Konva from 'konva'
import { Group, Line, Circle } from 'react-konva'
import useImage from 'use-image'
import { Panel } from '../store/useMangaStore'
import { getPanelPoints } from './utils/drawPaths'

const FadeOverlay: React.FC<{ panel: Panel; points: number[]; backgroundColor: string }> = ({ panel, points, backgroundColor }) => {
    if (!panel.fadeDirection || panel.fadeDirection === 'none') return null
    if (!points || points.length < 6) return null

    const width = panel.width || 1
    const height = panel.height || 1
    const fadeDirection = panel.fadeDirection
    let start = { x: 0, y: 0 }
    let end = { x: 0, y: 0 }

    const strength = panel.fadeStrength ?? 0.4

    switch (fadeDirection) {
        case 'top':
            start = { x: width / 2, y: 0 }; end = { x: width / 2, y: height * strength }; break
        case 'bottom':
            start = { x: width / 2, y: height }; end = { x: width / 2, y: height * (1 - strength) }; break
        case 'left':
            start = { x: 0, y: height / 2 }; end = { x: width * strength, y: height / 2 }; break
        case 'right':
            start = { x: width, y: height / 2 }; end = { x: width * (1 - strength), y: height / 2 }; break
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

const FocusLines: React.FC<{ panel: Panel; points: number[] }> = ({ panel, points }) => {
    if (!panel.hasFocusLines) return null
    if (!points || points.length < 6) return null

    const width = panel.width || 1
    const height = panel.height || 1
    const cx = width * (panel.focusCenterX ?? 0.5)
    const cy = height * (panel.focusCenterY ?? 0.5)

    if (isNaN(cx) || isNaN(cy)) return null

    const lineCount = Math.min(Math.max(10, panel.focusDensity ?? 100), 1000)
    const shapes: React.ReactNode[] = []
    const radius = Math.max(width, height) * 2.5
    const fWidth = panel.focusWidth ?? 1
    const fRadius = panel.focusRadius ?? 50

    for (let i = 0; i < lineCount; i++) {
        const angle = (i / lineCount) * Math.PI * 2
        const jitter = (Math.random() - 0.5) * (0.2 / (lineCount / 100))
        const currentAngle = angle + jitter
        const r1 = fRadius + Math.random() * radius * 0.1
        const r2 = radius * 1.5
        const baseWidth = (fWidth * (2 + Math.random() * 3)) * (100 / lineCount)
        const perpAngle = currentAngle + Math.PI / 2
        const x1 = cx + Math.cos(currentAngle) * r1
        const y1 = cy + Math.sin(currentAngle) * r1
        const bx = cx + Math.cos(currentAngle) * r2
        const by = cy + Math.sin(currentAngle) * r2
        const x2 = bx + Math.cos(perpAngle) * baseWidth
        const y2 = by + Math.sin(perpAngle) * baseWidth
        const x3 = bx - Math.cos(perpAngle) * baseWidth
        const y3 = by - Math.sin(perpAngle) * baseWidth

        if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2) || isNaN(x3) || isNaN(y3)) continue

        shapes.push(
            <Line
                key={i}
                points={[x1, y1, x2, y2, x3, y3]}
                closed={true}
                fill="black"
                opacity={0.7 + Math.random() * 0.3}
            />
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
            <Group opacity={1}>
                {shapes}
            </Group>
        </Group>
    )
}

const PanelStrokes: React.FC<{ panel: Panel; points: number[]; page: any }> = ({ panel, points, page }) => {
    if (!panel.fadeDirection || panel.fadeDirection === 'none') {
        return <Line points={points} closed={true} stroke="black" strokeWidth={panel.strokeWidth} />
    }

    const bg = page?.backgroundColor || '#ffffff'
    const sw = panel.strokeWidth

    const Segment = ({ p, fadeType }: { p: number[], fadeType?: 'start' | 'end' }) => {
        if (!fadeType) return <Line points={p} stroke="black" strokeWidth={sw} />
        let gStart = { x: p[0], y: p[1] }
        let gEnd = { x: p[2], y: p[3] }
        const stops = fadeType === 'end' ? [0, 'black', 1, bg] : [0, bg, 1, 'black']
        return (
            <Line
                points={p}
                stroke="black"
                strokeWidth={sw}
                strokeLinearGradientStartPoint={gStart}
                strokeLinearGradientEndPoint={gEnd}
                strokeLinearGradientColorStops={stops}
            />
        )
    }

    return (
        <Group>
            {panel.fadeDirection !== 'top' && (
                <Segment
                    p={[points[0], points[1], points[2], points[3]]}
                    fadeType={panel.fadeDirection === 'left' ? 'start' : (panel.fadeDirection === 'right' ? 'end' : undefined)}
                />
            )}
            {panel.fadeDirection !== 'right' && (
                <Segment
                    p={[points[2], points[3], points[4], points[5]]}
                    fadeType={panel.fadeDirection === 'top' ? 'start' : (panel.fadeDirection === 'bottom' ? 'end' : undefined)}
                />
            )}
            {panel.fadeDirection !== 'bottom' && (
                <Segment
                    p={[points[4], points[5], points[6], points[7]]}
                    fadeType={panel.fadeDirection === 'right' ? 'start' : (panel.fadeDirection === 'left' ? 'end' : undefined)}
                />
            )}
            {panel.fadeDirection !== 'left' && (
                <Segment
                    p={[points[6], points[7], points[0], points[1]]}
                    fadeType={panel.fadeDirection === 'bottom' ? 'start' : (panel.fadeDirection === 'top' ? 'end' : undefined)}
                />
            )}
        </Group>
    )
}

const FocusAdjustmentHandle: React.FC<{
    panel: Panel;
    onUpdate: (id: string, updates: Partial<Panel>, undoable?: boolean) => void;
}> = ({ panel, onUpdate }) => {
    const cx = (panel.width || 0) * (panel.focusCenterX ?? 0.5)
    const cy = (panel.height || 0) * (panel.focusCenterY ?? 0.5)
    if (isNaN(cx) || isNaN(cy)) return null

    return (
        <Group
            x={cx}
            y={cy}
            draggable
            onDragStart={(e) => { e.cancelBubble = true }}
            onDragMove={(e) => {
                e.cancelBubble = true
                const newX = e.target.x() / (panel.width || 1)
                const newY = e.target.y() / (panel.height || 1)
                if (isNaN(newX) || isNaN(newY)) return
                onUpdate(panel.id, {
                    focusCenterX: Math.max(0, Math.min(1, newX)),
                    focusCenterY: Math.max(0, Math.min(1, newY))
                }, false)
            }}
            onDragEnd={(e) => {
                e.cancelBubble = true
                const newX = e.target.x() / (panel.width || 1)
                const newY = e.target.y() / (panel.height || 1)
                if (isNaN(newX) || isNaN(newY)) return
                onUpdate(panel.id, {
                    focusCenterX: Math.max(0, Math.min(1, newX)),
                    focusCenterY: Math.max(0, Math.min(1, newY))
                }, true)
            }}
        >
            <Line points={[-15, 0, 15, 0]} stroke="#3b82f6" strokeWidth={2} />
            <Line points={[0, -15, 0, 15]} stroke="#3b82f6" strokeWidth={2} />
            <Circle radius={10} fill="transparent" />
            <Circle radius={4} fill="#3b82f6" stroke="white" strokeWidth={1} />
        </Group>
    )
}

export const PanelItem: React.FC<{
    panel: Panel;
    page: any;
    isSelected: boolean;
    onSelect: (id: string | null) => void;
    onUpdate: (id: string, updates: Partial<Panel>, undoable?: boolean) => void;
    id?: string;
    renderPass?: 'content' | 'effects' | 'strokes' | 'interaction';
}> = ({ panel, page, isSelected, onSelect, onUpdate, id, renderPass }) => {
    const points = getPanelPoints(panel)
    const imagePath = panel.imagePath && window.electron ? window.electron.pathToUrl(panel.imagePath) : (panel.imagePath || '')
    const [image] = useImage(imagePath)
    const lineRef = useRef<Konva.Line>(null)

    useEffect(() => {
        if (lineRef.current) {
            lineRef.current.clearCache()
            if (image && panel.isGrayscale) {
                lineRef.current.cache()
            }
        }
    }, [panel.isGrayscale, image, panel.imageFlipX, panel.imageScale, panel.imageRotation, panel.imageX, panel.imageY, panel.imagePath])

    const isInteractive = renderPass === 'interaction' || !renderPass;
    const shouldRenderContent = renderPass === 'content' || !renderPass;
    const shouldRenderEffects = renderPass === 'effects' || !renderPass;
    const shouldRenderStrokes = renderPass === 'strokes' || !renderPass;

    return (
        <Group
            id={id}
            x={panel.x}
            y={panel.y}
            draggable={isInteractive}
            listening={isInteractive}
            dragBoundFunc={function (pos) {
                if (this.getAttr('isImageMode')) {
                    return {
                        x: this.getAttr('dragStartX'),
                        y: this.getAttr('dragStartY')
                    }
                }
                return pos
            }}
            onClick={(e) => isInteractive && onSelect(panel.id)}
            onTap={(e) => isInteractive && onSelect(panel.id)}
            onDragStart={(e) => {
                const target = e.currentTarget as any
                const isShift = !!e.evt?.shiftKey
                const isImageMode = isShift && !!panel.imagePath
                target.setAttr('isImageMode', isImageMode)

                if (isImageMode) {
                    const stage = target.getStage()
                    const pointerPos = stage.getPointerPosition()
                    target.setAttr('startPointerX', pointerPos?.x)
                    target.setAttr('startPointerY', pointerPos?.y)
                    target.setAttr('startImageX', panel.imageX ?? 0)
                    target.setAttr('startImageY', panel.imageY ?? 0)
                    target.setAttr('dragStartX', target.x())
                    target.setAttr('dragStartY', target.y())

                    // Clear cache for real-time feedback during drag
                    const contentLine = stage.findOne(`#panel-${panel.id}-image`)
                    if (contentLine) {
                        contentLine.clearCache()
                    }
                }
            }}
            onDragMove={(e) => {
                const target = e.currentTarget as any
                if (target.getAttr('isImageMode')) {
                    const stage = target.getStage()
                    const pointerPos = stage.getPointerPosition()

                    if (pointerPos && target.getAttr('startPointerX') !== undefined) {
                        const totalDx = pointerPos.x - target.getAttr('startPointerX')
                        const totalDy = pointerPos.y - target.getAttr('startPointerY')

                        const newImageX = target.getAttr('startImageX') + totalDx
                        const newImageY = target.getAttr('startImageY') + totalDy

                        const contentLine = stage.findOne(`#panel-${panel.id}-image`) as any
                        if (contentLine) {
                            contentLine.fillPatternX(newImageX)
                            contentLine.fillPatternY(newImageY)
                        }
                    }
                }
            }}
            onDragEnd={(e) => {
                const target = e.currentTarget as any
                if (target.getAttr('isImageMode')) {
                    const stage = target.getStage()
                    const contentLine = stage.findOne(`#panel-${panel.id}-image`) as any
                    if (contentLine) {
                        onUpdate(panel.id, {
                            imageX: Math.round(contentLine.fillPatternX()),
                            imageY: Math.round(contentLine.fillPatternY())
                        })
                        // Restore grayscale cache after movement
                        if (panel.isGrayscale) {
                            contentLine.cache()
                        }
                    }
                } else {
                    onUpdate(panel.id, {
                        x: Math.round(target.x()),
                        y: Math.round(target.y())
                    })
                }
                target.setAttr('isImageMode', false)
            }}
            onTransformEnd={(e) => {
                const node = e.target
                const scaleX = node.scaleX()
                const scaleY = node.scaleY()
                node.scaleX(1)
                node.scaleY(1)
                onUpdate(panel.id, {
                    x: Math.round(node.x()),
                    y: Math.round(node.y()),
                    width: Math.round(Math.abs(panel.width * scaleX)),
                    height: Math.round(Math.abs(panel.height * scaleY)),
                    slant: Math.round(panel.slant * scaleX),
                    offsetB: Math.round(panel.offsetB * scaleX),
                    offsetC: Math.round(panel.offsetC * scaleX),
                    offsetD: Math.round(panel.offsetD * scaleX)
                })
            }}
        >
            {isInteractive && (
                <Line points={points} closed={true} fill="transparent" />
            )}

            {shouldRenderContent && (
                <Group
                    clipFunc={(ctx) => {
                        if (!points || points.length < 6) return
                        ctx.beginPath()
                        ctx.moveTo(points[0], points[1])
                        for (let i = 2; i < points.length; i += 2) {
                            ctx.lineTo(points[i], points[i + 1])
                        }
                        ctx.closePath()
                    }}
                >
                    <Line
                        id={`panel-${panel.id}-image`}
                        ref={lineRef}
                        points={points}
                        closed={true}
                        fill={panel.imagePath ? undefined : 'white'}
                        fillPatternImage={image}
                        fillPatternX={panel.imageX ?? 0}
                        fillPatternY={panel.imageY ?? 0}
                        fillPatternOffsetX={image ? image.width / 2 : 0}
                        fillPatternOffsetY={image ? image.height / 2 : 0}
                        fillPatternScaleX={(panel.imageFlipX ? -1 : 1) * (panel.imageScale ?? 1)}
                        fillPatternScaleY={panel.imageScale ?? 1}
                        fillPatternRotation={panel.imageRotation ?? 0}
                        fillPatternRepeat="no-repeat"
                        filters={panel.isGrayscale ? [Konva.Filters.Grayscale] : []}
                    />
                </Group>
            )}

            {shouldRenderStrokes && <PanelStrokes panel={panel} points={points} page={page} />}
            {shouldRenderEffects && <FocusLines panel={panel} points={points} />}
            {shouldRenderEffects && <FadeOverlay panel={panel} points={points} backgroundColor={page?.backgroundColor || '#ffffff'} />}
            {isInteractive && panel.isAdjustingFocus && <FocusAdjustmentHandle panel={panel} onUpdate={onUpdate} />}
            {isInteractive && isSelected && panel.type === 'slanted' && (
                <Circle
                    x={panel.slant}
                    y={0}
                    radius={6}
                    fill="#3b82f6"
                    stroke="white"
                    strokeWidth={2}
                    draggable
                    onDragStart={(e) => { e.cancelBubble = true }}
                    onDragMove={(e) => {
                        e.cancelBubble = true
                        const newSlant = Math.round(e.target.x())
                        onUpdate(panel.id, { slant: newSlant }, false)
                    }}
                    onDragEnd={(e) => {
                        e.cancelBubble = true
                        const newSlant = Math.round(e.target.x())
                        onUpdate(panel.id, { slant: newSlant }, true)
                        e.target.x(panel.slant)
                        e.target.y(0)
                    }}
                />
            )}
        </Group>
    )
}
