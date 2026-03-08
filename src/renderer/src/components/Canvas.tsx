import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Stage, Layer, Line, Transformer, Circle, Group, Rect, Shape, Text } from 'react-konva'
import useImage from 'use-image'
import { useMangaStore, Panel } from '../store/useMangaStore'

const PANEL_MIN_SIZE = 10

// --- Helper Components ---

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

const PanelItem: React.FC<{
    panel: Panel;
    page: any;
    isSelected: boolean;
    onSelect: (id: string | null) => void;
    onUpdate: (id: string, updates: Partial<Panel>) => void;
    renderPass?: 'content' | 'effects' | 'strokes' | 'interaction';
}> = ({ panel, page, isSelected, onSelect, onUpdate, renderPass }) => {
    const points = getPanelPoints(panel)
    const [image] = useImage(panel.imagePath || '')

    const isInteractive = renderPass === 'interaction' || !renderPass;
    const shouldRenderContent = renderPass === 'content' || !renderPass;
    const shouldRenderEffects = renderPass === 'effects' || !renderPass;
    const shouldRenderStrokes = renderPass === 'strokes' || !renderPass;

    return (
        <Group
            id={panel.id}
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

const VerticalText: React.FC<{
    text: string;
    fontSize: number;
    fontColor: string;
    fontFamily?: string;
    width: number;
    height: number;
    lineHeight?: number;
}> = ({ text, fontSize, fontColor, fontFamily = 'sans-serif', width, height, lineHeight = 1.2 }) => {
    const lines = text.split('\n')
    const charSpacing = fontSize * (lineHeight - 1)
    const columnSpacing = fontSize * 0.5
    const totalColumnsWidth = lines.length * fontSize + (lines.length - 1) * columnSpacing
    const startX = width / 2 + totalColumnsWidth / 2 - fontSize / 2

    // Characters that need special vertical handling
    const rotates = 'ー〜〜～()（）[]［］{}｛｝「」『』<>〈〉《》【】…―'
    const smallChars = 'っゃゅょぁぃぅぇぉッャュョァィゥェォ'
    const punctuations = '。、'

    return (
        <Group>
            {lines.map((line, lineIdx) => (
                <Group key={lineIdx} x={startX - lineIdx * (fontSize + columnSpacing)}>
                    {line.split('').map((char, charIdx) => {
                        let rotation = 0
                        let xOffset = 0
                        let yOffset = 0
                        let align: 'center' | 'left' | 'right' = 'center'

                        if (rotates.includes(char)) {
                            rotation = 90
                            xOffset = fontSize
                        } else if (smallChars.includes(char)) {
                            // Small kana - shifted up and right
                            xOffset = fontSize * 0.2
                            yOffset = -fontSize * 0.1
                        } else if (punctuations.includes(char)) {
                            // Punctuation - shifted even further right and up
                            xOffset = fontSize * 0.8
                            yOffset = -fontSize * 0.5
                        }

                        return (
                            <Text
                                key={charIdx}
                                text={char}
                                x={xOffset}
                                y={charIdx * (fontSize + charSpacing) + yOffset}
                                fontSize={fontSize}
                                fill={fontColor}
                                fontFamily={fontFamily}
                                align={align}
                                width={fontSize}
                                rotation={rotation}
                                fontStyle="bold"
                            />
                        )
                    })}
                </Group>
            ))}
        </Group>
    )
}

const drawRectPath = (context: any, bubble: any, w: number, h: number) => {
    const tx = bubble.tailX || 0; const ty = bubble.tailY || 0
    const tcx = bubble.tailControlX || (tx / 2); const tcy = bubble.tailControlY || (ty / 2)
    const tw = bubble.tailWidth || 20
    const tipX = w / 2 + tx; const tipY = h / 2 + ty
    const cX = w / 2 + tcx; const cY = h / 2 + tcy
    const hasTail = Math.sqrt(tx * tx + ty * ty) > 10
    const cornerRadius = 4
    context.beginPath()
    context.moveTo(cornerRadius, 0)
    context.lineTo(w - cornerRadius, 0)
    context.quadraticCurveTo(w, 0, w, cornerRadius)
    if (hasTail && Math.abs(tx) > Math.abs(ty) && tx > 0) {
        const yL = h / 2 - tw / 2; const yR = h / 2 + tw / 2
        const scX = Math.max(w, cX)
        context.lineTo(w, yL)
        context.quadraticCurveTo(w + (scX - w) * 0.4, yL + (cY - yL) * 0.4, tipX, tipY)
        context.quadraticCurveTo(w + (scX - w) * 0.4, yR + (cY - yR) * 0.4, w, yR)
    }
    context.lineTo(w, h - cornerRadius)
    context.quadraticCurveTo(w, h, w - cornerRadius, h)
    if (hasTail && Math.abs(ty) > Math.abs(tx) && ty > 0) {
        const xL = w / 2 + tw / 2; const xR = w / 2 - tw / 2
        const scY = Math.max(h, cY)
        context.lineTo(xL, h)
        context.quadraticCurveTo(xL + (cX - xL) * 0.4, h + (scY - h) * 0.4, tipX, tipY)
        context.quadraticCurveTo(xR + (cX - xR) * 0.4, h + (scY - h) * 0.4, xR, h)
    }
    context.lineTo(cornerRadius, h)
    context.quadraticCurveTo(0, h, 0, h - cornerRadius)
    if (hasTail && Math.abs(tx) > Math.abs(ty) && tx < 0) {
        const yL = h / 2 + tw / 2; const yR = h / 2 - tw / 2
        const scX = Math.min(0, cX)
        context.lineTo(0, yL)
        context.quadraticCurveTo(scX * 0.4, yL + (cY - yL) * 0.4, tipX, tipY)
        context.quadraticCurveTo(scX * 0.4, yR + (cY - yR) * 0.4, 0, yR)
    }
    context.lineTo(0, cornerRadius)
    context.quadraticCurveTo(0, 0, cornerRadius, 0)
    context.closePath()
}

const drawJaggedPath = (context: any, bubble: any, w: number, h: number) => {
    const spikes = 32
    const def = bubble.deformation ?? 1
    const tx = bubble.tailX || 0; const ty = bubble.tailY || 0
    const tcx = bubble.tailControlX || (tx / 2); const tcy = bubble.tailControlY || (ty / 2)
    const tw = bubble.tailWidth || 20
    const hasTail = Math.sqrt(tx * tx + ty * ty) > 10
    const tailAngle = Math.atan2(ty, tx)
    const angOffset = (tw / 150)
    const sAng = (tailAngle - angOffset + Math.PI * 2) % (Math.PI * 2)
    const eAng = (tailAngle + angOffset + Math.PI * 2) % (Math.PI * 2)
    let tailInjected = false
    context.beginPath()
    for (let i = 0; i <= spikes; i++) {
        const angle = (i / spikes) * Math.PI * 2
        const normAngle = angle % (Math.PI * 2)
        const isInGap = sAng < eAng ? (normAngle >= sAng && normAngle <= eAng) : (normAngle >= sAng || normAngle <= eAng)
        if (hasTail && isInGap) {
            if (!tailInjected) {
                const tipX = w / 2 + tx; const tipY = h / 2 + ty
                let ctrlX = w / 2 + tcx; let ctrlY = h / 2 + tcy
                const rBase = 0.4
                const xL = w / 2 + Math.cos(sAng) * w * rBase; const yL = h / 2 + Math.sin(sAng) * h * rBase
                const xR = w / 2 + Math.cos(eAng) * w * rBase; const yR = h / 2 + Math.sin(eAng) * h * rBase
                const midX = (xL + xR) / 2; const midY = (yL + yR) / 2
                const toTipX = tipX - midX; const toTipY = tipY - midY
                const dTip = Math.sqrt(toTipX ** 2 + toTipY ** 2)
                const nx = toTipX / dTip; const ny = toTipY / dTip
                if ((ctrlX - midX) * nx + (ctrlY - midY) * ny < 0) {
                    ctrlX = midX + nx * 5; ctrlY = midY + ny * 5
                }
                context.lineTo(xL, yL)
                context.quadraticCurveTo(xL + (ctrlX - xL) * 0.4, yL + (ctrlY - yL) * 0.4, tipX, tipY)
                context.quadraticCurveTo(xR + (ctrlX - xR) * 0.4, yR + (ctrlY - yR) * 0.4, xR, yR)
                tailInjected = true
            }
            continue
        }
        const nextAngle = ((i + 1) * Math.PI * 2) / spikes
        const midAngle = (angle + nextAngle) / 2
        const rOuter = i % 2 === 0 ? 0.5 : (0.5 - 0.05 * def)
        const xOuter = w / 2 + Math.cos(angle) * w * rOuter; const yOuter = h / 2 + Math.sin(angle) * h * rOuter
        if (i === 0) context.moveTo(xOuter, yOuter)
        else {
            const rInner = 0.5 - (0.15 * def)
            const xMid = w / 2 + Math.cos(midAngle) * w * rInner; const yMid = h / 2 + Math.sin(midAngle) * h * rInner
            context.quadraticCurveTo(xMid, yMid, xOuter, yOuter)
        }
    }
    context.closePath()
}

const drawRoundedPath = (context: any, bubble: any, w: number, h: number) => {
    const points = 72
    const def = bubble.deformation ?? 1
    const tx = bubble.tailX || 0; const ty = bubble.tailY || 0
    const tcx = bubble.tailControlX || (tx / 2); const tcy = bubble.tailControlY || (ty / 2)
    const tw = bubble.tailWidth || 20
    const hasTail = Math.sqrt(tx * tx + ty * ty) > 10
    const tailAngle = Math.atan2(ty, tx)
    const angOffset = (tw / 250)
    const sAng = (tailAngle - angOffset + Math.PI * 2) % (Math.PI * 2)
    const eAng = (tailAngle + angOffset + Math.PI * 2) % (Math.PI * 2)
    let tailInjected = false
    context.beginPath()
    for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2
        const normAngle = angle % (Math.PI * 2)
        const isInGap = sAng < eAng ? (normAngle >= sAng && normAngle <= eAng) : (normAngle >= sAng || normAngle <= eAng)
        if (hasTail && isInGap) {
            if (!tailInjected) {
                const tipX = w / 2 + tx; const tipY = h / 2 + ty
                let ctrlX = w / 2 + tcx; let ctrlY = h / 2 + tcy
                const getR = (a: number) => 0.5 - (0.08 * Math.max(1, def)) + (Math.sin(a * 3) * 0.02) * def
                const xL = w / 2 + Math.cos(sAng) * w * getR(sAng); const yL = h / 2 + Math.sin(sAng) * h * getR(sAng)
                const xR = w / 2 + Math.cos(eAng) * w * getR(eAng); const yR = h / 2 + Math.sin(eAng) * h * getR(eAng)
                const midX = (xL + xR) / 2; const midY = (yL + yR) / 2
                const nx = (tipX - midX) / Math.sqrt((tipX - midX) ** 2 + (tipY - midY) ** 2)
                const ny = (tipY - midY) / Math.sqrt((tipX - midX) ** 2 + (tipY - midY) ** 2)
                if ((ctrlX - midX) * nx + (ctrlY - midY) * ny < 0) {
                    ctrlX = midX + nx * 5; ctrlY = midY + ny * 5
                }
                const flareF = tw * 0.25
                const sXL = xL + (ctrlX - xL) * 0.4 - Math.sin(sAng) * flareF * (tx > 0 ? 1 : -1)
                const sYL = yL + (ctrlY - yL) * 0.4 + Math.cos(sAng) * flareF * (ty > 0 ? 1 : -1)
                const sXR = xR + (ctrlX - xR) * 0.4 + Math.sin(eAng) * flareF * (tx > 0 ? -1 : 1)
                const sYR = yR + (ctrlY - yR) * 0.4 - Math.cos(eAng) * flareF * (ty > 0 ? -1 : 1)
                context.lineTo(xL, yL)
                context.quadraticCurveTo(sXL, sYL, tipX, tipY)
                context.quadraticCurveTo(sXR, sYR, xR, yR)
                tailInjected = true
            }
            continue
        }
        const jitter = (Math.sin(angle * 3) * 0.02 + Math.sin(angle * 7) * 0.01 + Math.cos(angle * 5) * 0.015) * def
        const r = 0.5 - (0.08 * Math.max(1, def)) + jitter
        const x = w / 2 + Math.cos(angle) * w * r; const y = h / 2 + Math.sin(angle) * h * r
        if (i === 0) context.moveTo(x, y)
        else context.lineTo(x, y)
    }
    context.closePath()
}


const BubbleItem: React.FC<{
    bubble: any;
    isSelected: boolean;
    onSelect: (id: string | null) => void;
    onUpdate: (id: string, props: any) => void;
    renderPass?: 'strokes' | 'fills' | 'text' | 'interaction' | 'mask';
    overrideOpacity?: number;
    overrideShadow?: boolean;
}> = ({ bubble, isSelected, onSelect, onUpdate, renderPass, overrideOpacity, overrideShadow }) => {
    const shapeRef = useRef<any>(null)

    const handleDragEnd = (e: any) => {
        onUpdate(bubble.id, {
            x: e.target.x(),
            y: e.target.y()
        })
    }

    const handleTransformEnd = () => {
        const node = shapeRef.current
        if (!node) return
        const scaleX = node.scaleX()
        const scaleY = node.scaleY()
        node.scaleX(1)
        node.scaleY(1)
        onUpdate(bubble.id, {
            x: node.x(),
            y: node.y(),
            width: Math.max(20, (bubble.width || 100) * scaleX),
            height: Math.max(20, (bubble.height || 100) * scaleY)
        })
    }

    const isInteractive = renderPass === 'interaction' || !renderPass;
    const shouldRenderStrokes = renderPass === 'strokes' || !renderPass;
    const shouldRenderFills = renderPass === 'fills' || !renderPass;
    const shouldRenderText = renderPass === 'text' || !renderPass;

    const renderShape = () => {
        if (isInteractive && !shouldRenderFills && !shouldRenderStrokes) {
            // Invisible hit box for interaction pass
            return (
                <Shape
                    width={bubble.width}
                    height={bubble.height}
                    fill="transparent"
                    sceneFunc={(context, shape) => {
                        if (bubble.type === 'rect') drawRectPath(context, bubble, bubble.width, bubble.height)
                        else if (bubble.type === 'jagged') drawJaggedPath(context, bubble, bubble.width, bubble.height)
                        else drawRoundedPath(context, bubble, bubble.width, bubble.height)
                        context.fillShape(shape)
                    }}
                />
            )
        }

        const { type, width, height, backgroundColor, borderColor, borderWidth, opacity } = bubble

        // Read overrides if they exist
        const actualStrokeWidth = bubble._overrideBorderWidth !== undefined ? bubble._overrideBorderWidth : (borderWidth !== undefined ? borderWidth : 2)

        // When drawing strokes for merging, we draw them double width. The inner half is covered by fills later.
        const passStrokeWidth = shouldRenderStrokes && !shouldRenderFills ? actualStrokeWidth * 2 : actualStrokeWidth
        const passOpacity = overrideOpacity !== undefined ? overrideOpacity : opacity;
        const passShadow = overrideShadow !== undefined ? overrideShadow : true;

        const commonProps = {
            width, height,
            fill: shouldRenderFills ? backgroundColor : undefined,
            stroke: shouldRenderStrokes ? borderColor : undefined,
            strokeWidth: shouldRenderStrokes ? passStrokeWidth : 0,
            opacity: passOpacity,
            perfectDrawEnabled: false,
            shadowColor: passShadow ? 'black' : undefined,
            shadowBlur: passShadow ? 5 : 0,
            shadowOpacity: passShadow ? 0.1 : 0,
            shadowOffset: passShadow ? { x: 2, y: 2 } : { x: 0, y: 0 }
        }

        const runDrawConfig = (context: any, shape: any, drawFn: any) => {
            drawFn(context, bubble, shape.width(), shape.height())
            if (shouldRenderFills && shouldRenderStrokes) context.fillStrokeShape(shape)
            else if (shouldRenderFills) context.fillShape(shape)
            else if (shouldRenderStrokes) context.strokeShape(shape)
        };

        switch (type) {
            case 'rect':
                return (
                    <Shape {...commonProps} sceneFunc={(c, s) => runDrawConfig(c, s, drawRectPath)} />
                )
            case 'jagged':
                return (
                    <Shape {...commonProps} sceneFunc={(c, s) => runDrawConfig(c, s, drawJaggedPath)} />
                )
            case 'rounded':
            default:
                return (
                    <Shape {...commonProps} sceneFunc={(c, s) => runDrawConfig(c, s, drawRoundedPath)} />
                )
        }
    }

    return (
        <Group
            id={bubble.id}
            x={bubble.x}
            y={bubble.y}
            draggable={isInteractive}
            listening={isInteractive}
            onDragEnd={handleDragEnd}
            onTransformEnd={handleTransformEnd}
            onClick={(e) => isInteractive && onSelect(bubble.id)}
            onTap={(e) => isInteractive && onSelect(bubble.id)}
            ref={shapeRef}
        >
            {renderShape()}

            {shouldRenderText && (
                <Group
                    x={bubble.width * 0.15 + (bubble.textOffsetX || 0)}
                    y={bubble.height * 0.15 + (bubble.textOffsetY || 0)}
                    width={bubble.width * 0.7}
                    height={bubble.height * 0.7}
                    clipX={0}
                    clipY={0}
                    clipWidth={bubble.width * 0.7}
                    clipHeight={bubble.height * 0.7}
                    listening={false}
                >
                    {bubble.isVertical ? (
                        <VerticalText
                            text={bubble.text}
                            fontSize={bubble._overrideFontSize ?? bubble.fontSize}
                            fontColor={bubble.fontColor}
                            fontFamily={bubble._overrideFontFamily ?? bubble.fontFamily}
                            width={bubble.width * 0.7}
                            height={bubble.height * 0.7}
                        />
                    ) : (
                        <Text
                            text={bubble.text}
                            fontSize={bubble._overrideFontSize ?? bubble.fontSize}
                            fill={bubble.fontColor}
                            fontFamily={bubble._overrideFontFamily ?? bubble.fontFamily}
                            width={bubble.width * 0.7}
                            height={bubble.height * 0.7}
                            align="center"
                            verticalAlign="middle"
                            fontStyle="bold"
                        />
                    )}
                </Group>
            )}

            {isInteractive && isSelected && (
                <>
                    {/* Tail Tip Handle */}
                    <Circle
                        x={bubble.width / 2 + (bubble.tailX || 0)}
                        y={bubble.height / 2 + (bubble.tailY || 0)}
                        radius={8}
                        fill="#3b82f6"
                        stroke="white"
                        strokeWidth={2}
                        draggable
                        onDragStart={(e) => {
                            e.cancelBubble = true
                        }}
                        onDragMove={(e) => {
                            e.cancelBubble = true
                            const dx = e.target.x() - bubble.width / 2
                            const dy = e.target.y() - bubble.height / 2
                            onUpdate(bubble.id, { tailX: dx, tailY: dy })
                        }}
                        onDragEnd={(e) => {
                            e.cancelBubble = true
                        }}
                    />
                    {/* Tail Control Handle (for curvature) */}
                    {(bubble.tailX !== 0 || bubble.tailY !== 0) && (
                        <Circle
                            x={bubble.width / 2 + (bubble.tailControlX || ((bubble.tailX || 0) / 2))}
                            y={bubble.height / 2 + (bubble.tailControlY || ((bubble.tailY || 0) / 2))}
                            radius={6}
                            fill="#10b981"
                            stroke="white"
                            strokeWidth={2}
                            draggable
                            onDragStart={(e) => {
                                e.cancelBubble = true
                            }}
                            onDragMove={(e) => {
                                e.cancelBubble = true
                                const dx = e.target.x() - bubble.width / 2
                                const dy = e.target.y() - bubble.height / 2
                                onUpdate(bubble.id, { tailControlX: dx, tailControlY: dy })
                            }}
                            onDragEnd={(e) => {
                                e.cancelBubble = true
                            }}
                        />
                    )}
                </>
            )}
        </Group>
    )
}

const BubbleClusterGroup: React.FC<{ members: any[] }> = ({ members }) => {
    const groupRef = useRef<any>(null)
    const master = members[0]

    // Use stringified members to detect ANY change and trigger cache update
    const hash = JSON.stringify(members)

    useEffect(() => {
        if (groupRef.current) {
            groupRef.current.clearCache();

            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            members.forEach(b => {
                let bx1 = b.x, by1 = b.y, bx2 = b.x + b.width, by2 = b.y + b.height;
                const tipX = b.x + b.width / 2 + (b.tailX || 0);
                const tipY = b.y + b.height / 2 + (b.tailY || 0);
                bx1 = Math.min(bx1, tipX); by1 = Math.min(by1, tipY);
                bx2 = Math.max(bx2, tipX); by2 = Math.max(by2, tipY);

                const ctrlX = b.x + b.width / 2 + (b.tailControlX || ((b.tailX || 0) / 2));
                const ctrlY = b.y + b.height / 2 + (b.tailControlY || ((b.tailY || 0) / 2));
                bx1 = Math.min(bx1, ctrlX); by1 = Math.min(by1, ctrlY);
                bx2 = Math.max(bx2, ctrlX); by2 = Math.max(by2, ctrlY);

                minX = Math.min(minX, bx1); minY = Math.min(minY, by1);
                maxX = Math.max(maxX, bx2); maxY = Math.max(maxY, by2);
            });
            const pad = 100 + (master.borderWidth || 2) * 2;

            groupRef.current.cache({
                x: minX - pad,
                y: minY - pad,
                width: (maxX - minX) + pad * 2,
                height: (maxY - minY) + pad * 2,
                pixelRatio: window.devicePixelRatio || 2
            })
        }
    }, [hash])

    return (
        <Group
            ref={groupRef}
            opacity={master.opacity ?? 1}
            shadowColor="black"
            shadowBlur={5}
            shadowOpacity={0.1}
            shadowOffset={{ x: 2, y: 2 }}
            listening={false}
        >
            {/* 1. Mask Layer: punches holes where the fills intersect, wiping inner strokes */}
            <Group globalCompositeOperation="destination-out">
                {members.map(b => (
                    <BubbleItem key={`mask-${b.id}`} bubble={b} isSelected={false} onSelect={() => { }} onUpdate={() => { }} renderPass="mask" overrideOpacity={1} overrideShadow={false} />
                ))}
            </Group>

            {/* 2. Strokes Layer: draws the outer borders below the rest */}
            <Group globalCompositeOperation="destination-over">
                {members.map(b => (
                    <BubbleItem key={`strokes-${b.id}`} bubble={b} isSelected={false} onSelect={() => { }} onUpdate={() => { }} renderPass="strokes" overrideOpacity={1} overrideShadow={false} />
                ))}
            </Group>

            {/* 3. Fills Layer: draws the actual fill color */}
            <Group globalCompositeOperation="source-over">
                {members.map(b => (
                    <BubbleItem key={`fills-${b.id}`} bubble={b} isSelected={false} onSelect={() => { }} onUpdate={() => { }} renderPass="fills" overrideOpacity={1} overrideShadow={false} />
                ))}
            </Group>

            {/* 4. Text Layer */}
            <Group globalCompositeOperation="source-over">
                {members.map(b => (
                    <BubbleItem key={`text-${b.id}`} bubble={b} isSelected={false} onSelect={() => { }} onUpdate={() => { }} renderPass="text" overrideOpacity={1} overrideShadow={false} />
                ))}
            </Group>
        </Group>
    )
}

// --- Main Canvas Component ---

const Canvas: React.FC = () => {
    const {
        pages,
        currentPageId,
        updatePanel,
        selectedPanelId,
        setSelectedPanel,
        selectedBubbleId,
        setSelectedBubble,
        updateBubble
    } = useMangaStore()
    const transformerRef = useRef<any>(null)
    const bubbleTransformerRef = useRef<any>(null)

    const currentPage = pages.find((p) => p.id === currentPageId)
    const panels = currentPage?.panels || []
    const bubbles = currentPage?.bubbles || []

    const handleStageClick = (e: any) => {
        if (e.target === e.target.getStage()) {
            setSelectedPanel(null)
            setSelectedBubble(null)
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
        if (selectedPanelId && transformerRef.current) {
            const stage = transformerRef.current.getStage()
            const node = stage?.findOne('#' + selectedPanelId)
            if (node) {
                transformerRef.current.nodes([node])
                transformerRef.current.getLayer()?.batchDraw()
            }
        } else {
            transformerRef.current?.nodes([])
        }
    }, [selectedPanelId])

    useEffect(() => {
        if (selectedBubbleId && bubbleTransformerRef.current) {
            const stage = bubbleTransformerRef.current.getStage()
            const node = stage?.findOne('#' + selectedBubbleId)
            if (node) {
                bubbleTransformerRef.current.nodes([node])
                bubbleTransformerRef.current.getLayer()?.batchDraw()
            }
        } else {
            bubbleTransformerRef.current?.nodes([])
        }
    }, [selectedBubbleId])



    const visualClusters = useMemo(() => {
        // Simple AABB collision detection
        const checkOverlap = (b1: any, b2: any) => {
            const r1 = { x: b1.x, y: b1.y, w: b1.width, h: b1.height }
            const r2 = { x: b2.x, y: b2.y, w: b2.width, h: b2.height }
            return !(r2.x >= r1.x + r1.w ||
                r2.x + r2.w <= r1.x ||
                r2.y >= r1.y + r1.h ||
                r2.y + r2.h <= r1.y)
        }

        // We want to override styles (font family, font size, border width)
        // for bubbles that intersect AND have the same type + background color.
        const clusters: { master: any; members: any[] }[] = []

        // O(N^2) clustering is fine since N is usually small (< 50)
        bubbles.forEach((b) => {
            // Find an existing cluster this bubble belongs to
            let foundCluster = false
            for (const cluster of clusters) {
                const master = cluster.master
                if (master.type === b.type && master.backgroundColor === b.backgroundColor && master.borderColor === b.borderColor) {
                    // Check if 'b' overlaps with any member of this cluster
                    const overlaps = cluster.members.some(member => checkOverlap(member, b))
                    if (overlaps) {
                        cluster.members.push(b)
                        foundCluster = true
                        break
                    }
                }
            }
            if (!foundCluster) {
                // Creates a new cluster where 'b' is the master (since bubbles are ordered by z-index back-to-front, the first one is the oldest/bottom-most)
                clusters.push({ master: b, members: [b] })
            }
        })

        // Map overrides back to individual bubbles inside clustered payload
        return clusters.map(c => ({
            id: c.master.id,
            members: c.members.map(b => ({
                ...b,
                _overrideFontFamily: c.master.fontFamily,
                _overrideFontSize: c.master.fontSize,
                _overrideBorderWidth: c.master.borderWidth
            }))
        }))
    }, [bubbles])

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
                        {/* 1. Background Layer */}
                        <Group>
                            <Line
                                points={[0, 0, 840, 0, 840, 1188, 0, 1188]}
                                closed
                                fill={currentPage?.backgroundColor || '#ffffff'}
                                opacity={currentPage?.backgroundOpacity ?? 1}
                                listening={false}
                            />
                        </Group>

                        {/* 2. Panel Content (Images/Masks) Layer */}
                        <Group>
                            {panels.map((panel) => (
                                <PanelItem key={`content-${panel.id}`} panel={panel} page={currentPage} isSelected={false} onSelect={() => { }} onUpdate={() => { }} renderPass="content" />
                            ))}
                        </Group>

                        {/* 3. Panel Effects Layer (Fades, Focus Lines) */}
                        <Group>
                            {panels.map((panel) => (
                                <PanelItem key={`effects-${panel.id}`} panel={panel} page={currentPage} isSelected={false} onSelect={() => { }} onUpdate={() => { }} renderPass="effects" />
                            ))}
                        </Group>

                        {/* 4. Panel Stroke Layer */}
                        <Group>
                            {panels.map((panel) => (
                                <PanelItem key={`strokes-${panel.id}`} panel={panel} page={currentPage} isSelected={false} onSelect={() => { }} onUpdate={() => { }} renderPass="strokes" />
                            ))}
                        </Group>

                        {/* 5, 6, 7. Visual Bubbles Layer (Clustered for correct translucency and inner stroke masking) */}
                        <Group>
                            {visualClusters.map((cluster) => (
                                <BubbleClusterGroup key={`cluster-${cluster.id}`} members={cluster.members} />
                            ))}
                        </Group>

                        {/* 8. Interaction Layer */}
                        <Group>
                            {panels.map((panel) => (
                                <PanelItem key={`interaction-${panel.id}`} panel={panel} page={currentPage} isSelected={selectedPanelId === panel.id} onSelect={setSelectedPanel} onUpdate={updatePanel} renderPass="interaction" />
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

                            {bubbles.map((bubble) => (
                                <BubbleItem key={`interaction-${bubble.id}`} bubble={bubble} isSelected={selectedBubbleId === bubble.id} onSelect={setSelectedBubble} onUpdate={updateBubble} renderPass="interaction" />
                            ))}
                            <Transformer
                                ref={bubbleTransformerRef}
                                rotateEnabled={false}
                                keepRatio={false}
                                enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'top-center', 'bottom-center', 'middle-left', 'middle-right']}
                                boundBoxFunc={(oldBox, newBox) => {
                                    if (Math.abs(newBox.width) < 20 || Math.abs(newBox.height) < 20) {
                                        return oldBox
                                    }
                                    return newBox
                                }}
                                visible={!!selectedBubbleId}
                            />
                        </Group>
                    </Layer>
                </Stage>
            </div>
        </div>
    )
}

export default Canvas
