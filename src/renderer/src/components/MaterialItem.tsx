import React, { useRef, useEffect, useMemo } from 'react'
import Konva from 'konva'
import { Group, Image } from 'react-konva'
import useImage from 'use-image'
import { Material, Panel, useMangaStore } from '../store/useMangaStore'
import { findTargetPanel } from './utils/geometry'

interface MaterialItemProps {
    material: Material;
    isSelected: boolean;
    onSelect: (id: string | null) => void;
    onUpdate: (id: string, updates: any, undoable?: boolean) => void;
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
    const snapToGrid = (value: number) => {
        if (!currentPage?.gridEnabled) return value
        const g = Math.max(8, Number(currentPage.gridSize ?? 24))
        return Math.round(value / g) * g
    }
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
                imageRef.current.cache()
            } else {
                imageRef.current.clearCache()
            }
        }
    }, [material.isGrayscale, image])

    const handleDragEnd = (e: any) => {
        if (e.target !== e.currentTarget) return
        const updates: any = {
            x: snapToGrid(e.target.x()),
            y: snapToGrid(e.target.y())
        }

        if (material.isClipped && panels) {
            const centerX = updates.x + (material.width || 200) / 2
            const centerY = updates.y + (material.height || 200) / 2
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

        const updates: any = {
            x: snapToGrid(node.x()),
            y: snapToGrid(node.y()),
            width: Math.max(5, snapToGrid(node.width() * scaleX)),
            height: Math.max(5, snapToGrid(node.height() * scaleY)),
            rotation: rotation
        }

        if (material.isClipped && panels) {
            const centerX = updates.x + updates.width / 2
            const centerY = updates.y + updates.height / 2
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
                    x: snapToGrid(pos.x),
                    y: snapToGrid(pos.y)
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
            <Image
                ref={imageRef}
                image={image}
                width={material.width}
                height={material.height}
                opacity={material.opacity ?? 1}
                listening={renderPass === 'interaction'}
                filters={material.isGrayscale ? [Konva.Filters.Grayscale] : []}
            />
        </Group>
    )
}
