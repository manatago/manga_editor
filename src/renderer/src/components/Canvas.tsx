import React, { useEffect, useRef, useState } from 'react'
import { Stage, Layer, Line, Transformer, Circle, Group } from 'react-konva'
import useImage from 'use-image'
import { useMangaStore, Panel } from '../store/useMangaStore'

const PANEL_MIN_SIZE = 10

// Helper to calculate points based on type and params
const getPanelPoints = (panel: Panel) => {
    const { type, width, height, slant, offsetB, offsetC, offsetD } = panel
    switch (type) {
        case 'slanted':
            return [slant, 0, width + slant, 0, width, height, 0, height]
        case 'trapezoid-h':
            return [slant, 0, width + offsetB, 0, width + offsetC, height, offsetD, height]
        case 'trapezoid-v':
            return [0, slant, width, offsetD, width, height + offsetC, 0, height + offsetB]
        case 'rect':
        default:
            return [0, 0, width, 0, width, height, 0, height]
    }
}

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
    const radius = Math.max(panel.width, panel.height) * 2.5 // Increased for far-away centers
    const fWidth = panel.focusWidth ?? 1
    const fRadius = panel.focusRadius ?? 50

    for (let i = 0; i < lineCount; i++) {
        const angle = (i / lineCount) * Math.PI * 2
        const jitter = (Math.random() - 0.5) * (0.2 / (lineCount / 100))
        const currentAngle = angle + jitter

        // inner radius (where it starts being sharp) - now starting from focusRadius
        const r1 = fRadius + Math.random() * radius * 0.1
        // outer radius - needs to be large enough to cover the panel even if center is far
        const r2 = radius * 1.5

        // Width of the base of the triangle (tapering effect)
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
            {/* We use a Group with opacity to simulate the fade if needed, 
                but since we want each line to fade, we apply it to the Group's clipping or use a overlay.
                Actually, the easiest way is to apply a linear gradient to the lines' container if possible,
                but Konva Group doesn't support fill. So we apply it to EACH line or use a mask.
                Let's apply a global alpha based on position if fade is active.
            */}
            <Group
                opacity={1}
                {...(panel.fadeDirection && panel.fadeDirection !== 'none' ? {
                    // Konva doesn't have a direct "mask" group that works easily with gradients for children.
                    // Instead, we can use a Rect with "destination-in" compositing if we were in raw canvas.
                    // In Konva, we'll just apply the same gradient to each Line if it were possible, 
                    // but they are filled.
                    // Alternative: Render lines to a cache and apply opacity.
                    // For now, let's just apply the fade-out effect by rendering the FocusLines AFTER the FadeOverlay
                    // (which we already do) but the FocusLines are current ABOVE the overlay.
                    // If we move FocusLines BEFORE FadeOverlay, the overlay will naturally fade them!
                } : {})}
            >
                {shapes}
            </Group>
        </Group>
    )
}

