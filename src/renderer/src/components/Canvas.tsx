import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Stage, Layer, Line, Transformer, Circle, Group, Rect, Shape, Text } from 'react-konva'
import useImage from 'use-image'
import { useMangaStore, Panel } from '../store/useMangaStore'
import { PanelItem } from './PanelItem'
import { BubbleItem, BubbleClusterGroup } from './BubbleItem'
import { MaterialItem } from './MaterialItem'
import { getPanelPoints } from './utils/drawPaths'
import { getClippedPoints } from './utils/geometry'

const PANEL_MIN_SIZE = 10

// --- Main Canvas Component ---

const Canvas: React.FC<{ stageRef: React.RefObject<any> }> = ({ stageRef }) => {
    const {
        pages,
        currentPageId,
        currentProjectPath,
        updatePanel,
        selectedPanelId,
        setSelectedPanel,
        selectedBubbleId,
        setSelectedBubble,
        addBubble,
        updateBubble,
        selectedMaterialId,
        setSelectedMaterial,
        addMaterial,
        updateMaterial,
        isExporting
    } = useMangaStore()
    const materialTransformerRef = useRef<any>(null)
    const transformerRef = useRef<any>(null)
    const bubbleTransformerRef = useRef<any>(null)

    const currentPage = pages.find((p) => p.id === currentPageId)
    const panels = currentPage?.panels || []
    const bubbles = currentPage?.bubbles || []

    const handleStageClick = (e: any) => {
        if (e.target === e.target.getStage()) {
            setSelectedPanel(null)
            setSelectedBubble(null)
            setSelectedMaterial(null)
            return
        }
    }

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault()
        const stage = stageRef.current
        if (!stage) return

        const pointerPos = stage.getPointerPosition()
        const files = Array.from(e.dataTransfer.files)
        const imageFile = files.find(f => f.type.startsWith('image/'))
        
        if (imageFile) {
            // In Electron, use webUtils via preload to get the native path
            let nativePath = undefined
            try {
                if (window.electron?.getPathForFile) {
                    nativePath = window.electron.getPathForFile(imageFile)
                }
            } catch (err) {
                console.error('Canvas: Error calling getPathForFile:', err)
            }
            
            if (!nativePath) {
                nativePath = (imageFile as any).path
            }

            if (nativePath && window.electron && currentProjectPath) {
                try {
                    const projectLocalPath = await window.electron.copyFileToProject(currentProjectPath, nativePath)
                    
                    // Determine natural dimensions to preserve aspect ratio
                    const img = new Image()
                    const imageUrl = window.electron.pathToUrl(projectLocalPath)
                    img.src = imageUrl
                    await new Promise((resolve) => {
                        img.onload = resolve
                        img.onerror = resolve
                    })

                    const maxDim = 200
                    let w = img.width || maxDim
                    let h = img.height || maxDim
                    const ratio = w / h
                    if (w > h) {
                        w = maxDim
                        h = maxDim / ratio
                    } else {
                        h = maxDim
                        w = maxDim * ratio
                    }

                    // Contextual drop logic
                    let targetPanel: Panel | undefined = undefined;
                    
                    if (selectedPanelId) {
                        targetPanel = panels.find(p => p.id === selectedPanelId);
                    }
                    
                    if (!targetPanel) {
                        const panelsUnderPointer = panels.filter(p => {
                            return pointerPos.x >= p.x && pointerPos.x <= p.x + p.width && pointerPos.y >= p.y && pointerPos.y <= p.y + p.height
                        })
                        targetPanel = panelsUnderPointer[panelsUnderPointer.length - 1] // Topmost panel
                    }

                    // Improve position calculation using the stage's absolute transform
                    const stageBox = stage.container().getBoundingClientRect()
                    const x = (e.clientX - stageBox.left)
                    const y = (e.clientY - stageBox.top)

                    if (targetPanel && !targetPanel.imagePath) {
                        // First image on empty panel: Set as background
                        updatePanel(targetPanel.id, {
                            imagePath: projectLocalPath,
                            imageScale: 1,
                            imageRotation: 0,
                            imageX: targetPanel.width / 2,
                            imageY: targetPanel.height / 2
                        })
                    } else if (targetPanel) {
                        // Subsequent image or dropped on panel with background: Create Material (clipped)
                        addMaterial({
                            imagePath: projectLocalPath,
                            x: x - w / 2,
                            y: y - h / 2,
                            width: w,
                            height: h,
                            isClipped: true,
                            panelId: targetPanel.id
                        })
                    } else {
                        // Dropped on empty canvas: Create Material (unclipped)
                        addMaterial({
                            imagePath: projectLocalPath,
                            x: x - w / 2,
                            y: y - h / 2,
                            width: w,
                            height: h,
                            isClipped: false
                        })
                    }
                } catch (error) {
                    console.error('Canvas: Failed to copy dropped image to project:', error)
                }
            }
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

    useEffect(() => {
        if (selectedMaterialId && materialTransformerRef.current) {
            const stage = materialTransformerRef.current.getStage()
            const node = stage?.findOne('#interaction-material-' + selectedMaterialId)
            if (node) {
                materialTransformerRef.current.nodes([node])
                materialTransformerRef.current.forceUpdate()
                materialTransformerRef.current.getLayer()?.batchDraw()
            }
        } else {
            materialTransformerRef.current?.nodes([])
        }
    }, [selectedMaterialId, currentPage?.materials])

    const materials = currentPage?.materials || []

    const getVisualClusters = (bubblesToCluster: any[]) => {
        const checkOverlap = (b1: any, b2: any) => {
            const r1 = { x: b1.x, y: b1.y, w: b1.width, h: b1.height }
            const r2 = { x: b2.x, y: b2.y, w: b2.width, h: b2.height }
            return !(r2.x >= r1.x + r1.w || r2.x + r2.w <= r1.x || r2.y >= r1.y + r1.h || r2.y + r2.h <= r1.y)
        }
        const clusters: { master: any; members: any[] }[] = []
        bubblesToCluster.forEach((b) => {
            let foundCluster = false
            for (const cluster of clusters) {
                const master = cluster.master
                if (master.type === b.type && master.backgroundColor === b.backgroundColor && master.borderColor === b.borderColor) {
                    if (cluster.members.some(member => checkOverlap(member, b))) {
                        cluster.members.push(b)
                        foundCluster = true
                        break
                    }
                }
            }
            if (!foundCluster) clusters.push({ master: b, members: [b] })
        })
        return clusters.map(c => ({
            id: c.master.id,
            members: c.members.map(b => {
                const clipPoints = getClippedPoints({
                    isClipped: b.isClipped,
                    panelId: b.panelId,
                    x: b.x,
                    y: b.y,
                    rotation: 0
                }, panels)
                return {
                    ...b,
                    _overrideFontFamily: c.master.fontFamily,
                    _overrideFontSize: c.master.fontSize,
                    _overrideBorderWidth: c.master.borderWidth,
                    clipPoints
                }
            })
        }))
    }

    const underFrameClusters = useMemo(() => getVisualClusters(bubbles.filter(b => b.isClipped)), [bubbles, panels])
    const overFrameClusters = useMemo(() => getVisualClusters(bubbles.filter(b => !b.isClipped)), [bubbles, panels])

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

                        {/* 3.1 Under-Frame Bubbles Layer (Clipped bubbles stay inside frames) */}
                        <Group>
                            {underFrameClusters.map((cluster) => (
                                <BubbleClusterGroup key={`cluster-under-${cluster.id}`} members={cluster.members} />
                            ))}
                        </Group>

                        {/* 3.2 Under-Frame Materials Layer (Clipped materials stay inside frames) */}
                        <Group>
                            {materials.filter(m => m.isClipped).map(m => (
                                <MaterialItem key={`material-under-${m.id}`} material={m} isSelected={false} onSelect={() => { }} onUpdate={() => { }} renderPass="content" clipPoints={getClippedPoints(m, panels)} />
                            ))}
                        </Group>
 
                        {/* 4. Panel Stroke Layer */}
                        <Group>
                            {panels.map((panel) => (
                                <PanelItem key={`strokes-${panel.id}`} panel={panel} page={currentPage} isSelected={false} onSelect={() => { }} onUpdate={() => { }} renderPass="strokes" />
                            ))}
                        </Group>
 
                        {/* 5, 6, 7. Over-Frame Bubbles Layer (Normal bubbles overlap frames) */}
                        <Group>
                            {overFrameClusters.map((cluster) => (
                                <BubbleClusterGroup key={`cluster-over-${cluster.id}`} members={cluster.members} />
                            ))}
                        </Group>

                        {/* 7.1 Over-Frame Materials Layer (Normal materials overlap frames) */}
                        <Group>
                            {materials.filter(m => !m.isClipped).map(m => (
                                <MaterialItem key={`material-over-${m.id}`} material={m} isSelected={false} onSelect={() => { }} onUpdate={() => { }} renderPass="content" />
                            ))}
                        </Group>
 
                        {/* 8. Interaction Layer (Hidden during export) */}

                        {/* 8. Interaction Layer (Hidden during export) */}
                        {!isExporting && (
                            <Group>
                                <Group>{panels.map((p) => <PanelItem key={`interaction-${p.id}`} id={`interaction-${p.id}`} panel={p} page={currentPage} isSelected={selectedPanelId === p.id} onSelect={setSelectedPanel} onUpdate={updatePanel} renderPass="interaction" />)}<Transformer
                                    ref={transformerRef}
                                    rotateEnabled={false}
                                    keepRatio={false}
                                    flipEnabled={false}
                                    boundBoxFunc={(oldBox, newBox) => {
                                        if (newBox.width < PANEL_MIN_SIZE || newBox.height < PANEL_MIN_SIZE) {
                                            return oldBox
                                        }
                                        return newBox
                                    }}
                                /></Group>
                                <Group>{bubbles.map((b) => {
                                    let clipPoints = undefined
                                    if (b.isClipped && b.panelId) {
                                        const panel = panels.find(p => p.id === b.panelId)
                                        if (panel) {
                                            const pts = getPanelPoints(panel)
                                            clipPoints = []
                                            for (let i = 0; i < pts.length; i += 2) {
                                                clipPoints.push(pts[i] + panel.x - b.x)
                                                clipPoints.push(pts[i + 1] + panel.y - b.y)
                                            }
                                        }
                                    }
                                    return <BubbleItem key={`interaction-${b.id}`} id={`interaction-${b.id}`} bubble={b} isSelected={selectedBubbleId === b.id} onSelect={setSelectedBubble} onUpdate={updateBubble} renderPass="interaction" clipPoints={clipPoints} />
                                })}<Transformer
                                    ref={bubbleTransformerRef}
                                    rotateEnabled={true}
                                    keepRatio={false}
                                    flipEnabled={false}
                                    rotateAnchorOffset={24}
                                    rotateAnchorCursor="crosshair"
                                    anchorStyleFunc={(anchor) => {
                                        if (anchor.hasName('rotater')) {
                                            anchor.cornerRadius(12)
                                            anchor.fill('#3b82f6')
                                            anchor.stroke('white')
                                            anchor.strokeWidth(2)
                                            anchor.width(16)
                                            anchor.height(16)
                                            anchor.offsetX(8)
                                            anchor.offsetY(8)
                                        }
                                    }}
                                    enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'top-center', 'bottom-center', 'middle-left', 'middle-right']}
                                    boundBoxFunc={(oldBox, newBox) => {
                                        if (newBox.width < 20 || newBox.height < 20) {
                                            return oldBox
                                        }
                                        return newBox
                                    }}
                                    visible={!!selectedBubbleId}
                                /></Group>
                                <Group>{materials.map((m) => (
                                    <MaterialItem
                                        key={`interaction-material-${m.id}`}
                                        id={`interaction-material-${m.id}`}
                                        material={m}
                                        isSelected={selectedMaterialId === m.id}
                                        onSelect={setSelectedMaterial}
                                        onUpdate={updateMaterial}
                                        renderPass="interaction"
                                        clipPoints={getClippedPoints(m, panels)}
                                    />
                                ))}<Transformer
                                    ref={materialTransformerRef}
                                    rotateEnabled={true}
                                    keepRatio={true}
                                    flipEnabled={false}
                                    enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
                                    visible={!!selectedMaterialId}
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
