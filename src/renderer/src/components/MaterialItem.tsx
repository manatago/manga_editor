import React, { useRef, useEffect } from 'react'
import Konva from 'konva'
import { Group, Image } from 'react-konva'
import useImage from 'use-image'
import { Material } from '../store/useMangaStore'

interface MaterialItemProps {
    material: Material;
    isSelected: boolean;
    onSelect: (id: string | null) => void;
    onUpdate: (id: string, updates: any, undoable?: boolean) => void;
    id?: string;
    renderPass?: 'content' | 'interaction';
    clipPoints?: number[];
}

export const MaterialItem: React.FC<MaterialItemProps> = ({
    material,
    isSelected,
    onSelect,
    onUpdate,
    id,
    renderPass,
    clipPoints
}) => {
    const [image] = useImage(material.imagePath.startsWith('local-file://') ? material.imagePath : `local-file://${material.imagePath}`)
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
        onUpdate(material.id, {
            x: e.target.x(),
            y: e.target.y()
        })
    }

    const handleTransformEnd = () => {
        const node = shapeRef.current
        if (!node) return
        const scaleX = node.scaleX()
        const scaleY = node.scaleY()
        const rotation = node.rotation()
        
        node.scaleX(1)
        node.scaleY(1)

        onUpdate(material.id, {
            x: node.x(),
            y: node.y(),
            width: Math.max(5, node.width() * scaleX),
            height: Math.max(5, node.height() * scaleY),
            rotation: rotation
        })
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
