import React, { useRef, useEffect } from 'react'
import { Group, Shape, Text, Circle } from 'react-konva'
import { Bubble } from '../store/useMangaStore'
import { drawRectPath, drawJaggedPath, drawRoundedPath, drawFlashPath, drawJitteryCircle } from './utils/drawPaths'

const VerticalText: React.FC<{
    text: string;
    fontSize: number;
    fontColor: string;
    fontFamily?: string;
    fontWeight?: string;
    width: number;
    height: number;
    lineHeight?: number;
}> = ({ text, fontSize, fontColor, fontFamily = 'sans-serif', fontWeight = 'bold', width, height, lineHeight = 1.2 }) => {
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
                                fontStyle={fontWeight}
                            />
                        )
                    })}
                </Group>
            ))}
        </Group>
    )
}

export const BubbleItem: React.FC<{
    bubble: any;
    isSelected: boolean;
    onSelect: (id: string | null) => void;
    onUpdate: (id: string, props: any) => void;
    id?: string;
    renderPass?: 'strokes' | 'fills' | 'text' | 'interaction' | 'mask';
    overrideOpacity?: number;
    overrideShadow?: boolean;
}> = ({ bubble, isSelected, onSelect, onUpdate, id, renderPass, overrideOpacity, overrideShadow }) => {
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
            height: Math.max(20, (bubble.height || 100) * scaleY),
            // Scale tail offsets to maintain relative position after scale reset
            tailX: (bubble.tailX || 0) * scaleX,
            tailY: (bubble.tailY || 0) * scaleY,
            tailControlX: bubble.tailControlX !== undefined ? bubble.tailControlX * scaleX : undefined,
            tailControlY: bubble.tailControlY !== undefined ? bubble.tailControlY * scaleY : undefined
        })
    }

    const isInteractive = renderPass === 'interaction' || !renderPass;
    const isMask = renderPass === 'mask';
    const shouldRenderStrokes = renderPass === 'strokes' || !renderPass;
    const shouldRenderFills = renderPass === 'fills' || !renderPass || isMask; // Masks are drawn using the fill logic
    const shouldRenderText = renderPass === 'text' || !renderPass;
    const { backgroundColor, borderColor, borderWidth, opacity } = bubble;

    // Read overrides if they exist
    const actualStrokeWidth = bubble._overrideBorderWidth !== undefined ? bubble._overrideBorderWidth : (borderWidth !== undefined ? borderWidth : 2)
    // When drawing strokes for merging, we draw them double width.
    const passStrokeWidth = shouldRenderStrokes && !shouldRenderFills ? actualStrokeWidth * 2 : actualStrokeWidth
    const passOpacity = overrideOpacity !== undefined ? overrideOpacity : opacity;
    const passShadow = overrideShadow !== undefined ? overrideShadow : true;

    const commonProps = {
        width: bubble.width,
        height: bubble.height,
        fill: shouldRenderFills ? (isMask ? 'black' : backgroundColor) : undefined,
        stroke: shouldRenderStrokes ? borderColor : undefined,
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
                        else if (bubble.type === 'flash') drawRoundedPath(context, bubble, bubble.width, bubble.height) // Use ellipse for selection hit area
                        else drawRoundedPath(context, bubble, bubble.width, bubble.height)
                        context.fillShape(shape)
                    }}
                />
            )
        }

        const { type, width, height } = bubble

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
            case 'flash':
                return (
                    <Shape {...commonProps} fill={undefined} sceneFunc={(c, s) => runDrawConfig(c, s, drawFlashPath)} />
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
            id={id}
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
            {/* Thought Bubble Tail Circles (Drawn behind for natural merging) */}
            {bubble.type === 'rounded' && bubble.tailType === 'thought' && (
                <>
                    {(() => {
                        const tx = bubble.tailX || 0;
                        const ty = bubble.tailY || 0;
                        const tcx = bubble.tailControlX || (tx / 2);
                        const tcy = bubble.tailControlY || (ty / 2);
                        const dist = Math.sqrt(tx * tx + ty * ty);
                        if (dist < 20) return null;

                        // Fewer circles for a cleaner look (3 to 4 max)
                        const numCircles = Math.max(3, Math.min(4, Math.floor(dist / 60)));
                        const circles: any[] = [];

                        // Base size from tailWidth
                        const maxRadius = (bubble.tailWidth || 20) / 2;

                        // Start t at ~0.4 to ensure the first circle overlaps the bubble edge
                        for (let i = 0; i < numCircles; i++) {
                            const t = 0.4 + (0.55 * (i / (numCircles - 1)));

                            // Quadratic Bezier Formula: B(t) = (1-t)^2*P0 + 2(1-t)*t*Pc + t^2*P1
                            // P0 = (0, 0), Pc = (tcx, tcy), P1 = (tx, ty)
                            const curX = (2 * (1 - t) * t * tcx) + (t * t * tx);
                            const curY = (2 * (1 - t) * t * tcy) + (t * t * ty);

                            // Radius shrinks towards the tip
                            const currentRadius = maxRadius * (1 - (t * 0.6));

                            circles.push(
                                <Shape
                                    key={i}
                                    {...commonProps}
                                    strokeWidth={shouldRenderStrokes ? (passStrokeWidth + (actualStrokeWidth <= 0.5 ? 0.2 : 0)) : 0}
                                    sceneFunc={(ctx, shape) => {
                                        drawJitteryCircle(ctx, bubble.width / 2 + curX, bubble.height / 2 + curY, currentRadius, bubble.deformation ?? 1)
                                        if (shouldRenderFills && shouldRenderStrokes) ctx.fillStrokeShape(shape)
                                        else if (shouldRenderFills) ctx.fillShape(shape)
                                        else if (shouldRenderStrokes) ctx.strokeShape(shape)
                                    }}
                                />
                            );
                        }
                        return circles;
                    })()}
                </>
            )}

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
                            fontWeight={bubble.fontWeight || 'bold'}
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
                            fontStyle={bubble.fontWeight || 'bold'}
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

export const BubbleClusterGroup: React.FC<{ members: any[] }> = ({ members }) => {
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
