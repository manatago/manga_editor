import React, { useEffect, useMemo, useRef, useState } from 'react'
import Konva from 'konva'
import { Group, Line } from 'react-konva'
import useImage from 'use-image'
import { Panel, useMangaStore } from '../store/useMangaStore'
import type { Page } from '../store/types'
import { getPanelPoints } from './utils/drawPaths'
import { snapToGrid } from '../utils/gridUtils'
import { computePanelAlignment } from '../utils/panelAlignment'
import { FadeOverlay } from './effects/FadeOverlay'
import { FocusLines } from './effects/FocusLines'
import { RainEffect } from './effects/RainEffect'
import { SpeedLines } from './effects/SpeedLines'
import { SoapBubbles } from './effects/SoapBubbles'
import { StippleCircles } from './effects/StippleCircles'
import { SandStorm } from './effects/SandStorm'
import { GloomLines } from './effects/GloomLines'
import { PanelStrokes } from './PanelStrokes'
import { PanelBackgroundImageLayer } from './PanelBackgroundImageLayer'
import { PanelForegroundToneLayer } from './PanelForegroundToneLayer'
import { showError } from '../utils/dialogs'
import { mangaifyImage, compositeOver, loadImage, type MangaLevel } from '../utils/manga/renderManga'
import { FocusAdjustmentHandle } from './PanelItem/FocusAdjustmentHandle'
import { ImageEditModeTabs, type ImageEditMode } from './PanelItem/ImageEditModeTabs'


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
    const [mangaBusy, setMangaBusy] = useState(false)
    const openPanelWandEditor = useMangaStore((s) => s.openPanelWandEditor)
    const points = getPanelPoints(panel)
    const setActiveAlignmentGuides = useMangaStore((s) => s.setActiveAlignmentGuides)
    const clearActiveAlignmentGuides = useMangaStore((s) => s.clearActiveAlignmentGuides)
    // 漫画化 ON のときは主画像を mangaImagePath に差し替える（元画像は非破壊で残る）
    const isMangaOn = !!panel.isManga && !!panel.mangaImagePath
    const displayImagePath = isMangaOn ? panel.mangaImagePath! : panel.imagePath
    const imagePath = useMemo(() => {
        if (!displayImagePath) return ''
        // 焼き直しは同じファイル名に上書きするため、URL にスタンプを足してキャッシュを破棄させる
        const bust = isMangaOn && panel.mangaStamp ? `?v=${panel.mangaStamp}` : ''
        if (window.electron?.resolveAssetPath && currentProjectPath) {
            return window.electron.pathToUrl(window.electron.resolveAssetPath(currentProjectPath, displayImagePath)) + bust
        }
        return (window.electron ? window.electron.pathToUrl(displayImagePath) : displayImagePath || '') + bust
    }, [displayImagePath, currentProjectPath, isMangaOn, panel.mangaStamp])
    const [image] = useImage(imagePath)
    const lineRef = useRef<Konva.Line>(null)
    const snap = (value: number) => snapToGrid(value, page)

    useEffect(() => {
        if (lineRef.current) {
            lineRef.current.clearCache()
            const effBlur = (panel.blurRadius ?? 0) + (panel.imageProtrude ? (panel.protrudeBgBlur ?? 0) : 0)
            const hasAdjust =
                panel.isGrayscale ||
                effBlur > 0 ||
                (panel.imageBrightness ?? 0) !== 0 ||
                (panel.imageContrast ?? 0) !== 0 ||
                (panel.imageSaturation ?? 0) !== 0
            if (image && hasAdjust) {
                lineRef.current.cache()
            }
        }
    }, [
        panel.isGrayscale,
        panel.grayscaleBrightness,
        panel.imageBrightness,
        panel.imageContrast,
        panel.imageSaturation,
        panel.blurRadius,
        panel.imageProtrude,
        panel.protrudeBgBlur,
        panel.protrudeBgOpacity,
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
    // 集中線・雨・スピード線・シャボン玉。effectsBehindImage の時は content パス内で
    // 人物画像の背面に、そうでない時は effects パスで前面に描く（下の JSX で出し分け）。
    const effectNodes = (
        <>
            <FocusLines panel={panel} points={points} />
            <RainEffect panel={panel} points={points} />
            <SpeedLines panel={panel} points={points} />
            <SoapBubbles panel={panel} points={points} />
            <StippleCircles panel={panel} points={points} />
            <SandStorm panel={panel} points={points} />
            <GloomLines panel={panel} points={points} />
        </>
    )
    const shouldShowImageTabs = isInteractive && isSelected && isShiftPressed
    const novelaiConnection = useMangaStore((s) => s.novelaiConnection)
    const openNovelAIForPanel = useMangaStore((s) => s.openNovelAIForPanel)
    const novelaiActive = novelaiConnection.state === 'ok'

    // 「コマからはみ出す」トグル。切り抜き(protrudeImagePath)は .ora 取り込み時の人物レイヤー、
    // または手動（ワンド）で用意する。元画像(imagePath)は壊さない。
    const handleToggleProtrude = () => {
        onUpdate(panel.id, { imageProtrude: !panel.imageProtrude })
    }

    // 「漫画の絵にする」トグル。ON で元画像を漫画化して焼き込み（非破壊：元画像は残す）、OFF で元に戻す。
    // 一度焼いた mangaImagePath は再トグル時に再利用する。.ora コマは人物切り抜きだけ漫画化し、元背景に重ねる。
    const toAbsUrl = (rel: string): string =>
        window.electron!.pathToUrl(window.electron!.resolveAssetPath(currentProjectPath!, rel))
    const handleSetManga = async (level: MangaLevel) => {
        // すでにその強さで ON なら、同じボタンをもう一度押して OFF にする
        if (panel.isManga && (panel.mangaLevel ?? 'mid') === level) {
            onUpdate(panel.id, { isManga: false })
            return
        }
        // ON／強さ変更のたびに焼き直す（決まったファイル名に上書き。常に最新の仕上がりになる）
        if (!currentProjectPath || !panel.imagePath || mangaBusy || !window.electron) {
            await showError('漫画化できる画像がありません（プロジェクト内の画像が必要です）')
            return
        }
        const abs = window.electron.resolveAssetPath(currentProjectPath, panel.imagePath)
        if (!abs) {
            await showError('プロジェクト内の画像のみ漫画化できます')
            return
        }
        setMangaBusy(true)
        try {
            const isOra = !!panel.oraSourcePath && !!panel.protrudeImagePath
            if (isOra) {
                // 人物切り抜き（protrudeImagePath）だけ漫画化し、元の merged 背景に重ねて 1 枚にする
                const [peopleImg, mergedImg] = await Promise.all([
                    loadImage(toAbsUrl(panel.protrudeImagePath!)),
                    loadImage(toAbsUrl(panel.imagePath))
                ])
                const mangaPeople = mangaifyImage(peopleImg, { isCutout: true, level })
                const composite = await compositeOver(mergedImg, mangaPeople)
                const peopleRes = await window.electron.saveMangaPng(currentProjectPath, panel.id, 'people', mangaPeople)
                const mainRes = await window.electron.saveMangaPng(currentProjectPath, panel.id, 'main', composite)
                onUpdate(
                    panel.id,
                    {
                        isManga: true,
                        mangaLevel: level,
                        mangaImagePath: mainRes.relativePath,
                        mangaProtrudePath: peopleRes.relativePath,
                        mangaStamp: Date.now()
                    },
                    true
                )
            } else {
                const srcImg = await loadImage(toAbsUrl(panel.imagePath))
                const manga = mangaifyImage(srcImg, { level })
                const mainRes = await window.electron.saveMangaPng(currentProjectPath, panel.id, 'main', manga)
                onUpdate(
                    panel.id,
                    { isManga: true, mangaLevel: level, mangaImagePath: mainRes.relativePath, mangaStamp: Date.now() },
                    true
                )
            }
        } catch (e: unknown) {
            console.error('PanelItem: manga', e)
            await showError('漫画化に失敗しました: ' + (e instanceof Error ? e.message : String(e)))
        } finally {
            setMangaBusy(false)
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
                let topLeftX = snap(pos.x - panel.width / 2)
                let topLeftY = snap(pos.y - panel.height / 2)
                // 周囲のコマとの整列スナップ（10px 以内で吸着）
                const others = (page?.panels ?? []).filter((p) => p.id !== panel.id)
                if (others.length > 0 && (panel.rotation ?? 0) === 0) {
                    const result = computePanelAlignment(
                        { x: topLeftX, y: topLeftY, width: panel.width, height: panel.height },
                        others
                    )
                    if (result.snappedX !== undefined) topLeftX = result.snappedX
                    if (result.snappedY !== undefined) topLeftY = result.snappedY
                    setActiveAlignmentGuides(result.guides)
                } else {
                    setActiveAlignmentGuides([])
                }
                return {
                    x: topLeftX + panel.width / 2,
                    y: topLeftY + panel.height / 2
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
                clearActiveAlignmentGuides()
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
                        hasImage={!!panel.imagePath}
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
                        onWand={!!currentProjectPath && !!panel.imagePath ? () => openPanelWandEditor(panel.id) : undefined}
                        imageProtrude={!!panel.imageProtrude}
                        onToggleProtrude={handleToggleProtrude}
                        isManga={!!panel.isManga}
                        mangaLevel={panel.mangaLevel}
                        mangaBusy={mangaBusy}
                        onSetManga={!!currentProjectPath && !!panel.imagePath ? handleSetManga : undefined}
                        novelaiActive={novelaiActive}
                        onNovelAI={() => openNovelAIForPanel(panel.id)}
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
                        {/* 人物の背面にエフェクト（背景と人物の間）。人物が切り抜きなら透過部から見える。 */}
                        {panel.effectsBehindImage && effectNodes}
                        {panel.imagePath && (() => {
                            // はみ出し時、コマ内に残る背景（＝この床画像）だけを薄く／ぼかせる。
                            // 人物ははみ出しオーバーレイ側で鮮明に再描画されるため影響しない。
                            const bgFade = panel.imageProtrude ? (panel.protrudeBgOpacity ?? 1) : 1
                            const effBlur = (panel.blurRadius ?? 0) + (panel.imageProtrude ? (panel.protrudeBgBlur ?? 0) : 0)
                            // 明るさは一般調整＋（グレースケール時のみ）グレー用明るさを合算
                            const effBrightness =
                                (panel.imageBrightness ?? 0) +
                                (panel.isGrayscale ? (panel.grayscaleBrightness ?? 0) : 0)
                            const effContrast = panel.imageContrast ?? 0
                            const effSaturation = panel.isGrayscale ? 0 : (panel.imageSaturation ?? 0)
                            return (
                            <Line
                                id={`panel-${panel.id}-image`}
                                ref={lineRef}
                                points={points}
                                closed={true}
                                opacity={bgFade}
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
                                    ...(effBrightness !== 0 ? [Konva.Filters.Brighten] : []),
                                    ...(effContrast !== 0 ? [Konva.Filters.Contrast] : []),
                                    ...(effSaturation !== 0 ? [Konva.Filters.HSV] : []),
                                    ...(effBlur > 0 ? [Konva.Filters.Blur] : [])
                                ]}
                                brightness={effBrightness}
                                contrast={effContrast}
                                saturation={effSaturation}
                                blurRadius={effBlur}
                            />
                            )
                        })()}
                        {panel.fgTonePath ? (
                            <PanelForegroundToneLayer panel={panel} projectPath={currentProjectPath} />
                        ) : null}
                    </Group>
                )
            })()}

            {shouldRenderStrokes && <PanelStrokes panel={panel} points={points} page={page} />}
            {shouldRenderEffects && !panel.effectsBehindImage && effectNodes}
            {shouldRenderEffects && <FadeOverlay panel={panel} points={points} backgroundColor={page?.backgroundColor || '#ffffff'} />}
            {isInteractive && panel.isAdjustingFocus && <FocusAdjustmentHandle panel={panel} onUpdate={onUpdate} />}
            {/* 角ハンドル（slanted/trapezoid）は <PanelSelectionHandles> として
                Canvas 側の最前面に描画する（吹き出し interaction の上に来てほしいため） */}
        </Group>
    )
}
