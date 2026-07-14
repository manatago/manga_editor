import React, { useRef, useEffect, useState } from 'react'
import Konva from 'konva'
import { Group, Shape, Text, Circle } from 'react-konva'
import { Bubble, Panel, useMangaStore } from '../store/useMangaStore'
import { getPanelPoints, drawRectPath, drawJaggedPath, drawRoundedPath, drawFlashPath, drawShoutPath, drawSquareJaggedPath, drawJitteryCircle, drawMegaphonePath, drawDoubleRectPath } from './utils/drawPaths'
import { findTargetPanel } from './utils/geometry'
import { snapToGrid } from '../utils/gridUtils'
import { getPRand, hexToRGBA } from './utils/bubbleUtils'
import { VerticalText, MegaphoneText } from './SpeechText'
import { BubbleHorizontalTextLayers } from './BubbleHorizontalTextLayers'
import {
    getBubbleInnerPaddingRatio,
    getBubbleInnerSizeRatio,
    getBubbleAutoFitSafeRatio,
    resolveTextWeightLevel,
    resolveBaseFontStyle,
    clampRoughness,
    layoutHorizontalText,
    layoutVerticalText
} from './utils/bubbleTextLayout'

// BubbleClusterGroup がクラスタ描画時に注入する内部オーバーライドフィールド（永続化されない）
interface BubbleRenderProps extends Bubble {
    _overrideFontFamily?: string
    _overrideFontSize?: number
    _overrideLineHeight?: number
    _overrideBorderWidth?: number
    _overrideBackgroundColor?: string
    _overrideBorderColor?: string
    _overrideBackgroundOpacity?: number
}

