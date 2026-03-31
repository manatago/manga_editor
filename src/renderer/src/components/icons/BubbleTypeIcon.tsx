import React from 'react'
import type { BubbleType } from '../../store/useMangaStore'

type Props = {
    type: BubbleType
    size?: number
    className?: string
    strokeWidth?: number
}

/** サイドバー用。drawPaths のシルエットを 24×24 に簡略化したアイコン */
export const BubbleTypeIcon: React.FC<Props> = ({ type, size = 14, className, strokeWidth = 1.5 }) => {
    const common = {
        fill: 'none' as const,
        stroke: 'currentColor',
        strokeWidth,
        strokeLinejoin: 'round' as const,
        strokeLinecap: 'round' as const
    }

    const flashLines = Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2 - Math.PI / 2
        const x1 = 12 + Math.cos(a) * 5.5
        const y1 = 12 + Math.sin(a) * 5.5
        const x2 = 12 + Math.cos(a) * 10.5
        const y2 = 12 + Math.sin(a) * 10.5
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} {...common} />
    })

    return (
        <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
            {type === 'rounded' && (
                <ellipse cx="12" cy="12" rx="9" ry="8.5" {...common} />
            )}
            {type === 'jagged' && (
                <path
                    d="M12 1l2.22 4.15 4.25-2.05-.65 4.67 4.64.83-3.26 3.4 3.26 3.4-4.64.83.65 4.67-4.25-2.05L12 23l-2.22-4.15-4.25 2.05.65-4.67-4.64-.83 3.26-3.4-3.26-3.4 4.64-.83-.65-4.67 4.25 2.05L12 1z"
                    {...common}
                />
            )}
            {type === 'rect' && <rect x="4" y="5" width="16" height="14" rx="2" ry="2" {...common} />}
            {type === 'rect-double' && (
                <>
                    <rect x="3" y="4" width="18" height="16" rx="2.5" ry="2.5" {...common} />
                    <rect x="6.5" y="7.5" width="11" height="9" rx="1.5" ry="1.5" {...common} />
                </>
            )}
            {type === 'flash' && (
                <>
                    <circle cx="12" cy="12" r="4.5" {...common} />
                    {flashLines}
                </>
            )}
            {type === 'shout' && (
                <path d="M5 5L12 2 19 5 22 12 19 19 12 22 5 19 2 12Z" {...common} />
            )}
            {type === 'square-jagged' && (
                <path
                    d="M4 5l4-2 4 2 4-2 4 2v3.5l2 3.5-2 3.5V19l-4 2-4-2-4 2-4-2v-3.5l-2-3.5 2-3.5V5z"
                    {...common}
                />
            )}
            {type === 'megaphone' && <path d="M0 2h24l-8.4 20H8.4Z" {...common} />}
        </svg>
    )
}
