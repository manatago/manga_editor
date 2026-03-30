import React from 'react'
import type { PanelType } from '../../store/useMangaStore'

type Props = {
    type: PanelType
    size?: number
    className?: string
    strokeWidth?: number
}

export const PanelTypeIcon: React.FC<Props> = ({ type, size = 16, className, strokeWidth = 2 }) => {
    const common = {
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth,
        strokeLinejoin: 'round' as const,
        strokeLinecap: 'round' as const
    }

    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            className={className}
            aria-hidden="true"
            focusable="false"
        >
            {type === 'rect' && <rect x="5" y="6" width="14" height="12" rx="1.5" {...common} />}
            {type === 'slanted' && <polygon points="7,6 20,6 17,18 4,18" {...common} />}
            {type === 'trapezoid-h' && <polygon points="8,6 16,6 20,18 4,18" {...common} />}
            {type === 'trapezoid-v' && <polygon points="5,7 19,4 19,20 5,17" {...common} />}
            {type === 'pentagon' && <polygon points="12,4 20,10 17,20 7,20 4,10" {...common} />}
            {type === 'hexagon' && <polygon points="8,4 16,4 21,12 16,20 8,20 3,12" {...common} />}
            {type === 'circle' && <circle cx="12" cy="12" r="8" {...common} />}
        </svg>
    )
}

