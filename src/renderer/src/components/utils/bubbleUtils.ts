import { Bubble } from '../../store/useMangaStore'

/**
 * Deterministic pseudo-random number from a seed
 */
export const getPRand = (seed: number) => {
    const s = Math.sin(seed * 1234.56 + 789.1) * 10000
    return s - Math.floor(s)
}

/**
 * Converts perimeter distance 'd' to {x, y} coordinates on a rectangle of width 'w' and height 'h'
 */
export const getRectPosByD = (d: number, w: number, h: number) => {
    const P = 2 * (w + h)
    d = ((d % P) + P) % P
    if (d < w) return { x: d, y: 0 }
    if (d < w + h) return { x: w, y: d - w }
    if (d < 2 * w + h) return { x: w - (d - (w + h)), y: h }
    return { x: 0, y: h - (d - (2 * w + h)) }
}

/**
 * Finds the perimeter distance 'd' for a point on a rectangle boundary
 * intersected by a ray starting from the center (w/2, h/2) at angle 'ang'
 */
export const getRectDByAngle = (ang: number, w: number, h: number) => {
    const cx = w / 2
    const cy = h / 2
    const dx = Math.cos(ang)
    const dy = Math.sin(ang)
    const scaleX = (w / 2) / (Math.abs(dx) || 0.0001)
    const scaleY = (h / 2) / (Math.abs(dy) || 0.0001)
    const scale = Math.min(scaleX, scaleY)
    const ix = cx + dx * scale
    const iy = cy + dy * scale
    
    if (Math.abs(iy - 0) < 1) return ix
    if (Math.abs(ix - w) < 1) return w + iy
    if (Math.abs(iy - h) < 1) return w + h + (w - ix)
    return w + h + w + (h - iy)
}

/**
 * Converts hex color to rgba string
 */
export const hexToRGBA = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
