import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Stage, Layer, Line, Transformer, Circle, Group, Rect, Shape, Text } from 'react-konva'
import useImage from 'use-image'
import Konva from 'konva'
import { useMangaStore, Panel, Bubble } from '../store/useMangaStore'
import { PanelItem } from './PanelItem'
import { BubbleItem, BubbleClusterGroup } from './BubbleItem'
import { MaterialItem } from './MaterialItem'
import { getClippedPoints } from './utils/geometry'
import { PageBackgroundImageLayer } from './PageBackgroundImageLayer'
import { snapToGrid } from '../utils/gridUtils'

const PANEL_MIN_SIZE = 10

/** Electron 旧挙動などで File に生パスが付くことがある */
type FileWithNativePath = File & { path?: string }

/**
 * ドロップ時の素材サイズ計算用。EXIF Orientation 付き JPEG はピクセルが横長でも「見た目」は縦になる。
 * `Image.width` だけだとアスペクトがずれ、Konva の矩形に引き伸ばされて縦長だけ潰れて見える。
 */
async function getOrientedImagePixelSize(file: File, fallback = 200): Promise<{ w: number; h: number }> {
    try {
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
        const w = bitmap.width
        const h = bitmap.height
        bitmap.close()
        if (w > 0 && h > 0) {
            return { w, h }
        }
    } catch {
        /* HEIC 等で createImageBitmap が失敗する場合あり */
    }
    try {
        const url = URL.createObjectURL(file)
        const img = new Image()
        img.decoding = 'async'
        img.src = url
        await new Promise<void>((resolve) => {
            img.onload = () => resolve()
            img.onerror = () => resolve()
        })
        const w = img.naturalWidth || img.width || fallback
        const h = img.naturalHeight || img.height || fallback
        URL.revokeObjectURL(url)
        return { w, h }
    } catch {
        return { w: fallback, h: fallback }
    }
}

// --- Main Canvas Component ---

