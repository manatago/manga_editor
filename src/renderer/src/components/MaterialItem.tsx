import React, { useRef, useEffect, useMemo } from 'react'
import Konva from 'konva'
import { Group, Image, Shape } from 'react-konva'
import useImage from 'use-image'
import { Material, Panel, useMangaStore } from '../store/useMangaStore'
import { findTargetPanel } from './utils/geometry'
import { snapToGrid } from '../utils/gridUtils'

interface MaterialItemProps {
    material: Material;
    isSelected: boolean;
    onSelect: (id: string | null) => void;
    onUpdate: (id: string, updates: Partial<Material>, undoable?: boolean) => void;
    id?: string;
    renderPass?: 'content' | 'interaction';
    clipPoints?: number[];
    panels?: Panel[];
}

export const MaterialItem: React.FC<MaterialItemProps> = ({
    material,
    isSelected,
    onSelect,
    onUpdate,
    id,
    renderPass,
    clipPoints,
    panels
}) => {
    const currentProjectPath = useMangaStore((s) => s.currentProjectPath)
    const currentPage = useMangaStore((s) => s.pages.find((p) => p.id === s.currentPageId))
    const snap = (value: number) => snapToGrid(value, currentPage)
    const imageUrl = useMemo(() => {
        if (!material.imagePath) return ''
        if (window.electron?.resolveAssetPath && currentProjectPath) {
            return window.electron.pathToUrl(window.electron.resolveAssetPath(currentProjectPath, material.imagePath))
        }
        if (material.imagePath.startsWith('local-file://')) return material.imagePath
        return window.electron ? window.electron.pathToUrl(material.imagePath) : ''
    }, [material.imagePath, currentProjectPath])
    const [image] = useImage(imageUrl)
    const shapeRef = useRef<any>(null)
    const imageRef = useRef<Konva.Image>(null)

    useEffect(() => {
        if (imageRef.current && image) {
            if (material.isGrayscale) {
                // キャッシュは現在の width/height で焼かれるため、リサイズ時は焼き直す。
                // （焼き直さないとキャッシュ済みビットマップが旧サイズのまま描画され、
                //   リサイズが効かない／元に戻るように見える）
                imageRef.current.cache()
            } else {
                imageRef.current.clearCache()
            }
        }
    }, [material.isGrayscale, material.grayscaleBrightness, material.width, material.height, image])

    const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
        if (e.target !== e.currentTarget) return
        const x = snap(e.target.x())
        const y = snap(e.target.y())
        const updates: Partial<Material> = { x, y }

        if (material.isClipped && panels) {
            const centerX = x + (material.width || 200) / 2
            const centerY = y + (material.height || 200) / 2
            const targetPanel = findTargetPanel(centerX, centerY, panels)
            if (targetPanel) {
                updates.panelId = targetPanel.id
            }
        }

        onUpdate(material.id, updates)
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
        const width = Math.max(5, snap(node.width() * scaleX))
        const height = Math.max(5, snap(node.height() * scaleY))
        const updates: Partial<Material> = { x, y, width, height, rotation }

        if (material.isClipped && panels) {
            const centerX = x + width / 2
            const centerY = y + height / 2
            const targetPanel = findTargetPanel(centerX, centerY, panels)
            if (targetPanel) {
                updates.panelId = targetPanel.id
            }
        }

        onUpdate(material.id, updates)
    }

    if (!image) return null

    return (
        <Group
            id={id}
            x={material.x}
            y={material.y}
            width={material.width}
            height={material.height}
            rotation={material.rotation}
            draggable={renderPass === 'interaction'}
            dragBoundFunc={(pos) => {
                if (renderPass !== 'interaction') return pos
                return {
                    x: snap(pos.x),
                    y: snap(pos.y)
                }
            }}
            onDragStart={() => renderPass === 'interaction' && onSelect(material.id)}
            onDragEnd={handleDragEnd}
            onTransformEnd={handleTransformEnd}
            onClick={() => renderPass === 'interaction' && onSelect(material.id)}
            onTap={() => renderPass === 'interaction' && onSelect(material.id)}
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
            {/* 縁取り（アウトライン）: 画像のアルファ形状をリング状にスタンプして輪郭を作り、
                source-in で縁取り色に塗り替えてから本体の下に敷く。SVG 不要で透過PNGに効く。 */}
            {material.outlineEnabled && (material.outlineWidth ?? 4) > 0 && (
                <Shape
                    listening={false}
                    perfectDrawEnabled={false}
                    width={material.width}
                    height={material.height}
                    sceneFunc={(ctx) => {
                        const w2 = material.width ?? image.width
                        const h2 = material.height ?? image.height
                        const rawCtx = (ctx as unknown as { _context: CanvasRenderingContext2D })._context
                        const tf = rawCtx.getTransform()
                        // Group の回転を含むため、純粋なスケール倍率 = √(a²+b²) を dpr とみなす
                        const dpr = Math.hypot(tf.a, tf.b) || 1
                        const physW = Math.max(1, Math.round(w2 * dpr))
                        const physH = Math.max(1, Math.round(h2 * dpr))
                        const r = Math.max(1, Math.round((material.outlineWidth ?? 4) * dpr))
                        const pad = r + 2

                        const off = document.createElement('canvas')
                        off.width = physW + pad * 2
                        off.height = physH + pad * 2
                        const octx = off.getContext('2d')
                        if (!octx) return

                        // リング状に本体を複数回スタンプ → アルファの膨張（＝輪郭）を作る
                        const samples = 16
                        for (let i = 0; i < samples; i++) {
                            const a = (i / samples) * Math.PI * 2
                            octx.drawImage(image, pad + Math.cos(a) * r, pad + Math.sin(a) * r, physW, physH)
                        }
                        // 膨張したシルエットを縁取り色で塗り替える
                        octx.globalCompositeOperation = 'source-in'
                        octx.fillStyle = material.outlineColor ?? '#ffffff'
                        octx.fillRect(0, 0, off.width, off.height)
                        octx.globalCompositeOperation = 'source-over'

                        // シーンへ描画（dpr 変換が効いているので論理サイズへ換算して戻す）
                        rawCtx.drawImage(off, -pad / dpr, -pad / dpr, off.width / dpr, off.height / dpr)
                    }}
                />
            )}
            <Image
                ref={imageRef}
                image={image}
                width={material.width}
                height={material.height}
                opacity={material.opacity ?? 1}
                listening={renderPass === 'interaction'}
                filters={
                    material.isGrayscale ? [Konva.Filters.Grayscale, Konva.Filters.Brighten] : []
                }
                brightness={material.isGrayscale ? (material.grayscaleBrightness ?? 0) : 0}
            />
        </Group>
    )
}