const PanelItem: React.FC<{
    panel: Panel;
    page: any; // Using any for brevity or import Page from store
    isSelected: boolean;
    onSelect: (id: string) => void;
    onUpdate: (id: string, updates: Partial<Panel>) => void
}> = ({ panel, page, isSelected, onSelect, onUpdate }) => {
    const points = getPanelPoints(panel)
    const [image] = useImage(panel.imagePath || '')

    return (
        <Group
            id={panel.id}
            x={panel.x}
            y={panel.y}
            draggable
            dragBoundFunc={function (pos) {
                if (this.getAttr('isImageMode')) {
                    return {
                        x: this.getAttr('dragStartX'),
                        y: this.getAttr('dragStartY')
                    }
                }
                return pos
            }}
            onClick={() => onSelect(panel.id)}
            onTap={() => onSelect(panel.id)}
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
                    onUpdate(panel.id, {
                        imageX: Math.round(line.fillPatternOffsetX()),
                        imageY: Math.round(line.fillPatternOffsetY())
                    })
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
            {/* Background & Image */}
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

            {/* Borders - Rendered as individual segments with gradient fading if needed */}
            {((!panel.fadeDirection || panel.fadeDirection === 'none')) ? (
                <Line
                    points={points}
                    closed={true}
                    stroke="black"
                    strokeWidth={panel.strokeWidth}
                />
            ) : (() => {
                const s = panel.fadeStrength ?? 0.4
                const bg = page?.backgroundColor || '#ffffff'
                const sw = panel.strokeWidth
                const { width: w, height: h } = panel

                // Helper to render a segment with optional gradient
                const Segment = ({ p, fadeType }: { p: number[], fadeType?: 'start' | 'end' }) => {
                    if (!fadeType) return <Line points={p} stroke="black" strokeWidth={sw} />

                    let gStart = { x: p[0], y: p[1] }
                    let gEnd = { x: p[2], y: p[3] }

                    // If fading end, swap so gradient goes from black to bg at the end
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
                        {/* Top segment (points 0,1 to 2,3) */}
                        {panel.fadeDirection !== 'top' && (
                            <Segment
                                p={[points[0], points[1], points[2], points[3]]}
                                fadeType={panel.fadeDirection === 'left' ? 'start' : (panel.fadeDirection === 'right' ? 'end' : undefined)}
                            />
                        )}
                        {/* Right segment (points 2,3 to 4,5) */}
                        {panel.fadeDirection !== 'right' && (
                            <Segment
                                p={[points[2], points[3], points[4], points[5]]}
                                fadeType={panel.fadeDirection === 'top' ? 'start' : (panel.fadeDirection === 'bottom' ? 'end' : undefined)}
                            />
                        )}
                        {/* Bottom segment (points 4,5 to 6,7) */}
                        {panel.fadeDirection !== 'bottom' && (
                            <Segment
                                p={[points[4], points[5], points[6], points[7]]}
                                fadeType={panel.fadeDirection === 'right' ? 'start' : (panel.fadeDirection === 'left' ? 'end' : undefined)}
                            />
                        )}
                        {/* Left segment (points 6,7 to 0,1) */}
                        {panel.fadeDirection !== 'left' && (
                            <Segment
                                p={[points[6], points[7], points[0], points[1]]}
                                fadeType={panel.fadeDirection === 'bottom' ? 'start' : (panel.fadeDirection === 'top' ? 'end' : undefined)}
                            />
                        )}
                    </Group>
                )
            })()}

            <FocusLines panel={panel} points={points} />
            <FadeOverlay panel={panel} points={points} backgroundColor={page?.backgroundColor || '#ffffff'} />

            {panel.isAdjustingFocus && (
                <Group x={panel.width * (panel.focusCenterX ?? 0.5)} y={panel.height * (panel.focusCenterY ?? 0.5)}>
                    <Line points={[-15, 0, 15, 0]} stroke="#3b82f6" strokeWidth={2} />
                    <Line points={[0, -15, 0, 15]} stroke="#3b82f6" strokeWidth={2} />
                    <Circle radius={4} fill="#3b82f6" stroke="white" strokeWidth={1} />
                </Group>
            )}

            {isSelected && panel.type === 'slanted' && (
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

const Canvas: React.FC = () => {
    const { pages, currentPageId, updatePanel, selectedPanelId, setSelectedPanel } = useMangaStore()
    const transformerRef = useRef<any>(null)

    const currentPage = pages.find((p) => p.id === currentPageId)
    const panels = currentPage?.panels || []

    const handleStageClick = (e: any) => {
        if (e.target === e.target.getStage()) {
            setSelectedPanel(null)
            return
        }
    }


    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault()
        if (!selectedPanelId) return

        const files = Array.from(e.dataTransfer.files)
        const imageFile = files.find(f => f.type.startsWith('image/'))

        if (imageFile) {
            const reader = new FileReader()
            reader.onload = () => {
                updatePanel(selectedPanelId, {
                    imagePath: reader.result as string,
                    imageScale: 1,
                    imageRotation: 0,
                    imageX: 0,
                    imageY: 0
                })
            }
            reader.readAsDataURL(imageFile)
        }
    }

    useEffect(() => {
        if (selectedPanelId) {
            const node = transformerRef.current?.getStage().findOne('#' + selectedPanelId)
            if (node) {
                transformerRef.current?.nodes([node])
                transformerRef.current?.getLayer().batchDraw()
            }
        } else {
            transformerRef.current?.nodes([])
        }
    }, [selectedPanelId])

    return (
        <div
            className="flex flex-col items-center justify-center min-h-full py-12"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
        >
            <div className="bg-white shadow-2xl origin-top" style={{ width: 840, height: 1188 }}>
                <Stage
                    width={840}
                    height={1188}
                    onClick={handleStageClick}
                    onTap={handleStageClick}
                >
                    <Layer>
                        {/* Page Background */}
                        <Line
                            points={[0, 0, 840, 0, 840, 1188, 0, 1188]}
                            closed
                            fill={currentPage?.backgroundColor || '#ffffff'}
                            opacity={currentPage?.backgroundOpacity ?? 1}
                            listening={false}
                        />
                        {panels.map((panel) => (
                            <PanelItem
                                key={panel.id}
                                panel={panel}
                                page={currentPage}
                                isSelected={selectedPanelId === panel.id}
                                onSelect={setSelectedPanel}
                                onUpdate={updatePanel}
                            />
                        ))}
                        <Transformer
                            ref={transformerRef}
                            rotateEnabled={false}
                            keepRatio={false}
                            boundBoxFunc={(oldBox, newBox) => {
                                if (Math.abs(newBox.width) < PANEL_MIN_SIZE || Math.abs(newBox.height) < PANEL_MIN_SIZE) {
                                    return oldBox
                                }
                                return newBox
                            }}
                        />
                    </Layer>
                </Stage>
            </div>
        </div>
    )
}

export default Canvas