const Canvas: React.FC<{ stageRef: React.RefObject<Konva.Stage> }> = ({ stageRef }) => {
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
    const transformerRef = useRef<Konva.Transformer>(null)
    const bubbleTransformerRef = useRef<Konva.Transformer>(null)

    const currentPage = pages.find((p) => p.id === currentPageId)
    const canvasWidth = currentPage?.pageWidth ?? 840
    const canvasHeight = currentPage?.pageHeight ?? 1188
    const panels = currentPage?.panels || []
    const bubbles = currentPage?.bubbles || []
    const [isShiftPressed, setIsShiftPressed] = useState(false)
    const selectedPanel = panels.find((p) => p.id === selectedPanelId)
    // Shift はパネル背景画像の編集にも使うが、吹き出し選択中の Shift 操作は許可したい
    const isBubbleInteractionLocked = !!(isShiftPressed && selectedPanel?.imagePath && !selectedBubbleId)

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

    const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
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

        // HTML5 の drop は Stage の pointer イベントを通らない。Konva と同じ式で論理座標にする
        // （setPointersPositions が content の scaleX/Y も踏まえる。ずれるとクリップ素材の位置・ヒットが壊れる）
        stage.setPointersPositions(e.nativeEvent)
        const pointerPos = stage.getPointerPosition()
        if (!pointerPos) return
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
                nativePath = (imageFile as FileWithNativePath).path
            }

            if (nativePath && window.electron && currentProjectPath) {
                try {
                    const { w: nw, h: nh } = await getOrientedImagePixelSize(imageFile)
                    const projectLocalPath = await window.electron.copyFileToProject(currentProjectPath, nativePath)

                    const maxDim = 200
                    let w = nw || maxDim
                    let h = nh || maxDim
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

                    const x = pointerPos.x - w / 2
                    const y = pointerPos.y - h / 2

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
                            x,
                            y,
                            width: w,
                            height: h,
                            isClipped: true,
                            panelId: targetPanel.id
                        })
                    } else {
                        // Dropped on empty canvas: Create Material (unclipped)
                        addMaterial({
                            imagePath: projectLocalPath,
                            x,
                            y,
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

    const getVisualClusters = (bubblesToCluster: Bubble[]) => {
        const checkOverlap = (b1: Bubble, b2: Bubble) => {
            const r1 = { x: b1.x, y: b1.y, w: b1.width, h: b1.height }
            const r2 = { x: b2.x, y: b2.y, w: b2.width, h: b2.height }
            return !(r2.x >= r1.x + r1.w || r2.x + r2.w <= r1.x || r2.y >= r1.y + r1.h || r2.y + r2.h <= r1.y)
        }
        const clusters: { master: Bubble; members: Bubble[] }[] = []
        bubblesToCluster.forEach((b) => {
            let foundCluster = false
            for (const cluster of clusters) {
                const master = cluster.master
                if (master.type === b.type && master.backgroundColor === b.backgroundColor && master.borderColor === b.borderColor && master.backgroundOpacity === b.backgroundOpacity) {
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
                    rotation: b.rotation || 0
                }, panels)
                return {
                    ...b,
                    _overrideFontFamily: c.master.fontFamily,
                    _overrideFontSize: c.master.fontSize,
                    _overrideBorderWidth: c.master.borderWidth,
                    _overrideBackgroundColor: c.master.backgroundColor,
                    _overrideBorderColor: c.master.borderColor,
                    _overrideBackgroundOpacity: c.master.backgroundOpacity,
                    _overrideLineHeight: c.master.lineHeight,
                    clipPoints
                }
            })
        }))
    }

    const underFrameClusters = useMemo(() => getVisualClusters(bubbles.filter(b => b.isClipped)), [bubbles, panels])
    const overFrameClusters = useMemo(() => getVisualClusters(bubbles.filter(b => !b.isClipped)), [bubbles, panels])
    const showGrid = !!currentPage?.gridEnabled
    const gridSize = Math.max(8, Number(currentPage?.gridSize ?? 24))
    const snap = (value: number) => snapToGrid(value, currentPage)
    const selectedBubble = bubbles.find((b) => b.id === selectedBubbleId)
    const selectedMaterial = materials.find((m) => m.id === selectedMaterialId)
    const snapGuides = useMemo(() => {
        if (!showGrid) return []
        const target =
            (selectedPanel ? { x: selectedPanel.x, y: selectedPanel.y, width: selectedPanel.width, height: selectedPanel.height } : null) ||
            (selectedBubble ? { x: selectedBubble.x, y: selectedBubble.y, width: selectedBubble.width, height: selectedBubble.height } : null) ||
            (selectedMaterial ? { x: selectedMaterial.x, y: selectedMaterial.y, width: selectedMaterial.width, height: selectedMaterial.height } : null)
        if (!target) return []

        const x1 = snap(target.x)
        const y1 = snap(target.y)
        const x2 = snap(target.x + target.width)
        const y2 = snap(target.y + target.height)
        const cx = snap(target.x + target.width / 2)
        const cy = snap(target.y + target.height / 2)

        return [
            <Line key="guide-v-left" points={[x1, 0, x1, canvasHeight]} stroke="rgba(59,130,246,0.8)" strokeWidth={1} dash={[6, 4]} listening={false} />,
            <Line key="guide-v-right" points={[x2, 0, x2, canvasHeight]} stroke="rgba(59,130,246,0.8)" strokeWidth={1} dash={[6, 4]} listening={false} />,
            <Line key="guide-h-top" points={[0, y1, canvasWidth, y1]} stroke="rgba(59,130,246,0.8)" strokeWidth={1} dash={[6, 4]} listening={false} />,
            <Line key="guide-h-bottom" points={[0, y2, canvasWidth, y2]} stroke="rgba(59,130,246,0.8)" strokeWidth={1} dash={[6, 4]} listening={false} />,
            <Line key="guide-v-center" points={[cx, 0, cx, canvasHeight]} stroke="rgba(34,197,94,0.85)" strokeWidth={1} dash={[3, 5]} listening={false} />,
            <Line key="guide-h-center" points={[0, cy, canvasWidth, cy]} stroke="rgba(34,197,94,0.85)" strokeWidth={1} dash={[3, 5]} listening={false} />
        ]
    }, [showGrid, selectedPanel, selectedBubble, selectedMaterial, canvasWidth, canvasHeight, gridSize])
    const gridLines = useMemo(() => {
        if (!showGrid) return []
        const lines: React.ReactNode[] = []
        for (let x = gridSize; x < canvasWidth; x += gridSize) {
            lines.push(
                <Line
                    key={`grid-v-${x}`}
                    points={[x, 0, x, canvasHeight]}
                    stroke="rgba(0,0,0,0.08)"
                    strokeWidth={1}
                    listening={false}
                />
            )
        }
        for (let y = gridSize; y < canvasHeight; y += gridSize) {
            lines.push(
                <Line
                    key={`grid-h-${y}`}
                    points={[0, y, canvasWidth, y]}
                    stroke="rgba(0,0,0,0.08)"
                    strokeWidth={1}
                    listening={false}
                />
            )
        }
        return lines
    }, [showGrid, gridSize, canvasWidth, canvasHeight])

    /** 選択中パネルを最後に描画し、Shift 画像編集タブが他コマより手前に来るようにする */
    const interactionPanelsOrdered = useMemo(() => {
        if (!selectedPanelId) return panels
        const rest = panels.filter((p) => p.id !== selectedPanelId)
        const sel = panels.find((p) => p.id === selectedPanelId)
        return sel ? [...rest, sel] : panels
    }, [panels, selectedPanelId])

    return (
        <div
            className="flex flex-col items-center justify-center min-h-full py-12"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
        >
            <div className="bg-white shadow-2xl origin-top" style={{ width: canvasWidth, height: canvasHeight }}>
                <Stage
                    ref={stageRef}
                    width={canvasWidth}
                    height={canvasHeight}
                    onClick={handleStageClick}
                    onTap={handleStageClick}
                >
                    <Layer>
                        {/* 1. Background Layer */}
                        <Group>
                            {(() => {
                                const bgType = currentPage?.bgGradientType || 'none';
                                const bgColor = currentPage?.backgroundColor || '#ffffff';
                                const bgOpacity = currentPage?.backgroundOpacity ?? 1;
                                const startColor = currentPage?.bgGradientStartColor || bgColor;
                                const endColor = currentPage?.bgGradientEndColor || '#ffffff';
                                const rotation = (currentPage?.bgGradientRotation || 0) * Math.PI / 180;

                                const bgProps: Partial<Konva.LineConfig> = { opacity: bgOpacity };
                                if (bgType === 'none') {
                                    bgProps.fill = bgColor;
                                } else if (bgType === 'linear') {
                                    const radius = Math.sqrt(canvasWidth ** 2 + canvasHeight ** 2) / 2;
                                    const cx = canvasWidth / 2;
                                    const cy = canvasHeight / 2;
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
                                    const cx = canvasWidth / 2;
                                    const cy = canvasHeight / 2;
                                    const radius = Math.max(canvasWidth, canvasHeight) / 2;
                                    bgProps.fillRadialGradientStartPoint = { x: cx, y: cy };
                                    bgProps.fillRadialGradientEndPoint = { x: cx, y: cy };
                                    bgProps.fillRadialGradientStartRadius = 0;
                                    bgProps.fillRadialGradientEndRadius = radius;
                                    bgProps.fillRadialGradientColorStops = [0, startColor, 1, endColor];
                                }

                                return (
                                    <Line
                                        points={[0, 0, canvasWidth, 0, canvasWidth, canvasHeight, 0, canvasHeight]}
                                        closed
                                        {...bgProps}
                                        listening={false}
                                    />
                                );
                            })()}
                            <PageBackgroundImageLayer
                                page={currentPage}
                                canvasWidth={canvasWidth}
                                canvasHeight={canvasHeight}
                                projectPath={currentProjectPath}
                            />
                            {showGrid && !isExporting && <Group>{gridLines}</Group>}
                        </Group>
 
                        {/* 2. Panels and their clipped contents */}
                        {panels.map((panel) => {
                            const panelBubbles = bubbles.filter(b => b.isClipped && b.panelId === panel.id);
                            const panelMaterials = materials.filter(m => m.isClipped && m.panelId === panel.id);
                            const panelUnderFrameClusters = getVisualClusters(panelBubbles);

                            return (
                                <Group key={`panel-stack-${panel.id}`}>
                                    {/* Content layer for this panel */}
                                    <PanelItem 
                                        panel={panel} 
                                        page={currentPage!}
                                        isSelected={false} 
                                        onSelect={() => { }} 
                                        onUpdate={() => { }} 
                                        renderPass="content" 
                                    />
                                    {/* Effects layer for this panel */}
                                    <PanelItem 
                                        panel={panel} 
                                        page={currentPage!}
                                        isSelected={false} 
                                        onSelect={() => { }} 
                                        onUpdate={() => { }} 
                                        renderPass="effects" 
                                    />
                                    {/* Under-Frame Bubbles for this panel */}
                                    {panelUnderFrameClusters.map((cluster) => (
                                        <BubbleClusterGroup key={`cluster-under-${panel.id}-${cluster.id}`} members={cluster.members} />
                                    ))}
                                    {/* Under-Frame Materials for this panel */}
                                    {panelMaterials.map(m => (
                                        <MaterialItem 
                                            key={`material-under-${panel.id}-${m.id}`} 
                                            material={m} 
                                            isSelected={false} 
                                            onSelect={() => { }} 
                                            onUpdate={() => { }} 
                                            renderPass="content" 
                                            clipPoints={getClippedPoints(m, panels)} 
                                        />
                                    ))}
                                    {/* Stroke layer for this panel */}
                                    <PanelItem 
                                        panel={panel} 
                                        page={currentPage!}
                                        isSelected={false} 
                                        onSelect={() => { }} 
                                        onUpdate={() => { }} 
                                        renderPass="strokes" 
                                    />
                                </Group>
                            );
                        })}

                        {/* 3. Handle any clipped items that might not have a panelId (fallback/safety) */}
                        <Group>
                            {(() => {
                                const orphanedBubbles = bubbles.filter(b => b.isClipped && (!b.panelId || !panels.find(p => p.id === b.panelId)));
                                const orphanedClusters = getVisualClusters(orphanedBubbles);
                                return orphanedClusters.map(cluster => (
                                    <BubbleClusterGroup key={`cluster-orphaned-${cluster.id}`} members={cluster.members} />
                                ));
                            })()}
                            {materials.filter(m => m.isClipped && (!m.panelId || !panels.find(p => p.id === m.panelId))).map(m => (
                                <MaterialItem 
                                    key={`material-orphaned-${m.id}`} 
                                    material={m} 
                                    isSelected={false} 
                                    onSelect={() => { }} 
                                    onUpdate={() => { }} 
                                    renderPass="content" 
                                    clipPoints={getClippedPoints(m, panels)} 
                                />
                            ))}
                        </Group>
 
                        {/* 4. Over-Frame Bubbles Layer (Normal bubbles overlap frames) */}
                        <Group>
                            {overFrameClusters.map((cluster) => (
                                <BubbleClusterGroup key={`cluster-over-${cluster.id}`} members={cluster.members} />
                            ))}
                        </Group>

                        {/* 5. Over-Frame Materials Layer (Normal materials overlap frames) */}
                        <Group>
                            {materials.filter(m => !m.isClipped).map(m => (
                                <MaterialItem key={`material-over-${m.id}`} material={m} isSelected={false} onSelect={() => { }} onUpdate={() => { }} renderPass="content" />
                            ))}
                        </Group>

                        {showGrid && !isExporting && snapGuides.length > 0 && (
                            <Group listening={false}>{snapGuides}</Group>
                        )}
 
                        {/* 8. Interaction Layer (Hidden during export) */}

                        {/* 8. Interaction Layer (Hidden during export) */}
                        {!isExporting && (
                            <Group>
                                {/* 8.1 Base Interaction Nodes */ }
                                <Group>
                                    {interactionPanelsOrdered.map((p) => (
                                        <PanelItem
                                            key={`interaction-${p.id}`}
                                            id={`interaction-${p.id}`}
                                            panel={p}
                                            page={currentPage!}
                                            isSelected={selectedPanelId === p.id}
                                            onSelect={setSelectedPanel}
                                            onUpdate={updatePanel}
                                            renderPass="interaction"
                                        />
                                    ))}
                                </Group>
                                <Group>
                                    {bubbles.map((b) => {
                                        let clipPoints = undefined
                                        if (b.isClipped && b.panelId) {
                                            const panel = panels.find(p => p.id === b.panelId)
                                            if (panel) {
                                                clipPoints = getClippedPoints(
                                                    { isClipped: true, panelId: b.panelId, x: b.x, y: b.y, rotation: b.rotation },
                                                    panels
                                                )
                                            }
                                        }
                                        return <BubbleItem key={`interaction-${b.id}`} id={`interaction-${b.id}`} bubble={b} isSelected={selectedBubbleId === b.id} onSelect={setSelectedBubble} onUpdate={updateBubble} renderPass="interaction" clipPoints={clipPoints} panels={panels} interactionLocked={isBubbleInteractionLocked} isShiftPressed={isShiftPressed} />
                                    })}
                                </Group>
                                <Group>
                                    {materials.map((m) => (
                                        <MaterialItem
                                            key={`interaction-material-${m.id}`}
                                            id={`interaction-material-${m.id}`}
                                            material={m}
                                            isSelected={selectedMaterialId === m.id}
                                            onSelect={setSelectedMaterial}
                                            onUpdate={updateMaterial}
                                            renderPass="interaction"
                                            clipPoints={getClippedPoints(m, panels)}
                                            panels={panels}
                                        />
                                    ))}
                                </Group>

                                {/* 8.2 Transformer Handles (Always on top) */}
                                <Transformer
                                    ref={transformerRef}
                                    rotateEnabled={false}
                                    keepRatio={false}
                                    flipEnabled={false}
                                    boundBoxFunc={(oldBox, newBox) => {
                                        if (newBox.width < PANEL_MIN_SIZE || newBox.height < PANEL_MIN_SIZE) {
                                            return oldBox
                                        }
                                        if (showGrid) {
                                            const width = Math.max(PANEL_MIN_SIZE, snap(newBox.width))
                                            const height = Math.max(PANEL_MIN_SIZE, snap(newBox.height))
                                            return {
                                                ...newBox,
                                                x: snap(newBox.x),
                                                y: snap(newBox.y),
                                                width,
                                                height
                                            }
                                        }
                                        return newBox
                                    }}
                                />
                                <Transformer
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
                                        if (showGrid) {
                                            return {
                                                ...newBox,
                                                x: snap(newBox.x),
                                                y: snap(newBox.y),
                                                width: Math.max(20, snap(newBox.width)),
                                                height: Math.max(20, snap(newBox.height))
                                            }
                                        }
                                        return newBox
                                    }}
                                    visible={!!selectedBubbleId}
                                />
                                <Transformer
                                    ref={materialTransformerRef}
                                    rotateEnabled={true}
                                    keepRatio={true}
                                    flipEnabled={false}
                                    enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
                                    boundBoxFunc={(oldBox, newBox) => {
                                        if (newBox.width < 5 || newBox.height < 5) {
                                            return oldBox
                                        }
                                        if (showGrid) {
                                            return {
                                                ...newBox,
                                                x: snap(newBox.x),
                                                y: snap(newBox.y),
                                                width: Math.max(5, snap(newBox.width)),
                                                height: Math.max(5, snap(newBox.height))
                                            }
                                        }
                                        return newBox
                                    }}
                                    visible={!!selectedMaterialId}
                                />
                            </Group>
                        )}
                    </Layer>
                </Stage>
            </div>
        </div>
    )
}

export default Canvas
