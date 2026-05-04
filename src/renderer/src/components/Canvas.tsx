import React, { useEffect, useMemo } from 'react'
import { Stage, Layer, Group, Rect } from 'react-konva'
import Konva from 'konva'
import { useMangaStore } from '../store/useMangaStore'
import { PanelItem } from './PanelItem'
import { BubbleItem, BubbleClusterGroup } from './BubbleItem'
import { MaterialItem } from './MaterialItem'
import { MosaicItem } from './effects/MosaicItem'
import { getClippedPoints } from './utils/geometry'
import { PageBackgroundImageLayer } from './PageBackgroundImageLayer'
import { snapToGrid } from '../utils/gridUtils'
import { getVisualClusters } from './Canvas/helpers'
import { useDropImage } from './Canvas/useDropImage'
import { useMosaicDrawing } from './Canvas/useMosaicDrawing'
import { useGridGuides } from './Canvas/useGridGuides'
import { useTransformers } from './Canvas/useTransformers'
import { PageBackground } from './Canvas/PageBackground'
import { CanvasTransformers } from './Canvas/CanvasTransformers'

const Canvas: React.FC<{ stageRef: React.RefObject<Konva.Stage | null> }> = ({ stageRef }) => {
    const {
        pages,
        currentPageId,
        currentProjectPath,
        updatePanel,
        selectedPanelId,
        setSelectedPanel,
        selectedBubbleId,
        setSelectedBubble,
        updateBubble,
        selectedMaterialId,
        setSelectedMaterial,
        addMaterial,
        updateMaterial,
        isExporting,
        mosaicType,
        mosaicVisible,
        isMosaicMode,
        selectedMosaicId,
        addMosaic,
        setSelectedMosaicId
    } = useMangaStore()

    const currentPage = pages.find((p) => p.id === currentPageId)
    const canvasWidth = currentPage?.pageWidth ?? 840
    const canvasHeight = currentPage?.pageHeight ?? 1188
    const panels = currentPage?.panels || []
    const bubbles = currentPage?.bubbles || []
    const materials = currentPage?.materials || []
    const [isShiftPressed, setIsShiftPressed] = React.useState(false)
    const selectedPanel = panels.find((p) => p.id === selectedPanelId)
    const selectedBubble = bubbles.find((b) => b.id === selectedBubbleId)
    const selectedMaterial = materials.find((m) => m.id === selectedMaterialId)
    // Shift はパネル背景画像の編集にも使うが、吹き出し選択中の Shift 操作は許可したい
    const isBubbleInteractionLocked = !!(isShiftPressed && selectedPanel?.imagePath && !selectedBubbleId)

    useEffect(() => {
        const onKeyDown = (evt: KeyboardEvent): void => {
            if (evt.key === 'Shift') setIsShiftPressed(true)
            if (evt.key === 'Backspace' || evt.key === 'Delete') {
                const { isMosaicMode: mode, selectedMosaicId: mid } = useMangaStore.getState()
                if (mode && mid) {
                    evt.preventDefault()
                    useMangaStore.getState().removeMosaic(mid)
                    useMangaStore.getState().setSelectedMosaicId(null)
                }
            }
        }
        const onKeyUp = (evt: KeyboardEvent): void => {
            if (evt.key === 'Shift') setIsShiftPressed(false)
        }
        const onBlur = (): void => setIsShiftPressed(false)
        window.addEventListener('keydown', onKeyDown)
        window.addEventListener('keyup', onKeyUp)
        window.addEventListener('blur', onBlur)
        return () => {
            window.removeEventListener('keydown', onKeyDown)
            window.removeEventListener('keyup', onKeyUp)
            window.removeEventListener('blur', onBlur)
        }
    }, [])

    const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>): void => {
        if (isMosaicMode) return
        if (e.target === e.target.getStage()) {
            setSelectedPanel(null)
            setSelectedBubble(null)
            setSelectedMaterial(null)
            return
        }
    }

    const {
        mosaicDrawing,
        mosaicStart,
        mosaicCurrent,
        handleMouseDown: handleMosaicMouseDown,
        handleMouseMove: handleMosaicMouseMove,
        handleMouseUp: handleMosaicMouseUp
    } = useMosaicDrawing({
        stageRef,
        isMosaicMode,
        mosaicType,
        addMosaic,
        setSelectedMosaicId
    })

    const handleDrop = useDropImage({
        stageRef,
        currentProjectPath,
        panels,
        selectedPanelId,
        updatePanel,
        addMaterial
    })

    const { transformerRef, bubbleTransformerRef, materialTransformerRef } = useTransformers({
        selectedPanelId,
        selectedBubbleId,
        selectedMaterialId,
        panels,
        bubbles,
        materials
    })

    const showGrid = !!currentPage?.gridEnabled
    const snap = (value: number): number => snapToGrid(value, currentPage)

    const { gridLines, snapGuides } = useGridGuides({
        currentPage,
        canvasWidth,
        canvasHeight,
        selectedPanel,
        selectedBubble,
        selectedMaterial
    })

    const underFrameClusters = useMemo(() => getVisualClusters(bubbles.filter((b) => b.isClipped), panels), [bubbles, panels])
    const overFrameClusters = useMemo(() => getVisualClusters(bubbles.filter((b) => !b.isClipped), panels), [bubbles, panels])

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
                    onMouseDown={isMosaicMode ? handleMosaicMouseDown : undefined}
                    onMouseMove={isMosaicMode ? handleMosaicMouseMove : undefined}
                    onMouseUp={isMosaicMode ? handleMosaicMouseUp : undefined}
                    style={{ cursor: isMosaicMode ? 'crosshair' : undefined }}
                >
                    <Layer>
                        {/* 1. Background Layer */}
                        <Group>
                            <PageBackground currentPage={currentPage} canvasWidth={canvasWidth} canvasHeight={canvasHeight} />
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
                            const panelBubbles = bubbles.filter((b) => b.isClipped && b.panelId === panel.id)
                            const panelMaterials = materials.filter((m) => m.isClipped && m.panelId === panel.id)
                            const panelUnderFrameClusters = getVisualClusters(panelBubbles, panels)

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
                                    {panelMaterials.map((m) => (
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
                            )
                        })}

                        {/* 3. Handle any clipped items that might not have a panelId (fallback/safety) */}
                        <Group>
                            {(() => {
                                const orphanedBubbles = bubbles.filter((b) => b.isClipped && (!b.panelId || !panels.find((p) => p.id === b.panelId)))
                                const orphanedClusters = getVisualClusters(orphanedBubbles, panels)
                                return orphanedClusters.map((cluster) => (
                                    <BubbleClusterGroup key={`cluster-orphaned-${cluster.id}`} members={cluster.members} />
                                ))
                            })()}
                            {materials.filter((m) => m.isClipped && (!m.panelId || !panels.find((p) => p.id === m.panelId))).map((m) => (
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
                            {materials.filter((m) => !m.isClipped).map((m) => (
                                <MaterialItem key={`material-over-${m.id}`} material={m} isSelected={false} onSelect={() => { }} onUpdate={() => { }} renderPass="content" />
                            ))}
                        </Group>

                        {showGrid && !isExporting && snapGuides.length > 0 && (
                            <Group listening={false}>{snapGuides}</Group>
                        )}

                        {/* 6. Interaction Layer (Hidden during export and in mosaic mode) */}
                        {!isExporting && !isMosaicMode && (
                            <Group>
                                {/* 8.1 Base Interaction Nodes */}
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
                                        let clipPoints: number[] | undefined = undefined
                                        if (b.isClipped && b.panelId) {
                                            const panel = panels.find((p) => p.id === b.panelId)
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
                                <CanvasTransformers
                                    transformerRef={transformerRef}
                                    bubbleTransformerRef={bubbleTransformerRef}
                                    materialTransformerRef={materialTransformerRef}
                                    showGrid={showGrid}
                                    snap={snap}
                                    selectedBubbleId={selectedBubbleId}
                                    selectedMaterialId={selectedMaterialId}
                                />
                            </Group>
                        )}

                        {/* 7. Mosaic Layer (最上位に描画。sceneFunc の getImageData は panels を正しく読む) */}
                        {mosaicVisible && (currentPage?.mosaics || []).length > 0 && (
                            <Group>
                                {(currentPage?.mosaics || []).map((region) => (
                                    <MosaicItem
                                        key={region.id}
                                        region={region}
                                        isSelected={selectedMosaicId === region.id}
                                        isMosaicMode={isMosaicMode}
                                        onSelect={(id) => {
                                            if (isMosaicMode) setSelectedMosaicId(id)
                                        }}
                                        isExporting={isExporting}
                                    />
                                ))}
                            </Group>
                        )}

                        {/* 8. Mosaic rubber-band preview */}
                        {mosaicDrawing && mosaicStart && mosaicCurrent && (
                            <Rect
                                x={Math.min(mosaicStart.x, mosaicCurrent.x)}
                                y={Math.min(mosaicStart.y, mosaicCurrent.y)}
                                width={Math.abs(mosaicCurrent.x - mosaicStart.x)}
                                height={Math.abs(mosaicCurrent.y - mosaicStart.y)}
                                stroke="#3b82f6"
                                strokeWidth={2}
                                dash={[6, 4]}
                                fill="rgba(59,130,246,0.08)"
                                listening={false}
                            />
                        )}
                    </Layer>
                </Stage>
            </div>
        </div>
    )
}

export default Canvas
