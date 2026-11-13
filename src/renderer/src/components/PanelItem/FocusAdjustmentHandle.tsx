import React from 'react'
import { Group, Line, Circle } from 'react-konva'
import type { Panel } from '../../store/types'

/** 集中線などの中心位置をドラッグで調整するハンドル */
export const FocusAdjustmentHandle: React.FC<{
    panel: Panel;
    onUpdate: (id: string, updates: Partial<Panel>, undoable?: boolean) => void;
}> = ({ panel, onUpdate }) => {
    const cx = (panel.width || 0) * (panel.focusCenterX ?? 0.5)
    const cy = (panel.height || 0) * (panel.focusCenterY ?? 0.5)
    if (isNaN(cx) || isNaN(cy)) return null

    return (
        <Group
            x={cx}
            y={cy}
            draggable
            onDragStart={(e) => { e.cancelBubble = true }}
            onDragMove={(e) => {
                e.cancelBubble = true
                const newX = e.target.x() / (panel.width || 1)
                const newY = e.target.y() / (panel.height || 1)
                if (isNaN(newX) || isNaN(newY)) return
                onUpdate(panel.id, {
                    focusCenterX: Math.max(0, Math.min(1, newX)),
                    focusCenterY: Math.max(0, Math.min(1, newY))
                })
            }}
            onDragEnd={(e) => {
                e.cancelBubble = true
                const newX = e.target.x() / (panel.width || 1)
                const newY = e.target.y() / (panel.height || 1)
                if (isNaN(newX) || isNaN(newY)) return
                onUpdate(panel.id, {
                    focusCenterX: Math.max(0, Math.min(1, newX)),
                    focusCenterY: Math.max(0, Math.min(1, newY))
                })
            }}
        >
            <Line points={[-15, 0, 15, 0]} stroke="#3b82f6" strokeWidth={2} />
            <Line points={[0, -15, 0, 15]} stroke="#3b82f6" strokeWidth={2} />
            <Circle radius={10} fill="transparent" />
            <Circle radius={4} fill="#3b82f6" stroke="white" strokeWidth={1} />
        </Group>
    )
}
