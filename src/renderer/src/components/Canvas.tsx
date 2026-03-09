import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Stage, Layer, Line, Transformer, Circle, Group, Rect, Shape, Text } from 'react-konva'
import useImage from 'use-image'
import { useMangaStore, Panel } from '../store/useMangaStore'
import { PanelItem } from './PanelItem'
import { BubbleItem, BubbleClusterGroup } from './BubbleItem'

const PANEL_MIN_SIZE = 10

// --- Main Canvas Component ---

const Canvas: React.FC<{ stageRef: React.RefObject<any> }> = ({ stageRef }) => {
    const {
        pages,
        currentPageId,
        updatePanel,
        selectedPanelId,
        setSelectedPanel,
        selectedBubbleId,
        setSelectedBubble,
        updateBubble,
        isExporting
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
            const node = stage?.findOne('#interaction-' + selectedPanelId)
            if (node) {
                transformerRef.current.nodes([node])
                transformerRef.current.forceUpdate() // Force sync handles to node size
                transformerRef.current.getLayer()?.batchDraw()
            }
        } else {
            transformerRef.current?.nodes([])
        }
    }, [selectedPanelId, panels]) // Re-run when panels change to sync handles after resize

    useEffect(() => {
        if (selectedBubbleId && bubbleTransformerRef.current) {
            const stage = bubbleTransformerRef.current.getStage()
            const node = stage?.findOne('#interaction-' + selectedBubbleId)
            if (node) {
                bubbleTransformerRef.current.nodes([node])
                bubbleTransformerRef.current.forceUpdate() // Force sync handles to node size
                bubbleTransformerRef.current.getLayer()?.batchDraw()
            }
        } else {
            bubbleTransformerRef.current?.nodes([])
        }
    }, [selectedBubbleId, bubbles]) // Re-run when bubbles change to sync handles after resize

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
                    ref={stageRef}
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

                        {/* 8. Interaction Layer (Hidden during export) */}
                        {!isExporting && (
                            <Group>
                                <Group>{panels.map((p) => <PanelItem key={`interaction-${p.id}`} id={`interaction-${p.id}`} panel={p} page={currentPage} isSelected={selectedPanelId === p.id} onSelect={setSelectedPanel} onUpdate={updatePanel} renderPass="interaction" />)}<Transformer
                                    ref={transformerRef}
                                    rotateEnabled={false}
                                    keepRatio={false}
                                    boundBoxFunc={(oldBox, newBox) => {
                                        if (Math.abs(newBox.width) < PANEL_MIN_SIZE || Math.abs(newBox.height) < PANEL_MIN_SIZE) {
                                            return oldBox
                                        }
                                        return newBox
                                    }}
                                /></Group>
                                <Group>{bubbles.map((b) => <BubbleItem key={`interaction-${b.id}`} id={`interaction-${b.id}`} bubble={b} isSelected={selectedBubbleId === b.id} onSelect={setSelectedBubble} onUpdate={updateBubble} renderPass="interaction" />)}<Transformer
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
                                /></Group>
                            </Group>
                        )}
                    </Layer>
                </Stage>
            </div>
        </div>
    )
}

export default Canvas
