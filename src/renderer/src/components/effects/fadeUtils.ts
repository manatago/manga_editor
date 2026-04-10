import type { FadeDirection } from '../../store/types'

/**
 * フェード方向と強さから Konva リニアグラジェントの start/end 点を返す。
 * FadeOverlay / ToneFadeOverlay で共用。
 */
export function getGradientPoints(dir: FadeDirection, w: number, h: number, s: number) {
    switch (dir) {
        case 'top':          return { start: { x: w / 2, y: 0 },     end: { x: w / 2, y: h * s } }
        case 'bottom':       return { start: { x: w / 2, y: h },     end: { x: w / 2, y: h * (1 - s) } }
        case 'left':         return { start: { x: 0, y: h / 2 },     end: { x: w * s, y: h / 2 } }
        case 'right':        return { start: { x: w, y: h / 2 },     end: { x: w * (1 - s), y: h / 2 } }
        case 'top-left':     return { start: { x: 0, y: 0 },         end: { x: w * s, y: h * s } }
        case 'top-right':    return { start: { x: w, y: 0 },         end: { x: w * (1 - s), y: h * s } }
        case 'bottom-left':  return { start: { x: 0, y: h },         end: { x: w * s, y: h * (1 - s) } }
        case 'bottom-right': return { start: { x: w, y: h },         end: { x: w * (1 - s), y: h * (1 - s) } }
        default: return null
    }
}

/**
 * #rrggbb / #rgb → rgba(r,g,b,0)。
 * グラジェント補間時に黒ずみが出ないよう、終端色を同色アルファ 0 にするために使う。
 */
export function toTransparent(color: string): string {
    const hex = color.trim()
    if (hex.startsWith('#')) {
        const full = hex.length === 4
            ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
            : hex
        const r = parseInt(full.slice(1, 3), 16)
        const g = parseInt(full.slice(3, 5), 16)
        const b = parseInt(full.slice(5, 7), 16)
        if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return `rgba(${r},${g},${b},0)`
    }
    return 'rgba(255,255,255,0)'
}
