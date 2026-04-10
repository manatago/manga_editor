import React, { useEffect, useMemo, useRef, useState } from 'react'
import Konva from 'konva'
import { Group, Line, Circle, Rect, Text } from 'react-konva'
import useImage from 'use-image'
import { Panel, useMangaStore } from '../store/useMangaStore'
import type { Page } from '../store/types'
import { getPanelPoints } from './utils/drawPaths'
import { snapToGrid } from '../utils/gridUtils'
import { FadeOverlay } from './effects/FadeOverlay'
import { FocusLines } from './effects/FocusLines'
import { RainEffect } from './effects/RainEffect'
import { PanelStrokes } from './PanelStrokes'
import { PanelBackgroundImageLayer } from './PanelBackgroundImageLayer'
import { PanelForegroundToneLayer } from './PanelForegroundToneLayer'
import { showError } from '../utils/dialogs'

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


const ImageEditModeTabs: React.FC<{
    mode: ImageEditMode
    onChange: (mode: ImageEditMode) => void
    isGrayscale: boolean
    imageFlipX: boolean
    onToggleGrayscale: () => void
    onToggleFlipX: () => void
    rembgEnabled?: boolean
    rembgBusy?: boolean
    onRembg?: () => void
}> = ({
    mode,
    onChange,
    isGrayscale,
    imageFlipX,
    onToggleGrayscale,
    onToggleFlipX,
    rembgEnabled,
    rembgBusy,
    onRembg
}) => {
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
            {rembgEnabled && onRembg ? (
                <Group y={38}>
                    <Rect
                        x={0}
                        y={0}
                        width={170}
                        height={28}
                        cornerRadius={6}
                        fill="rgba(24,24,27,0.95)"
                        stroke="#3f3f46"
                        strokeWidth={1}
                        onMouseDown={(e) => {
                            e.cancelBubble = true
                        }}
                        onMouseUp={(e) => {
                            e.cancelBubble = true
                        }}
                        onClick={(e) => {
                            e.cancelBubble = true
                            if (!rembgBusy) onRembg()
                        }}
                        onTap={(e) => {
                            e.cancelBubble = true
                            if (!rembgBusy) onRembg()
                        }}
                    />
                    <Text
                        x={0}
                        y={7}
                        width={170}
                        align="center"
                        text={rembgBusy ? '背景除去中…' : '背景除去 (rembg)'}
                        fontSize={11}
                        fill={rembgBusy ? '#71717a' : '#e4e4e7'}
                        listening={false}
                    />
                </Group>
            ) : null}
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
    const [rembgBusy, setRembgBusy] = useState(false)
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
    const snap = (value: number) => snapToGrid(value, page)

    useEffect(() => {
        if (lineRef.current) {
            lineRef.current.clearCache()
            if (image && (panel.isGrayscale || (panel.blurRadius ?? 0) > 0)) {
                lineRef.current.cache()
            }
        }
    }, [
        panel.isGrayscale,
        panel.grayscaleBrightness,
        panel.blurRadius,
        image,
        panel.imageFlipX,
        panel.imageScale,
        panel.imageRotation,
        panel.imageX,
        panel.imageY,
        panel.imagePath
    ])

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

    const handlePanelRembg = async () => {
        if (!currentProjectPath || !panel.imagePath || rembgBusy || !window.electron) return
        const abs = window.electron.resolveAssetPath(currentProjectPath, panel.imagePath)
        if (!abs) {
            await showError('プロジェクト内の画像のみ背景除去できます')
            return
        }
        setRembgBusy(true)
        try {
            const { relativePath } = await window.electron.rembgRemoveBackground(
                currentProjectPath,
                panel.imagePath
            )
            onUpdate(panel.id, { imagePath: relativePath }, true)
        } catch (e: unknown) {
            const msg =
                e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string'
                    ? (e as { message: string }).message
                    : '背景除去に失敗しました（rembg が PATH にあるか確認してください）'
            console.error('PanelItem: rembg', e)
            await showError(msg)
        } finally {
            setRembgBusy(false)
        }
    }

    // ツールバーは常にパネル内側上端に固定
    const tabPos = { x: 0, y: 8 }

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
                <Group x={tabPos.x} y={tabPos.y} listening>
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
                        rembgEnabled={!!currentProjectPath && !!panel.imagePath}
                        rembgBusy={rembgBusy}
                        onRembg={handlePanelRembg}
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
                        {panel.backgroundImagePath ? (
                            <PanelBackgroundImageLayer panel={panel} projectPath={currentProjectPath} />
                        ) : null}
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
                                    ...(panel.isGrayscale ? [Konva.Filters.Grayscale, Konva.Filters.Brighten] : []),
                                    ...((panel.blurRadius ?? 0) > 0 ? [Konva.Filters.Blur] : [])
                                ]}
                                brightness={panel.isGrayscale ? (panel.grayscaleBrightness ?? 0) : 0}
                                blurRadius={panel.blurRadius ?? 0}
                            />
                        )}
                        {panel.fgTonePath ? (
                            <PanelForegroundToneLayer panel={panel} projectPath={currentProjectPath} />
                        ) : null}
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