export const BubbleItem: React.FC<{
    bubble: BubbleRenderProps;
    isSelected: boolean;
    onSelect: (id: string | null) => void;
    onUpdate: (id: string, updates: Partial<BubbleRenderProps>, undoable?: boolean) => void;
    id?: string;
    renderPass?: 'strokes' | 'fills' | 'text' | 'interaction' | 'mask';
    overrideOpacity?: number;
    overrideShadow?: boolean;
    clipPoints?: number[];
    panels?: Panel[];
    interactionLocked?: boolean;
    isShiftPressed?: boolean;
}> = ({ bubble, isSelected, onSelect, onUpdate, id, renderPass, overrideOpacity, overrideShadow, clipPoints, panels, interactionLocked = false, isShiftPressed }) => {
    const shapeRef = useRef<Konva.Group>(null)
    const [, forceUpdate] = useState(0)
    const currentPage = useMangaStore((s) => s.pages.find((p) => p.id === s.currentPageId))
    const snap = (value: number) => snapToGrid(value, currentPage)

    // Wait for the selected font to load, then force re-render so Konva draws with the real font
    const actualFontFamily = bubble._overrideFontFamily ?? bubble.fontFamily
    useEffect(() => {
        let cancelled = false
        const weight = bubble.fontWeight || (bubble.textWeightLevel === 0 ? 'normal' : 'bold')
        const size = bubble._overrideFontSize ?? bubble.fontSize ?? 18
        // 第2引数にこの吹き出しの実テキストを渡す。日本語フォント（fontsource）は文字ごとに
        // woff2 サブセットが分かれており、text を省くと既定の ' ' のサブセットしか読まれない。
        // そのため「が」等がまだ未ロードのまま Konva が描画し、その文字だけ表示されないことがある。
        // 実テキストを渡すと必要なサブセットが全て読まれ、完了後の forceUpdate で正しく再描画される。
        document.fonts.load(`${weight} ${size}px ${actualFontFamily}`, bubble.text ?? '')
            .then(() => { if (!cancelled) forceUpdate((prev: number) => prev + 1) })
            .catch(() => {})
        return () => { cancelled = true }
    }, [actualFontFamily, bubble.text, bubble.fontWeight, bubble.textWeightLevel, bubble._overrideFontSize, bubble.fontSize])

    // 自動フィット：text や枠サイズが変わったらフォント／枠を補正してストアに書き戻す。
    // - 1 つのコマで複数 renderPass が走るため、interaction パス（or orphan）でだけ動かす
    // - Web フォント読み込み完了を待たないと measureText がフォールバック幅を返すので fonts.ready を待つ
    // - shrink-font / expand-bubble はそれぞれ単調操作（縮める・広げるのみ）にしてループを避ける
    // - 縦書きは VerticalText が `\n` 区切りで列を作る仕様に合わせて、列数 × 最長列高で見積もる
    const autoFitOwner = renderPass === 'interaction' || !renderPass
    useEffect(() => {
        if (!autoFitOwner) return
        const mode = bubble.autoFitMode
        if (!mode || mode === 'off') return
        if (bubble.type === 'megaphone') return // Phase 2
        if (!bubble.text || bubble.width <= 0 || bubble.height <= 0) return

        let cancelled = false
        const apply = async (): Promise<void> => {
            try {
                if (typeof document !== 'undefined' && document.fonts) {
                    await document.fonts.ready
                }
            } catch {
                /* ignore */
            }
            if (cancelled) return

            const safeRatio = getBubbleAutoFitSafeRatio(bubble.type, bubble.deformation)
            const innerW = bubble.width * safeRatio
            const innerH = bubble.height * safeRatio
            if (innerW <= 0 || innerH <= 0) return

            const fontWeight = resolveBaseFontStyle(resolveTextWeightLevel(bubble))
            const lineHeight = bubble.lineHeight ?? 1.0
            const letterSpacing = bubble.letterSpacing ?? 0

            const measureH = (fs: number): { w: number; h: number } => {
                const l = layoutHorizontalText({
                    text: bubble.text,
                    innerW,
                    fontSize: fs,
                    fontFamily: actualFontFamily,
                    fontWeight,
                    letterSpacing,
                    lineHeight
                })
                return { w: l.widestLine, h: l.totalHeight }
            }

            const measureV = (fs: number): { w: number; h: number } => {
                const l = layoutVerticalText({
                    text: bubble.text,
                    fontSize: fs,
                    lineHeight,
                    letterSpacing
                })
                return { w: l.totalColumnsWidth, h: l.tallestColumnHeight }
            }

            const measure = bubble.isVertical ? measureV : measureH

            if (mode === 'shrink-font') {
                const MIN_FS = 10
                let fs = bubble.fontSize
                let m = measure(fs)
                let safety = 60
                while (safety-- > 0 && fs > MIN_FS && (m.w > innerW || m.h > innerH)) {
                    fs = Math.max(MIN_FS, Math.floor(fs * 0.95))
                    m = measure(fs)
                }
                if (fs !== bubble.fontSize && !cancelled) {
                    onUpdate(bubble.id, { fontSize: fs }, false)
                }
                return
            }

            if (mode === 'expand-bubble') {
                // 「枠をテキストにぴったり合わせる」双方向フィット。
                // 横書きで 1 行が innerW を超えるなら、自然幅まで広げて再レイアウト。
                let m = measure(bubble.fontSize)
                if (!bubble.isVertical && m.w > innerW) {
                    const re = layoutHorizontalText({
                        text: bubble.text,
                        innerW: m.w,
                        fontSize: bubble.fontSize,
                        fontFamily: actualFontFamily,
                        fontWeight,
                        letterSpacing,
                        lineHeight
                    })
                    m = { w: re.widestLine, h: re.totalHeight }
                }

                // テキスト幅・高さに safeRatio で逆算した bubble サイズが目標
                const targetW = Math.ceil(Math.max(20, m.w / safeRatio))
                const targetH = Math.ceil(Math.max(20, m.h / safeRatio))

                const dW = targetW - bubble.width
                const dH = targetH - bubble.height
                const updates: Partial<Bubble> = {}
                // 1px 未満の差は無視して振動を防ぐ
                if (Math.abs(dW) >= 1) {
                    updates.width = targetW
                    updates.x = bubble.x - dW / 2
                }
                if (Math.abs(dH) >= 1) {
                    updates.height = targetH
                    updates.y = bubble.y - dH / 2
                }
                if (Object.keys(updates).length > 0 && !cancelled) {
                    onUpdate(bubble.id, updates, false)
                }
            }
        }
        void apply()
        return () => {
            cancelled = true
        }
    }, [
        autoFitOwner,
        bubble.id,
        bubble.autoFitMode,
        bubble.text,
        bubble.fontSize,
        bubble.width,
        bubble.height,
        bubble.x,
        bubble.y,
        bubble.lineHeight,
        bubble.letterSpacing,
        bubble.fontWeight,
        bubble.textWeightLevel,
        bubble.isVertical,
        bubble.type,
        bubble.deformation,
        actualFontFamily,
        onUpdate
    ])

    const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
        if (e.target !== e.currentTarget) return
        const target = e.currentTarget as Konva.Node
        if (target.getAttr('isTextOffsetMode')) {
            const finalOffsetX = target.getAttr('startTextOffsetX') ?? (bubble.textOffsetX || 0)
            const finalOffsetY = target.getAttr('startTextOffsetY') ?? (bubble.textOffsetY || 0)
            const stage = target.getStage()
            const pointerPos = stage?.getPointerPosition()
            if (pointerPos && target.getAttr('startPointerX') !== undefined) {
                const totalDx = pointerPos.x - target.getAttr('startPointerX')
                const totalDy = pointerPos.y - target.getAttr('startPointerY')
                onUpdate(
                    bubble.id,
                    { textOffsetX: finalOffsetX + totalDx, textOffsetY: finalOffsetY + totalDy },
                    true
                )
            }
            target.setAttr('isTextOffsetMode', false)
            return
        }
        const x = snap(e.target.x())
        const y = snap(e.target.y())
        const updates: Partial<Bubble> = { x, y }

        // If clipped, automatically find and update the target panelId
        if (bubble.isClipped && panels) {
            const centerX = x + (bubble.width || 100) / 2
            const centerY = y + (bubble.height || 100) / 2
            const targetPanel = findTargetPanel(centerX, centerY, panels)
            if (targetPanel) {
                updates.panelId = targetPanel.id
            }
        }

        onUpdate(bubble.id, updates)
    }

    const handleTransformEnd = () => {
        const node = shapeRef.current
        if (!node) return
        const scaleX = node.scaleX()
        const scaleY = node.scaleY()
        const rotation = node.rotation()
        node.scaleX(1)
        node.scaleY(1)

        const x = snap(node.x())
        const y = snap(node.y())
        const width = Math.max(20, snap((bubble.width || 100) * scaleX))
        const height = Math.max(20, snap((bubble.height || 100) * scaleY))
        const updates: Partial<Bubble> = {
            x, y, rotation,
            width, height,
            // Scale tail offsets to maintain relative position after scale reset
            tailX: (bubble.tailX || 0) * scaleX,
            tailY: (bubble.tailY || 0) * scaleY,
            tailControlX: bubble.tailControlX !== undefined ? bubble.tailControlX * scaleX : undefined,
            tailControlY: bubble.tailControlY !== undefined ? bubble.tailControlY * scaleY : undefined,
            // ユーザーが手動でサイズを変えた以上、自動フィットは解除して手動扱いにする
            autoFitMode: 'off'
        }

        if (bubble.isClipped && panels) {
            const centerX = x + width / 2
            const centerY = y + height / 2
            const targetPanel = findTargetPanel(centerX, centerY, panels)
            if (targetPanel) {
                updates.panelId = targetPanel.id
            }
        }

        onUpdate(bubble.id, updates)
    }

    const isInteractive = renderPass === 'interaction' || !renderPass;
    const isMask = renderPass === 'mask';
    const shouldRenderStrokes = renderPass === 'strokes' || !renderPass;
    const shouldRenderFills = renderPass === 'fills' || !renderPass || isMask; // Masks are drawn using the fill logic
    const shouldRenderText = renderPass === 'text' || !renderPass;
    const { backgroundColor, borderColor, borderWidth, opacity } = bubble;

    // Read overrides if they exist
    const actualStrokeWidth = bubble._overrideBorderWidth !== undefined ? bubble._overrideBorderWidth : (borderWidth !== undefined ? borderWidth : 2)
    const actualBackgroundColor = bubble._overrideBackgroundColor !== undefined ? bubble._overrideBackgroundColor : backgroundColor;
    const actualBorderColor = bubble._overrideBorderColor !== undefined ? bubble._overrideBorderColor : borderColor;
    const actualBackgroundOpacity = bubble._overrideBackgroundOpacity !== undefined ? bubble._overrideBackgroundOpacity : (bubble.backgroundOpacity ?? 1);

    // When drawing strokes for merging, we draw them double width.
    const passStrokeWidth = shouldRenderStrokes && !shouldRenderFills ? actualStrokeWidth * 2 : actualStrokeWidth
    const passOpacity = overrideOpacity !== undefined ? overrideOpacity : opacity;
    const passShadow = overrideShadow !== undefined ? overrideShadow : true;


    const commonProps = {
        width: bubble.width,
        height: bubble.height,
        fill: shouldRenderFills ? (isMask ? 'black' : hexToRGBA(actualBackgroundColor, overrideOpacity === 1 ? 1 : actualBackgroundOpacity)) : undefined,
        stroke: shouldRenderStrokes ? actualBorderColor : undefined,
        strokeWidth: shouldRenderStrokes ? passStrokeWidth : 0,
        opacity: isMask ? 1 : passOpacity,
        perfectDrawEnabled: false,
        shadowColor: isMask || !passShadow ? undefined : 'black',
        shadowBlur: isMask || !passShadow ? 0 : 5,
        shadowOpacity: isMask || !passShadow ? 0 : 0.1,
        shadowOffset: isMask || !passShadow ? { x: 0, y: 0 } : { x: 2, y: 2 }
    }

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
                        else if (bubble.type === 'shout') drawShoutPath(context, bubble, bubble.width, bubble.height)
                        else if (bubble.type === 'square-jagged') drawSquareJaggedPath(context, bubble, bubble.width, bubble.height)
                        else if (bubble.type === 'flash') drawRoundedPath(context, bubble, bubble.width, bubble.height) // Use ellipse for selection hit area
                        else if (bubble.type === 'rect-double') drawDoubleRectPath(context, bubble, bubble.width, bubble.height, shape)
                        else drawRoundedPath(context, bubble, bubble.width, bubble.height)
                        context.fillShape(shape)
                    }}
                />
            )
        }

        const { type, width, height } = bubble

        const runDrawConfig = (context: Konva.Context, shape: Konva.Shape, drawFn: (ctx: Konva.Context, b: Bubble, w: number, h: number) => void) => {
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
            case 'shout':
                return (
                    <Shape {...commonProps} sceneFunc={(c, s) => runDrawConfig(c, s, drawShoutPath)} />
                )
            case 'megaphone':
                return (
                    <Shape 
                        {...commonProps} 
                        sceneFunc={(c, s) => {
                            drawMegaphonePath(c, bubble, s.width(), s.height(), s)
                            if (shouldRenderFills) c.fillShape(s)
                            // Skip default stroke - drawMegaphonePath handles its own specific strokes
                        }} 
                    />
                )
            case 'square-jagged':
                return (
                    <Shape {...commonProps} sceneFunc={(c, s) => runDrawConfig(c, s, drawSquareJaggedPath)} />
                )
            case 'rect-double':
                return (
                    <Shape 
                        {...commonProps} 
                        sceneFunc={(c, s) => {
                            drawDoubleRectPath(c, bubble, s.width(), s.height(), s)
                        }} 
                    />
                )
            case 'flash': {
                const hexColor = actualBackgroundColor || '#ffffff'
                const cr = parseInt(hexColor.slice(1, 3), 16)
                const cg = parseInt(hexColor.slice(3, 5), 16)
                const cb = parseInt(hexColor.slice(5, 7), 16)
                const bgAlpha = isMask ? 1 : actualBackgroundOpacity
                const endRadius = Math.max(bubble.width, bubble.height) / 2 * 0.9
                // 不透明で塗る半径（0..1）。ここまでベタ塗り、そこから外周へ透明にフェード。
                // 大きくするほど「真ん中以外が透明」が減り、ほぼベタ塗りになる。
                const fillR = Math.min(0.99, Math.max(0.05, bubble.flashFillRadius ?? 0.55))
                const solid = `rgba(${cr},${cg},${cb},${bgAlpha})`
                const colorStops = isMask
                    ? [0, 'black', 1, 'black']
                    : [0, solid, fillR, solid, 1, `rgba(${cr},${cg},${cb},0)`]
                return (
                    <>
                        {shouldRenderFills && (
                            <Shape
                                width={bubble.width}
                                height={bubble.height}
                                opacity={isMask ? 1 : passOpacity}
                                perfectDrawEnabled={false}
                                fillRadialGradientStartPoint={{ x: bubble.width / 2, y: bubble.height / 2 }}
                                fillRadialGradientEndPoint={{ x: bubble.width / 2, y: bubble.height / 2 }}
                                fillRadialGradientStartRadius={0}
                                fillRadialGradientEndRadius={endRadius}
                                fillRadialGradientColorStops={colorStops}
                                sceneFunc={(ctx, shape) => {
                                    const w = shape.width(), h = shape.height()
                                    ctx.beginPath()
                                    for (let i = 0; i <= 64; i++) {
                                        const angle = (i / 64) * Math.PI * 2
                                        const px = w / 2 + Math.cos(angle) * w / 2
                                        const py = h / 2 + Math.sin(angle) * h / 2
                                        if (i === 0) ctx.moveTo(px, py)
                                        else ctx.lineTo(px, py)
                                    }
                                    ctx.closePath()
                                    ctx.fillShape(shape)
                                }}
                            />
                        )}
                        {shouldRenderStrokes && (
                            <Shape {...commonProps} fill={undefined} sceneFunc={(c, s) => runDrawConfig(c, s, drawFlashPath)} />
                        )}
                    </>
                )
            }
            case 'rounded':
            default:
                return (
                    <Shape {...commonProps} sceneFunc={(c, s) => runDrawConfig(c, s, drawRoundedPath)} />
                )
        }
    }

    return (
        <Group
            id={id}
            x={bubble.x}
            y={bubble.y}
            rotation={bubble.rotation || 0}
            draggable={isSelected && renderPass === 'interaction' && !interactionLocked}
            listening={isInteractive && !interactionLocked}
            dragBoundFunc={function (pos) {
                if ((this as any).getAttr('isTextOffsetMode')) {
                    return {
                        x: (this as any).getAttr('dragStartX'),
                        y: (this as any).getAttr('dragStartY')
                    }
                }
                return {
                    x: snap(pos.x),
                    y: snap(pos.y)
                }
            }}
            onDragStart={(e) => {
                const target = e.currentTarget as any
                const isShift = !!e.evt?.shiftKey || !!isShiftPressed
                const isTextOffsetMode = isSelected && isShift
                target.setAttr('isTextOffsetMode', isTextOffsetMode)
                if (isTextOffsetMode) {
                    const stage = target.getStage()
                    const pointerPos = stage?.getPointerPosition()
                    target.setAttr('startPointerX', pointerPos?.x)
                    target.setAttr('startPointerY', pointerPos?.y)
                    target.setAttr('startTextOffsetX', bubble.textOffsetX || 0)
                    target.setAttr('startTextOffsetY', bubble.textOffsetY || 0)
                    target.setAttr('dragStartX', target.x())
                    target.setAttr('dragStartY', target.y())
                }
            }}
            onDragMove={(e) => {
                const target = e.currentTarget as any
                if (!target.getAttr('isTextOffsetMode')) return
                const stage = target.getStage()
                const pointerPos = stage?.getPointerPosition()
                if (!pointerPos || target.getAttr('startPointerX') === undefined) return
                const totalDx = pointerPos.x - target.getAttr('startPointerX')
                const totalDy = pointerPos.y - target.getAttr('startPointerY')
                onUpdate(
                    bubble.id,
                    {
                        textOffsetX: (target.getAttr('startTextOffsetX') ?? 0) + totalDx,
                        textOffsetY: (target.getAttr('startTextOffsetY') ?? 0) + totalDy
                    },
                    false
                )
            }}
            onDragEnd={handleDragEnd}
            onTransformEnd={handleTransformEnd}
            onClick={(e) => isInteractive && !interactionLocked && onSelect(bubble.id)}
            onTap={(e) => isInteractive && !interactionLocked && onSelect(bubble.id)}
            ref={shapeRef}
            clipFunc={clipPoints ? (ctx) => {
                ctx.beginPath()
                ctx.moveTo(clipPoints[0], clipPoints[1])
                for (let i = 2; i < clipPoints.length; i += 2) {
                    ctx.lineTo(clipPoints[i], clipPoints[i + 1])
                }
                ctx.closePath()
            } : undefined}
        >
            {/* Thought Bubble Tail Circles (Drawn behind for natural merging) */}
            {bubble.type === 'rounded' && bubble.tailType === 'thought' && (() => {
                const tx = bubble.tailX || 0;
                const ty = bubble.tailY || 0;
                const tcx = bubble.tailControlX || (tx / 2);
                const tcy = bubble.tailControlY || (ty / 2);
                const dist = Math.sqrt(tx * tx + ty * ty);
                if (dist < 20) return null;
                const numCircles = Math.max(3, Math.min(4, Math.floor(dist / 60)));
                const circles: React.ReactElement[] = [];
                const maxRadius = (bubble.tailWidth || 20) / 2;
                for (let i = 0; i < numCircles; i++) {
                    const t = 0.4 + (0.55 * (i / (numCircles - 1)));
                    const curX = (2 * (1 - t) * t * tcx) + (t * t * tx);
                    const curY = (2 * (1 - t) * t * tcy) + (t * t * ty);
                    const currentRadius = maxRadius * (1 - (t * 0.6));
                    circles.push(
                        <Shape
                            key={i}
                            {...commonProps}
                            strokeWidth={shouldRenderStrokes ? (passStrokeWidth + (actualStrokeWidth > 0 && actualStrokeWidth <= 0.5 ? 0.2 : 0)) : 0}
                            sceneFunc={(ctx, shape) => {
                                drawJitteryCircle(ctx, bubble.width / 2 + curX, bubble.height / 2 + curY, currentRadius, bubble.deformation ?? 1)
                                if (shouldRenderFills && shouldRenderStrokes) ctx.fillStrokeShape(shape)
                                else if (shouldRenderFills) ctx.fillShape(shape)
                                else if (shouldRenderStrokes) ctx.strokeShape(shape)
                            }}
                        />
                    );
                }
                return <Group>{circles}</Group>;
            })()}

            {renderShape()}

            {shouldRenderText && (() => {
                const paddingRatio = getBubbleInnerPaddingRatio(bubble.type)
                const innerSizeRatio = getBubbleInnerSizeRatio(bubble.type)
                const tw = bubble.width * innerSizeRatio
                const th = bubble.height * innerSizeRatio
                const weightLevel = resolveTextWeightLevel(bubble)
                const roughness = clampRoughness(bubble)
                const baseFontStyle = resolveBaseFontStyle(weightLevel)

                return (
                    <Group
                        x={bubble.width * paddingRatio + (bubble.textOffsetX || 0)}
                        y={bubble.height * paddingRatio + (bubble.textOffsetY || 0)}
                        width={tw}
                        height={th}
                        clipX={0}
                        clipY={0}
                        clipWidth={tw}
                        clipHeight={th}
                        listening={false}
                    >
                        {bubble.type !== 'megaphone' && (bubble.isVertical ? (
                            <VerticalText
                                text={bubble.text}
                                fontSize={bubble._overrideFontSize ?? bubble.fontSize}
                                fontColor={bubble.fontColor}
                                strokeColor={bubble.textStrokeColor}
                                strokeWidth={bubble.textStrokeWidth}
                                weightLevel={weightLevel}
                                roughness={roughness}
                                fontFamily={bubble._overrideFontFamily ?? bubble.fontFamily}
                                fontWeight={baseFontStyle}
                                width={tw}
                                height={th}
                                lineHeight={bubble._overrideLineHeight ?? bubble.lineHeight ?? 1.0}
                                letterSpacing={bubble.letterSpacing ?? 0}
                            />
                        ) : (
                            <BubbleHorizontalTextLayers
                                bubble={bubble}
                                tw={tw}
                                th={th}
                                weightLevel={weightLevel}
                                baseFontStyle={baseFontStyle}
                            />
                        ))}
                        {bubble.type === 'megaphone' && (
                            <MegaphoneText
                                text={bubble.text}
                                fontSize={bubble._overrideFontSize ?? bubble.fontSize}
                                fontColor={bubble.fontColor}
                                strokeColor={bubble.textStrokeColor}
                                strokeWidth={bubble.textStrokeWidth}
                                weightLevel={weightLevel}
                                roughness={roughness}
                                fontFamily={bubble._overrideFontFamily ?? bubble.fontFamily}
                                fontWeight={baseFontStyle}
                                width={tw}
                                height={th}
                                narrowRatio={bubble.narrowRatio ?? 0.3}
                                isVertical={!!bubble.isVertical}
                                lineHeight={bubble._overrideLineHeight ?? bubble.lineHeight ?? 1.0}
                                letterSpacing={bubble.letterSpacing ?? 0}
                            />
                        )}
                    </Group>
                )
            })()}

            {isInteractive && isSelected && (
                <Group>
                    <Circle
                        x={bubble.width / 2 + (bubble.tailX || 0)}
                        y={bubble.height / 2 + (bubble.tailY || 0)}
                        radius={8}
                        fill="#3b82f6"
                        stroke="white"
                        strokeWidth={2}
                        draggable
                        onDragStart={(e) => { e.cancelBubble = true }}
                        onDragMove={(e) => {
                            e.cancelBubble = true
                            const dx = e.target.x() - bubble.width / 2
                            const dy = e.target.y() - bubble.height / 2
                            onUpdate(bubble.id, { tailX: dx, tailY: dy }, false)
                        }}
                        onDragEnd={(e) => {
                            e.cancelBubble = true
                            const dx = e.target.x() - bubble.width / 2
                            const dy = e.target.y() - bubble.height / 2
                            onUpdate(bubble.id, { tailX: dx, tailY: dy }, true)
                        }}
                    />
                    {(bubble.tailX !== 0 || bubble.tailY !== 0) && (
                        <Circle
                            x={bubble.width / 2 + (bubble.tailControlX || ((bubble.tailX || 0) / 2))}
                            y={bubble.height / 2 + (bubble.tailControlY || ((bubble.tailY || 0) / 2))}
                            radius={6}
                            fill="#10b981"
                            stroke="white"
                            strokeWidth={2}
                            draggable
                            onDragStart={(e) => { e.cancelBubble = true }}
                            onDragMove={(e) => {
                                e.cancelBubble = true
                                const dx = e.target.x() - bubble.width / 2
                                const dy = e.target.y() - bubble.height / 2
                                onUpdate(bubble.id, { tailControlX: dx, tailControlY: dy }, false)
                            }}
                            onDragEnd={(e) => {
                                e.cancelBubble = true
                                const dx = e.target.x() - bubble.width / 2
                                const dy = e.target.y() - bubble.height / 2
                                onUpdate(bubble.id, { tailControlX: dx, tailControlY: dy }, true)
                            }}
                        />
                    )}
                </Group>
            )}
        </Group>
    )
}

