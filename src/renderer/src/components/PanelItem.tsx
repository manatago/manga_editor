import React from 'react'
import { Group, Line, Circle } from 'react-konva'
import useImage from 'use-image'
import { Panel } from '../store/useMangaStore'
import { getPanelPoints } from './utils/drawPaths'

const FadeOverlay: React.FC<{ panel: Panel; points: number[]; backgroundColor: string }> = ({ panel, points, backgroundColor }) => {
    if (!panel.fadeDirection || panel.fadeDirection === 'none') return null

    const { width, height, fadeDirection } = panel
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

    const cx = panel.width * (panel.focusCenterX ?? 0.5)
    const cy = panel.height * (panel.focusCenterY ?? 0.5)
    const lineCount = panel.focusDensity ?? 100
    const shapes: React.ReactNode[] = []
    const radius = Math.max(panel.width, panel.height) * 2.5
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

export const PanelItem: React.FC<{
    panel: Panel;
    page: any;
    isSelected: boolean;
    onSelect: (id: string | null) => void;
    onUpdate: (id: string, updates: Partial<Panel>) => void;
    id?: string;
    renderPass?: 'content' | 'effects' | 'strokes' | 'interaction';
}> = ({ panel, page, isSelected, onSelect, onUpdate, id, renderPass }) => {
    const points = getPanelPoints(panel)
    const imagePath = panel.imagePath && window.electron ? window.electron.pathToUrl(panel.imagePath) : (panel.imagePath || '')
    const [image] = useImage(imagePath)

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
                const target = e.target as any
                const isShift = !!e.evt?.shiftKey
                const isImageMode = isShift && !!panel.imagePath
                target.setAttr('isImageMode', isImageMode)

                if (isImageMode) {
                    const stage = target.getStage()
                    const pointerPos = stage.getPointerPosition()
                    target.setAttr('lastPointerX', pointerPos?.x)
                    target.setAttr('lastPointerY', pointerPos?.y)
                    target.setAttr('dragStartX', target.x())
                    target.setAttr('dragStartY', target.y())
                }
            }}
            onDragMove={(e) => {
                const target = e.target as any
                if (target.getAttr('isImageMode')) {
                    const stage = target.getStage()
                    const pointerPos = stage.getPointerPosition()

                    if (pointerPos && target.getAttr('lastPointerX') !== undefined) {
                        const dx = pointerPos.x - target.getAttr('lastPointerX')
                        const dy = pointerPos.y - target.getAttr('lastPointerY')

                        const currentScale = panel.imageScale || 1
                        const line = target.findOne('Line')
                        if (line) {
                            const newX = line.fillPatternOffsetX() - dx / currentScale
                            const newY = line.fillPatternOffsetY() - dy / currentScale
                            line.fillPatternOffsetX(newX)
                            line.fillPatternOffsetY(newY)
                        }

                        target.setAttr('lastPointerX', pointerPos.x)
                        target.setAttr('lastPointerY', pointerPos.y)
                    }
                }
            }}
            onDragEnd={(e) => {
                const target = e.target as any
                if (target.getAttr('isImageMode')) {
                    const line = target.findOne('Line')
                    if (line) {
                        onUpdate(panel.id, {
                            imageX: Math.round(line.fillPatternOffsetX()),
                            imageY: Math.round(line.fillPatternOffsetY())
                        })
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
                <Line
                    points={points}
                    closed={true}
                    fill={panel.imagePath ? undefined : 'white'}
                    fillPatternImage={image}
                    fillPatternScaleX={panel.imageScale ?? 1}
                    fillPatternScaleY={panel.imageScale ?? 1}
                    fillPatternOffsetX={panel.imageX ?? 0}
                    fillPatternOffsetY={panel.imageY ?? 0}
                    fillPatternRotation={panel.imageRotation ?? 0}
                    fillPatternRepeat="no-repeat"
                />
            )}

            {shouldRenderStrokes && (() => {
                if ((!panel.fadeDirection || panel.fadeDirection === 'none')) {
                    return (
                        <Line
                            points={points}
                            closed={true}
                            stroke="black"
                            strokeWidth={panel.strokeWidth}
                        />
                    )
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
            })()}

            {shouldRenderEffects && (
                <>
                    <FocusLines panel={panel} points={points} />
                    <FadeOverlay panel={panel} points={points} backgroundColor={page?.backgroundColor || '#ffffff'} />
                </>
            )}

            {isInteractive && panel.isAdjustingFocus && (
                <Group x={panel.width * (panel.focusCenterX ?? 0.5)} y={panel.height * (panel.focusCenterY ?? 0.5)}>
                    <Line points={[-15, 0, 15, 0]} stroke="#3b82f6" strokeWidth={2} />
                    <Line points={[0, -15, 0, 15]} stroke="#3b82f6" strokeWidth={2} />
                    <Circle radius={4} fill="#3b82f6" stroke="white" strokeWidth={1} />
                </Group>
            )}

            {isInteractive && isSelected && panel.type === 'slanted' && (
                <Circle
                    x={panel.slant}
                    y={0}
                    radius={6}
                    fill="#3b82f6"
                    stroke="white"
                    strokeWidth={2}
                    draggable
                    onDragMove={(e) => {
                        const newSlant = Math.round(e.target.x())
                        onUpdate(panel.id, { slant: newSlant })
                    }}
                    onDragEnd={(e) => {
                        e.target.x(panel.slant)
                        e.target.y(0)
                    }}
                />
            )}
        </Group>
    )
}
