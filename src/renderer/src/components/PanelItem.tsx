import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Konva from 'konva'
import { Group, Line, Circle, Rect, Text } from 'react-konva'
import useImage from 'use-image'
import { Panel, useMangaStore } from '../store/useMangaStore'
import type { Page } from '../store/types'
import { getPanelPoints } from './utils/drawPaths'
import { snapToGrid } from '../utils/gridUtils'

const FadeOverlay: React.FC<{ panel: Panel; points: number[]; backgroundColor: string }> = ({ panel, points, backgroundColor }) => {
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

const RainEffect: React.FC<{ panel: Panel; points: number[] }> = ({ panel, points }) => {
    if (!panel.hasRainEffect) return null
    if (!points || points.length < 6) return null

    const width = panel.width || 1
    const height = panel.height || 1
    const lineCount = Math.min(Math.max(10, panel.rainDensity ?? 100), 500)
    const opacity = panel.rainOpacity ?? 0.3

    // Generate fixed random lines based on panel id to avoid flickering
    const seed = panel.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const random = (s: number) => {
        const x = Math.sin(s) * 10000
        return x - Math.floor(x)
    }

    const lines: React.ReactNode[] = []
    for (let i = 0; i < lineCount; i++) {
        const x = random(seed + i) * width
        const yStart = random(seed + i + 100) * height
        const len = 10 + random(seed + i + 200) * 40
        const yEnd = yStart + len
        
        lines.push(
            <Line
                key={i}
                points={[x, yStart, x, yEnd]}
                stroke="black"
                strokeWidth={0.5 + random(seed + i + 300) * 1}
                opacity={opacity * (0.5 + random(seed + i + 400) * 0.5)}
                listening={false}
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
            {lines}
        </Group>
    )
}

const PanelStrokes: React.FC<{ panel: Panel; points: number[]; page: Page }> = ({ panel, points, page }) => {
    const strokeColor = panel.strokeColor ?? 'black'
    if (!points || points.length !== 8) {
        return <Line points={points} closed={true} stroke={strokeColor} strokeWidth={panel.strokeWidth} />
    }
    if (!panel.fadeDirection || panel.fadeDirection === 'none') {
        return <Line points={points} closed={true} stroke={strokeColor} strokeWidth={panel.strokeWidth} />
    }

    const bg = page?.backgroundColor || '#ffffff'
    const sw = panel.strokeWidth
    const dir = panel.fadeDirection || 'none'
    const fadeTop = dir === 'top' || dir === 'top-left' || dir === 'top-right'
    const fadeRight = dir === 'right' || dir === 'top-right' || dir === 'bottom-right'
    const fadeBottom = dir === 'bottom' || dir === 'bottom-left' || dir === 'bottom-right'
    const fadeLeft = dir === 'left' || dir === 'top-left' || dir === 'bottom-left'

    const Segment = ({ p, fadeType }: { p: number[], fadeType?: 'start' | 'end' }) => {
        if (!fadeType) return <Line points={p} stroke={strokeColor} strokeWidth={sw} />
        let gStart = { x: p[0], y: p[1] }
        let gEnd = { x: p[2], y: p[3] }
        const stops = fadeType === 'end' ? [0, strokeColor, 1, bg] : [0, bg, 1, strokeColor]
        return (
            <Line
                points={p}
                stroke={strokeColor}
                strokeWidth={sw}
                strokeLinearGradientStartPoint={gStart}
                strokeLinearGradientEndPoint={gEnd}
                strokeLinearGradientColorStops={stops}
            />
        )
    }

    return (
        <Group>
            {!fadeTop && (
                <Segment
                    p={[points[0], points[1], points[2], points[3]]}
                    fadeType={fadeLeft ? 'start' : (fadeRight ? 'end' : undefined)}
                />
            )}
            {!fadeRight && (
                <Segment
                    p={[points[2], points[3], points[4], points[5]]}
                    fadeType={fadeTop ? 'start' : (fadeBottom ? 'end' : undefined)}
                />
            )}
            {!fadeBottom && (
                <Segment
                    p={[points[4], points[5], points[6], points[7]]}
                    fadeType={fadeRight ? 'start' : (fadeLeft ? 'end' : undefined)}
                />
            )}
            {!fadeLeft && (
                <Segment
                    p={[points[6], points[7], points[0], points[1]]}
                    fadeType={fadeBottom ? 'start' : (fadeTop ? 'end' : undefined)}
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

type ImageEditMode = 'move' | 'scale' | 'rotate'

const IMAGE_TAB_VIEWPORT_MARGIN = 8

function findScrollParent(el: HTMLElement | null): HTMLElement {
    let cur: HTMLElement | null = el
    while (cur) {
        const { overflow, overflowY, overflowX } = getComputedStyle(cur)
        const oy = overflowY || overflow
        const ox = overflowX || overflow
        if (/(auto|scroll|overlay)/.test(oy) || /(auto|scroll|overlay)/.test(ox)) {
            return cur
        }
        cur = cur.parentElement
    }
    return document.documentElement
}

/**
 * Konva の getClientRect() は既にステージ（キャンバス）座標系の AABB。
 * ここで絶対変換を掛け直さないこと（二重変換で位置が大きくずれる）。
 */
function getScreenBoxForNode(node: Konva.Node, stage: Konva.Stage): { left: number; top: number; right: number; bottom: number } {
    const cr = stage.container().getBoundingClientRect()
    const sw = stage.width()
    const sh = stage.height()
    const rect = node.getClientRect({ skipTransform: false })
    if (sw <= 0 || sh <= 0) {
        return { left: cr.left, top: cr.top, right: cr.left, bottom: cr.top }
    }
    const scaleX = cr.width / sw
    const scaleY = cr.height / sh
    const left = cr.left + rect.x * scaleX
    const right = cr.left + (rect.x + rect.width) * scaleX
    const top = cr.top + rect.y * scaleY
    const bottom = cr.top + (rect.y + rect.height) * scaleY
    return { left, top, right, bottom }
}

function viewportOverflowAmount(
    b: { left: number; top: number; right: number; bottom: number },
    vp: DOMRect,
    margin: number
): number {
    let s = 0
    if (b.top < vp.top + margin) s += vp.top + margin - b.top
    if (b.bottom > vp.bottom - margin) s += b.bottom - (vp.bottom - margin)
    if (b.left < vp.left + margin) s += vp.left + margin - b.left
    if (b.right > vp.right - margin) s += b.right - (vp.right - margin)
    return s
}

const ImageEditModeTabs: React.FC<{
    mode: ImageEditMode
    onChange: (mode: ImageEditMode) => void
    isGrayscale: boolean
    imageFlipX: boolean
    onToggleGrayscale: () => void
    onToggleFlipX: () => void
}> = ({ mode, onChange, isGrayscale, imageFlipX, onToggleGrayscale, onToggleFlipX }) => {
    const tabs: Array<{ key: ImageEditMode; title: string }> = [
        { key: 'move', title: '移動' },
        { key: 'scale', title: '拡大縮小' },
        { key: 'rotate', title: '回転' }
    ]

    return (
        <Group>
            <Rect
                x={0}
                y={0}
                width={170}
                height={34}
                cornerRadius={8}
                fill="rgba(24,24,27,0.95)"
                stroke="#3f3f46"
                strokeWidth={1}
                onMouseDown={(e) => { e.cancelBubble = true }}
                onMouseUp={(e) => { e.cancelBubble = true }}
                onClick={(e) => { e.cancelBubble = true }}
                onTap={(e) => { e.cancelBubble = true }}
            />
            {tabs.map((tab, i) => {
                const active = mode === tab.key
                return (
                    <Group
                        key={tab.key}
                        x={5 + i * 31}
                        y={4}
                        name={tab.title}
                        onMouseDown={(e) => { e.cancelBubble = true; onChange(tab.key) }}
                        onMouseUp={(e) => { e.cancelBubble = true }}
                        onClick={(e) => { e.cancelBubble = true; onChange(tab.key) }}
                        onTouchStart={(e) => { e.cancelBubble = true; onChange(tab.key) }}
                        onTap={(e) => { e.cancelBubble = true; onChange(tab.key) }}
                    >
                        <Rect
                            width={28}
                            height={26}
                            cornerRadius={6}
                            fill={active ? '#2563eb' : 'transparent'}
                            stroke={active ? '#3b82f6' : 'transparent'}
                            strokeWidth={1}
                        />
                        {tab.key === 'move' && (
                            <Group listening={false}>
                                <Line points={[8, 13, 20, 13]} stroke={active ? '#ffffff' : '#a1a1aa'} strokeWidth={2} />
                                <Line points={[10, 10, 8, 13, 10, 16]} stroke={active ? '#ffffff' : '#a1a1aa'} strokeWidth={2} />
                                <Line points={[18, 10, 20, 13, 18, 16]} stroke={active ? '#ffffff' : '#a1a1aa'} strokeWidth={2} />
                                <Line points={[14, 7, 14, 19]} stroke={active ? '#ffffff' : '#a1a1aa'} strokeWidth={2} />
                                <Line points={[11, 9, 14, 7, 17, 9]} stroke={active ? '#ffffff' : '#a1a1aa'} strokeWidth={2} />
                                <Line points={[11, 17, 14, 19, 17, 17]} stroke={active ? '#ffffff' : '#a1a1aa'} strokeWidth={2} />
                            </Group>
                        )}
                        {tab.key === 'scale' && (
                            <Group listening={false}>
                                <Rect x={8} y={8} width={12} height={12} fill="transparent" stroke={active ? '#ffffff' : '#a1a1aa'} strokeWidth={2} />
                                <Line points={[18, 10, 22, 6]} stroke={active ? '#ffffff' : '#a1a1aa'} strokeWidth={2} />
                                <Line points={[19, 6, 22, 6, 22, 9]} stroke={active ? '#ffffff' : '#a1a1aa'} strokeWidth={2} />
                            </Group>
                        )}
                        {tab.key === 'rotate' && (
                            <Group listening={false}>
                                <Text
                                    x={6}
                                    y={4}
                                    width={16}
                                    text="↻"
                                    align="center"
                                    fontSize={16}
                                    fontStyle="bold"
                                    fill={active ? '#ffffff' : '#a1a1aa'}
                                />
                            </Group>
                        )}
                    </Group>
                )
            })}
            <Line points={[99, 6, 99, 28]} stroke="#3f3f46" strokeWidth={1} listening={false} />
            <Group
                x={106}
                y={4}
                onMouseDown={(e) => { e.cancelBubble = true }}
                onMouseUp={(e) => { e.cancelBubble = true }}
                onClick={(e) => { e.cancelBubble = true; onToggleGrayscale() }}
                onTouchStart={(e) => { e.cancelBubble = true; onToggleGrayscale() }}
                onTap={(e) => { e.cancelBubble = true; onToggleGrayscale() }}
            >
                <Rect
                    width={28}
                    height={26}
                    cornerRadius={6}
                    fill={isGrayscale ? '#2563eb' : 'transparent'}
                    stroke={isGrayscale ? '#3b82f6' : 'transparent'}
                    strokeWidth={1}
                />
                <Circle x={14} y={13} radius={7} fill="transparent" stroke={isGrayscale ? '#ffffff' : '#a1a1aa'} strokeWidth={2} listening={false} />
                <Line points={[14, 6, 14, 20]} stroke={isGrayscale ? '#ffffff' : '#a1a1aa'} strokeWidth={2} listening={false} />
            </Group>
            <Group
                x={137}
                y={4}
                onMouseDown={(e) => { e.cancelBubble = true }}
                onMouseUp={(e) => { e.cancelBubble = true }}
                onClick={(e) => { e.cancelBubble = true; onToggleFlipX() }}
                onTouchStart={(e) => { e.cancelBubble = true; onToggleFlipX() }}
                onTap={(e) => { e.cancelBubble = true; onToggleFlipX() }}
            >
                <Rect
                    width={28}
                    height={26}
                    cornerRadius={6}
                    fill={imageFlipX ? '#2563eb' : 'transparent'}
                    stroke={imageFlipX ? '#3b82f6' : 'transparent'}
                    strokeWidth={1}
                />
                <Line points={[8, 13, 20, 13]} stroke={imageFlipX ? '#ffffff' : '#a1a1aa'} strokeWidth={2} listening={false} />
                <Line points={[10, 10, 8, 13, 10, 16]} stroke={imageFlipX ? '#ffffff' : '#a1a1aa'} strokeWidth={2} listening={false} />
                <Line points={[18, 10, 20, 13, 18, 16]} stroke={imageFlipX ? '#ffffff' : '#a1a1aa'} strokeWidth={2} listening={false} />
                <Line points={[14, 8, 14, 18]} stroke={imageFlipX ? '#ffffff' : '#a1a1aa'} strokeWidth={1.5} dash={[2, 2]} listening={false} />
            </Group>
        </Group>
    )
}

export const PanelItem: React.FC<{
    panel: Panel;
    page: Page;
    isSelected: boolean;
    onSelect: (id: string | null) => void;
    onUpdate: (id: string, updates: Partial<Panel>, undoable?: boolean) => void;
    id?: string;
    renderPass?: 'content' | 'effects' | 'strokes' | 'interaction';
}> = ({ panel, page, isSelected, onSelect, onUpdate, id, renderPass }) => {
    const currentProjectPath = useMangaStore((s) => s.currentProjectPath)
    const [isShiftPressed, setIsShiftPressed] = React.useState(false)
    const [imageEditMode, setImageEditMode] = React.useState<ImageEditMode>('move')
    const points = getPanelPoints(panel)
    const imagePath = useMemo(() => {
        if (!panel.imagePath) return ''
        if (window.electron?.resolveAssetPath && currentProjectPath) {
            return window.electron.pathToUrl(window.electron.resolveAssetPath(currentProjectPath, panel.imagePath))
        }
        return window.electron ? window.electron.pathToUrl(panel.imagePath) : panel.imagePath || ''
    }, [panel.imagePath, currentProjectPath])
    const [image] = useImage(imagePath)
    const lineRef = useRef<Konva.Line>(null)
    const imageTabsRef = useRef<Konva.Group>(null)
    const snap = (value: number) => snapToGrid(value, page)

    useEffect(() => {
        if (lineRef.current) {
            lineRef.current.clearCache()
            if (image && (panel.isGrayscale || (panel.blurRadius ?? 0) > 0)) {
                lineRef.current.cache()
            }
        }
    }, [panel.isGrayscale, panel.blurRadius, image, panel.imageFlipX, panel.imageScale, panel.imageRotation, panel.imageX, panel.imageY, panel.imagePath])

    useEffect(() => {
        const onKeyDown = (evt: KeyboardEvent) => {
            if (evt.key === 'Shift') setIsShiftPressed(true)
        }
        const onKeyUp = (evt: KeyboardEvent) => {
            if (evt.key === 'Shift') setIsShiftPressed(false)
        }
        const onBlur = () => setIsShiftPressed(false)
        window.addEventListener('keydown', onKeyDown)
        window.addEventListener('keyup', onKeyUp)
        window.addEventListener('blur', onBlur)
        return () => {
            window.removeEventListener('keydown', onKeyDown)
            window.removeEventListener('keyup', onKeyUp)
            window.removeEventListener('blur', onBlur)
        }
    }, [])

    const isInteractive = renderPass === 'interaction' || !renderPass;
    const shouldRenderContent = renderPass === 'content' || !renderPass;
    const shouldRenderEffects = renderPass === 'effects' || !renderPass;
    const shouldRenderStrokes = renderPass === 'strokes' || !renderPass;
    const shouldShowImageTabs = isInteractive && isSelected && !!panel.imagePath && isShiftPressed

    const defaultTabY = panel.y <= 44 ? panel.height + 8 : -38
    const [tabPos, setTabPos] = useState({ x: 0, y: defaultTabY })

    useLayoutEffect(() => {
        if (!shouldShowImageTabs) return
        const node = imageTabsRef.current
        const stage = node?.getStage() as Konva.Stage | undefined
        if (!node || !stage) return

        const scrollEl = findScrollParent(stage.container())
        const m = IMAGE_TAB_VIEWPORT_MARGIN

        const run = () => {
            const vp = scrollEl.getBoundingClientRect()
            const above = { x: 0, y: -38 }
            const below = { x: 0, y: panel.height + 8 }
            const preferBelowFirst = panel.y <= 44
            const order = preferBelowFirst ? [below, above] : [above, below]

            const applyAndFits = (pos: { x: number; y: number }) => {
                node.position(pos)
                node.getLayer()?.batchDraw()
                const b = getScreenBoxForNode(node, stage)
                return (
                    b.top >= vp.top + m &&
                    b.bottom <= vp.bottom - m &&
                    b.left >= vp.left + m &&
                    b.right <= vp.right - m
                )
            }

            let chosen = order.find((pos) => applyAndFits(pos))
            if (!chosen) {
                let best = order[0]
                let bestScore = Infinity
                for (const pos of order) {
                    node.position(pos)
                    node.getLayer()?.batchDraw()
                    const b = getScreenBoxForNode(node, stage)
                    const score = viewportOverflowAmount(b, vp, m)
                    if (score < bestScore) {
                        bestScore = score
                        best = pos
                    }
                }
                chosen = best
                node.position(chosen)
                node.getLayer()?.batchDraw()
            }
            setTabPos({ x: node.x(), y: node.y() })
        }

        run()
        scrollEl.addEventListener('scroll', run, { passive: true })
        window.addEventListener('resize', run)
        return () => {
            scrollEl.removeEventListener('scroll', run)
            window.removeEventListener('resize', run)
        }
    }, [
        shouldShowImageTabs,
        panel.id,
        panel.x,
        panel.y,
        panel.width,
        panel.height,
        panel.rotation,
        panel.imagePath,
        imageEditMode,
        isShiftPressed,
        defaultTabY
    ])

    return (
        <Group
            id={id}
            x={panel.x + panel.width / 2}
            y={panel.y + panel.height / 2}
            offsetX={panel.width / 2}
            offsetY={panel.height / 2}
            rotation={panel.rotation ?? 0}
            draggable={isInteractive}
            listening={isInteractive}
            dragBoundFunc={function (pos) {
                if (this.getAttr('isImageMode')) {
                    return {
                        x: this.getAttr('dragStartX'),
                        y: this.getAttr('dragStartY')
                    }
                }
                const snappedTopLeftX = snap(pos.x - panel.width / 2)
                const snappedTopLeftY = snap(pos.y - panel.height / 2)
                return {
                    x: snappedTopLeftX + panel.width / 2,
                    y: snappedTopLeftY + panel.height / 2
                }
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
                    target.setAttr('startImageScale', panel.imageScale ?? 1)
                    target.setAttr('startImageRotation', panel.imageRotation ?? 0)
                    target.setAttr('dragStartX', target.x())
                    target.setAttr('dragStartY', target.y())
                    target.setAttr('imageEditMode', imageEditMode)

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
                        const activeMode = (target.getAttr('imageEditMode') ?? 'move') as ImageEditMode
                        const contentLine = stage.findOne(`#panel-${panel.id}-image`) as any
                        if (contentLine) {
                            if (activeMode === 'move') {
                                const newImageX = target.getAttr('startImageX') + totalDx
                                const newImageY = target.getAttr('startImageY') + totalDy
                                contentLine.fillPatternX(newImageX)
                                contentLine.fillPatternY(newImageY)
                            } else if (activeMode === 'scale') {
                                const startScale = target.getAttr('startImageScale') ?? 1
                                const nextScale = Math.max(0.05, Math.min(10, startScale * (1 - totalDy * 0.005)))
                                const sign = (panel.imageFlipX ? -1 : 1)
                                contentLine.fillPatternScaleX(sign * nextScale)
                                contentLine.fillPatternScaleY(nextScale)
                            } else if (activeMode === 'rotate') {
                                const startRotation = target.getAttr('startImageRotation') ?? 0
                                const nextRotation = startRotation + totalDx * 0.4
                                contentLine.fillPatternRotation(nextRotation)
                            }
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
                        const activeMode = (target.getAttr('imageEditMode') ?? 'move') as ImageEditMode
                        if (activeMode === 'move') {
                            onUpdate(panel.id, {
                                imageX: Math.round(contentLine.fillPatternX()),
                                imageY: Math.round(contentLine.fillPatternY())
                            })
                        } else if (activeMode === 'scale') {
                            onUpdate(panel.id, {
                                imageScale: Number(Math.abs(contentLine.fillPatternScaleY()).toFixed(3))
                            })
                        } else if (activeMode === 'rotate') {
                            onUpdate(panel.id, {
                                imageRotation: Number(contentLine.fillPatternRotation().toFixed(1))
                            })
                        }
                        // Restore grayscale cache after movement
                        if (panel.isGrayscale) {
                            contentLine.cache()
                        }
                    }
                } else {
                    const nextX = Math.round(target.x() - panel.width / 2)
                    const nextY = Math.round(target.y() - panel.height / 2)
                    onUpdate(panel.id, {
                        x: snap(nextX),
                        y: snap(nextY)
                    })
                }
                target.setAttr('isImageMode', false)
            }}
            onTransformEnd={(e) => {
                const node = e.target
                const scaleX = node.scaleX()
                const scaleY = node.scaleY()
                const nextWidth = Math.round(Math.abs(panel.width * scaleX))
                const nextHeight = Math.round(Math.abs(panel.height * scaleY))
                const snappedWidth = Math.max(20, Math.round(snap(nextWidth)))
                const snappedHeight = Math.max(20, Math.round(snap(nextHeight)))
                node.scaleX(1)
                node.scaleY(1)
                onUpdate(panel.id, {
                    x: snap(Math.round(node.x() - snappedWidth / 2)),
                    y: snap(Math.round(node.y() - snappedHeight / 2)),
                    width: snappedWidth,
                    height: snappedHeight,
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
            {shouldShowImageTabs && (
                <Group ref={imageTabsRef} x={tabPos.x} y={tabPos.y} listening>
                    <ImageEditModeTabs
                        mode={imageEditMode}
                        onChange={setImageEditMode}
                        isGrayscale={!!panel.isGrayscale}
                        imageFlipX={!!panel.imageFlipX}
                        onToggleGrayscale={() => onUpdate(panel.id, { isGrayscale: !panel.isGrayscale })}
                        onToggleFlipX={() =>
                            onUpdate(panel.id, {
                                imageFlipX: !panel.imageFlipX,
                                imageX: panel.width / 2,
                                imageY: panel.height / 2
                            })
                        }
                    />
                </Group>
            )}

            {shouldRenderContent && (() => {
                const bgType = panel.bgGradientType || 'none';
                const bgColor = panel.backgroundColor || 'white';
                const bgOpacity = panel.backgroundOpacity ?? 1;
                const startColor = panel.bgGradientStartColor || bgColor;
                const endColor = panel.bgGradientEndColor || '#ffffff';
                const rotation = (panel.bgGradientRotation || 0) * Math.PI / 180;

                const bgProps: Partial<Konva.LineConfig> = { opacity: bgOpacity };
                if (bgType === 'none') {
                    bgProps.fill = bgColor;
                } else if (bgType === 'linear') {
                    const radius = Math.sqrt(panel.width ** 2 + panel.height ** 2) / 2;
                    const cx = panel.width / 2;
                    const cy = panel.height / 2;
                    bgProps.fillLinearGradientStartPoint = { 
                        x: cx - Math.cos(rotation) * radius, 
                        y: cy - Math.sin(rotation) * radius 
                    };
                    bgProps.fillLinearGradientEndPoint = { 
                        x: cx + Math.cos(rotation) * radius, 
                        y: cy + Math.sin(rotation) * radius 
                    };
                    bgProps.fillLinearGradientColorStops = [0, startColor, 1, endColor];
                } else if (bgType === 'radial') {
                    const cx = panel.width / 2;
                    const cy = panel.height / 2;
                    const radius = Math.max(panel.width, panel.height) / 2;
                    bgProps.fillRadialGradientStartPoint = { x: cx, y: cy };
                    bgProps.fillRadialGradientEndPoint = { x: cx, y: cy };
                    bgProps.fillRadialGradientStartRadius = 0;
                    bgProps.fillRadialGradientEndRadius = radius;
                    bgProps.fillRadialGradientColorStops = [0, startColor, 1, endColor];
                }

                return (
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
                            points={points}
                            closed={true}
                            {...bgProps}
                        />
                        {panel.imagePath && (
                            <Line
                                id={`panel-${panel.id}-image`}
                                ref={lineRef}
                                points={points}
                                closed={true}
                                fillPatternImage={image}
                                fillPatternX={panel.imageX ?? 0}
                                fillPatternY={panel.imageY ?? 0}
                                fillPatternOffsetX={image ? image.width / 2 : 0}
                                fillPatternOffsetY={image ? image.height / 2 : 0}
                                fillPatternScaleX={(panel.imageFlipX ? -1 : 1) * (panel.imageScale ?? 1)}
                                fillPatternScaleY={panel.imageScale ?? 1}
                                fillPatternRotation={panel.imageRotation ?? 0}
                                fillPatternRepeat="no-repeat"
                                filters={[
                                    ...(panel.isGrayscale ? [Konva.Filters.Grayscale] : []),
                                    ...((panel.blurRadius ?? 0) > 0 ? [Konva.Filters.Blur] : [])
                                ]}
                                blurRadius={panel.blurRadius ?? 0}
                            />
                        )}
                    </Group>
                )
            })()}

            {shouldRenderStrokes && <PanelStrokes panel={panel} points={points} page={page} />}
            {shouldRenderEffects && <FocusLines panel={panel} points={points} />}
            {shouldRenderEffects && <RainEffect panel={panel} points={points} />}
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