export const BubbleClusterGroup: React.FC<{ members: BubbleRenderProps[] }> = ({ members }) => {
    const bgRef = useRef<Konva.Group>(null)
    const master = members[0]

    // Use stringified members to detect ANY change and trigger cache update
    const hash = JSON.stringify(members)

    useEffect(() => {
        if (!bgRef.current) return
        bgRef.current.clearCache()

        // Gather unique fonts and await loading before caching so Google Fonts render correctly
        const fontFamilies = [...new Set(members.map(b => b._overrideFontFamily ?? b.fontFamily).filter(Boolean))]
        const weight = master.fontWeight || 'bold'
        const size = master.fontSize || 18
        // メンバー全員の実テキストを渡し、必要な日本語サブセット（「が」等）まで確実に読み込む。
        // text を省くと ' ' のサブセットしか読まれず、一部の文字が欠けたまま cache されてしまう。
        const memberText = [...new Set(members.map(b => b.text ?? '').join('').split(''))].join('')

        Promise.all(fontFamilies.map(f =>
            document.fonts.load(`${weight} ${size}px ${f}`, memberText).catch(() => {})
        )).then(() => {
            if (!bgRef.current) return
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

            bgRef.current.cache({
                x: minX - pad,
                y: minY - pad,
                width: (maxX - minX) + pad * 2,
                height: (maxY - minY) + pad * 2,
                pixelRatio: window.devicePixelRatio || 2
            })
        })
    }, [hash])

    return (
        <Group
            opacity={master.opacity ?? 1}
            listening={false}
        >
            {/* 1. Background Mass: Fills and Strokes flattened into one mass */}
            <Group 
                ref={bgRef} 
                opacity={master.backgroundOpacity ?? 1}
                shadowColor="black"
                shadowBlur={5}
                shadowOpacity={0.1 * (master.backgroundOpacity ?? 1)}
                shadowOffset={{ x: 2, y: 2 }}
            >
                {/* Strokes (Below) */}
                <Group>
                    {members.map(b => (
                        <BubbleItem key={`strokes-${b.id}`} bubble={b} isSelected={false} onSelect={() => { }} onUpdate={() => { }} renderPass="strokes" overrideOpacity={1} overrideShadow={false} clipPoints={(b as any).clipPoints} panels={[]} />
                    ))}
                </Group>
                
                {/* Mask (destination-out to wipe inner strokes) */}
                <Group globalCompositeOperation="destination-out">
                    {members.map(b => (
                        <BubbleItem key={`mask-${b.id}`} bubble={b} isSelected={false} onSelect={() => { }} onUpdate={() => { }} renderPass="mask" overrideOpacity={1} overrideShadow={false} clipPoints={(b as any).clipPoints} panels={[]} />
                    ))}
                </Group>

                {/* Fills (At 100% opacity in this pass) */}
                <Group globalCompositeOperation="source-over">
                    {members.map(b => (
                        <BubbleItem key={`fills-${b.id}`} bubble={b} isSelected={false} onSelect={() => { }} onUpdate={() => { }} renderPass="fills" overrideOpacity={1} overrideShadow={false} clipPoints={(b as any).clipPoints} panels={[]} />
                    ))}
                </Group>
            </Group>

            {/* 2. Text Layer: Drawn on top of the flattened mass */}
            <Group>
                {members.map(b => (
                    <BubbleItem key={`text-${b.id}`} bubble={b} isSelected={false} onSelect={() => { }} onUpdate={() => { }} renderPass="text" overrideOpacity={1} overrideShadow={false} clipPoints={(b as any).clipPoints} panels={[]} />
                ))}
            </Group>
        </Group>
    )
}
