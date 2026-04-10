/**
 * 内蔵スクリーントーン（SVG を data URL 化）。ページ背景は `builtin://${id}` で参照。
 */
export interface ScreenToneEntry {
    id: string
    name: string
    dataUrl: string
}

function toDataUrl(svg: string): string {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const P = 48

function dotsGrid(step: number, r: number, color = '#202020'): string {
    const parts: string[] = []
    for (let y = step / 2; y < P; y += step) {
        for (let x = step / 2; x < P; x += step) {
            parts.push(`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${r}" fill="${color}"/>`)
        }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${P}" height="${P}" viewBox="0 0 ${P} ${P}">${parts.join('')}</svg>`
}

function lineH(spacing: number, w: number, color = '#202020'): string {
    const lines: string[] = []
    for (let y = 0; y <= P; y += spacing) {
        lines.push(`<line x1="0" y1="${y}" x2="${P}" y2="${y}" stroke="${color}" stroke-width="${w}"/>`)
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${P}" height="${P}" viewBox="0 0 ${P} ${P}">${lines.join('')}</svg>`
}

function lineV(spacing: number, w: number, color = '#202020'): string {
    const lines: string[] = []
    for (let x = 0; x <= P; x += spacing) {
        lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${P}" stroke="${color}" stroke-width="${w}"/>`)
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${P}" height="${P}" viewBox="0 0 ${P} ${P}">${lines.join('')}</svg>`
}

function crossGrid(step: number, w: number, color = '#202020'): string {
    const h: string[] = []
    const v: string[] = []
    for (let y = 0; y <= P; y += step) {
        h.push(`<line x1="0" y1="${y}" x2="${P}" y2="${y}" stroke="${color}" stroke-width="${w}"/>`)
    }
    for (let x = 0; x <= P; x += step) {
        v.push(`<line x1="${x}" y1="0" x2="${x}" y2="${P}" stroke="${color}" stroke-width="${w}"/>`)
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${P}" height="${P}" viewBox="0 0 ${P} ${P}">${h.join('')}${v.join('')}</svg>`
}

function diagonalLines(angleDeg: number, spacing: number, w: number, color = '#202020'): string {
    const rad = (angleDeg * Math.PI) / 180
    const len = P * 2
    const cx = P / 2
    const cy = P / 2
    const lines: string[] = []
    for (let i = -6; i <= 6; i++) {
        const off = i * spacing
        const x1 = cx + Math.cos(rad) * -len + Math.sin(rad) * off
        const y1 = cy + Math.sin(rad) * -len - Math.cos(rad) * off
        const x2 = cx + Math.cos(rad) * len + Math.sin(rad) * off
        const y2 = cy + Math.sin(rad) * len - Math.cos(rad) * off
        lines.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${w}"/>`)
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${P}" height="${P}" viewBox="0 0 ${P} ${P}">${lines.join('')}</svg>`
}

function noiseDots(count: number, seed: number, color = '#1a1a1a'): string {
    let s = seed % 2147483647
    const rnd = () => {
        s = (s * 16807) % 2147483647
        return (s - 1) / 2147483646
    }
    const parts: string[] = []
    for (let i = 0; i < count; i++) {
        const x = rnd() * P
        const y = rnd() * P
        const r = 0.4 + rnd() * 1.2
        parts.push(`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${r.toFixed(2)}" fill="${color}"/>`)
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${P}" height="${P}" viewBox="0 0 ${P} ${P}">${parts.join('')}</svg>`
}

/** タイル境界で途切れないよう、近い辺にラップした円も描く（少女漫画系ランダム点描用） */
function pushSeamlessDot(parts: string[], x: number, y: number, r: number, fill: string) {
    const xs: number[] = [x]
    const ys: number[] = [y]
    if (x - r < 0) xs.push(x + P)
    if (x + r > P) xs.push(x - P)
    if (y - r < 0) ys.push(y + P)
    if (y + r > P) ys.push(y - P)
    for (const px of xs) {
        for (const py of ys) {
            if (px + r < 0 || px - r > P || py + r < 0 || py - r > P) continue
            parts.push(`<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="${r.toFixed(2)}" fill="${fill}"/>`)
        }
    }
}

/**
 * 少女漫画向け：パステル〜モーヴのランダム点描（サイズばらつき・シームレスタイル）
 */
function shoujoStipple(
    seed: number,
    opts: {
        count: number
        /** 0=ピンク寄り, 1=ラベンダー寄り, 2=ミックス */
        palette: 0 | 1 | 2
        rMin: number
        rMax: number
        /** true なら一部を半透明でふんわり */
        softLayer: boolean
    }
): string {
    let s = seed % 2147483647
    const rnd = () => {
        s = (s * 16807) % 2147483647
        return (s - 1) / 2147483646
    }
    const pinkish = ['#d9a8b8', '#c9a7c4', '#e8b4bc', '#b893a8', '#ddb4c3']
    const lavenderish = ['#b4a7d6', '#a898c8', '#c4b5e0', '#9b86bd', '#b8a5d4']
    const mix = [...pinkish, ...lavenderish, '#c8b8c0', '#d4c4d0']
    const pickColor = () => {
        if (opts.palette === 0) return pinkish[Math.floor(rnd() * pinkish.length)]
        if (opts.palette === 1) return lavenderish[Math.floor(rnd() * lavenderish.length)]
        return mix[Math.floor(rnd() * mix.length)]
    }
    const parts: string[] = []
    const { count, rMin, rMax, softLayer } = opts
    for (let i = 0; i < count; i++) {
        const x = rnd() * P
        const y = rnd() * P
        const t = rnd()
        const r = rMin + t * t * (rMax - rMin)
        const useSoft = softLayer && rnd() > 0.62
        const fill = useSoft ? 'rgba(160,130,168,0.35)' : pickColor()
        pushSeamlessDot(parts, x, y, r, fill)
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${P}" height="${P}" viewBox="0 0 ${P} ${P}">${parts.join('')}</svg>`
}

/** きらめき寄り：細かい粒＋たまに大きめのドット */
function shoujoSparkleField(seed: number): string {
    let s = seed % 2147483647
    const rnd = () => {
        s = (s * 16807) % 2147483647
        return (s - 1) / 2147483646
    }
    const parts: string[] = []
    const nFine = 95
    for (let i = 0; i < nFine; i++) {
        const x = rnd() * P
        const y = rnd() * P
        const r = 0.22 + rnd() * 0.55
        const fills = ['#c4b0c8', '#d8c0d0', '#b8a0b8', '#a898b0']
        pushSeamlessDot(parts, x, y, r, fills[Math.floor(rnd() * fills.length)])
    }
    const nBold = 14
    for (let i = 0; i < nBold; i++) {
        const x = rnd() * P
        const y = rnd() * P
        const r = 0.9 + rnd() * 1.15
        pushSeamlessDot(parts, x, y, r, 'rgba(200,160,188,0.55)')
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${P}" height="${P}" viewBox="0 0 ${P} ${P}">${parts.join('')}</svg>`
}

/** 粒状が少し塊になったような有機的ランダム（クラスタ中心＋オフセット） */
function shoujoOrganicClusters(seed: number): string {
    let s = seed % 2147483647
    const rnd = () => {
        s = (s * 16807) % 2147483647
        return (s - 1) / 2147483646
    }
    const parts: string[] = []
    const nClusters = 11
    for (let c = 0; c < nClusters; c++) {
        const cx = rnd() * P
        const cy = rnd() * P
        const nDots = 5 + Math.floor(rnd() * 8)
        for (let i = 0; i < nDots; i++) {
            const ox = (rnd() - 0.5) * 5.5
            const oy = (rnd() - 0.5) * 5.5
            let x = cx + ox
            let y = cy + oy
            while (x < 0) x += P
            while (x >= P) x -= P
            while (y < 0) y += P
            while (y >= P) y -= P
            const r = 0.28 + rnd() * 0.95
            const fill = rnd() > 0.5 ? '#c9a8b8' : '#ada0c8'
            pushSeamlessDot(parts, x, y, r, fill)
        }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${P}" height="${P}" viewBox="0 0 ${P} ${P}">${parts.join('')}</svg>`
}

function waveH(amplitude: number, wavelength: number, w: number, color = '#202020'): string {
    const paths: string[] = []
    const steps = 32
    for (let row = 0; row < 7; row++) {
        const yBase = (row * P) / 5.5
        let d = ''
        for (let i = 0; i <= steps; i++) {
            const t = (i / steps) * P
            const y = yBase + amplitude * Math.sin((t / wavelength) * Math.PI * 2 + row * 0.4)
            d += `${i === 0 ? 'M' : 'L'} ${t.toFixed(1)} ${y.toFixed(1)} `
        }
        paths.push(`<path d="${d.trim()}" fill="none" stroke="${color}" stroke-width="${w}"/>`)
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${P}" height="${P}" viewBox="0 0 ${P} ${P}">${paths.join('')}</svg>`
}

function brick(stepX: number, stepY: number, w: number, color = '#202020'): string {
    const rects: string[] = []
    for (let row = 0; row < 4; row++) {
        const oy = row * stepY
        const shift = row % 2 ? stepX / 2 : 0
        for (let col = -1; col < 4; col++) {
            const ox = col * stepX + shift
            rects.push(
                `<rect x="${ox}" y="${oy}" width="${stepX - w * 2}" height="${stepY - w * 2}" fill="none" stroke="${color}" stroke-width="${w}"/>`
            )
        }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${P}" height="${P}" viewBox="0 0 ${P} ${P}">${rects.join('')}</svg>`
}

function concentricRings(step: number, color = '#202020'): string {
    const parts: string[] = []
    let r = step / 2
    while (r < P * 0.9) {
        parts.push(
            `<circle cx="${P / 2}" cy="${P / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="0.8"/>`
        )
        r += step
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${P}" height="${P}" viewBox="0 0 ${P} ${P}">${parts.join('')}</svg>`
}

function zigzag(spacing: number, w: number, color = '#202020'): string {
    const h = spacing * 0.4
    const parts: string[] = []
    for (let y = 0; y < P + spacing; y += spacing) {
        let d = `M 0 ${y}`
        for (let i = 0; i <= 24; i++) {
            const x = (i / 24) * P
            const dy = i % 2 === 0 ? 0 : h
            d += ` L ${x.toFixed(1)} ${(y + dy).toFixed(1)}`
        }
        parts.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}"/>`)
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${P}" height="${P}" viewBox="0 0 ${P} ${P}">${parts.join('')}</svg>`
}

/** 全内蔵トーン（40種超） */
export const SCREEN_TONE_CATALOG: ScreenToneEntry[] = []

function add(id: string, name: string, svg: string) {
    SCREEN_TONE_CATALOG.push({ id, name, dataUrl: toDataUrl(svg) })
}

// 少女漫画向け・ランダム点描（一覧の先頭に並べる）
add('st-shoujo-sprinkle-pink', '♡ ランダム点描（ピンク）', shoujoStipple(90210, { count: 72, palette: 0, rMin: 0.2, rMax: 1.65, softLayer: true }))
add('st-shoujo-sprinkle-lav', '♡ ランダム点描（ラベンダー）', shoujoStipple(48116, { count: 70, palette: 1, rMin: 0.22, rMax: 1.55, softLayer: true }))
add('st-shoujo-sprinkle-mix', '♡ ランダム点描（ミックス）', shoujoStipple(7734, { count: 88, palette: 2, rMin: 0.18, rMax: 1.75, softLayer: true }))
add('st-shoujo-sprinkle-light', '♡ ランダム点描（淡い）', shoujoStipple(22001, { count: 48, palette: 2, rMin: 0.25, rMax: 1.2, softLayer: true }))
add('st-shoujo-sparkle', '♡ きらめき粒', shoujoSparkleField(55621))
add('st-shoujo-organic', '♡ ふわ塊点描', shoujoOrganicClusters(33445))
add('st-shoujo-dense', '♡ しっとり密点描', shoujoStipple(66102, { count: 118, palette: 2, rMin: 0.15, rMax: 1.05, softLayer: true }))

// ドット系（整列グリッド）
;[3, 4, 5, 6, 7, 8, 9, 10, 12, 14].forEach((step, i) => {
    const r = Math.min(1.4, step * 0.11)
    add(`st-dot-${i + 1}`, `ドット（密〜粗 ${i + 1}）`, dotsGrid(step, r))
})
add('st-dot-light', 'ドット（薄）', dotsGrid(8, 0.55, '#9ca3af'))
add('st-dot-heavy', 'ドット（濃）', dotsGrid(5, 1.35, '#0a0a0a'))

// 平行線
;[2, 3, 4, 5, 6, 8].forEach((sp, i) => {
    add(`st-line-h-${i + 1}`, `横線 ${i + 1}`, lineH(sp, 0.7))
})
;[2, 3, 4, 5, 6, 8].forEach((sp, i) => {
    add(`st-line-v-${i + 1}`, `縦線 ${i + 1}`, lineV(sp, 0.7))
})

// 格子
;[4, 6, 8, 10, 12].forEach((sp, i) => {
    add(`st-grid-${i + 1}`, `方眼 ${i + 1}`, crossGrid(sp, 0.65))
})

// 斜線
add('st-diag-45', '斜線 45°', diagonalLines(45, 4, 0.65))
add('st-diag-45-wide', '斜線 45°（広）', diagonalLines(45, 7, 0.8))
add('st-diag-135', '斜線 135°', diagonalLines(-45, 4, 0.65))
add('st-grid-fine', '細方眼', crossGrid(6, 0.5))

// ノイズ・砂目
;[1, 2, 3].forEach((n) => {
    add(`st-noise-${n}`, `砂目ノイズ ${n}`, noiseDots(55 + n * 25, 1000 + n * 333))
})

// 波・装飾
add('st-wave-1', '波線 1', waveH(2.2, 7, 0.55))
add('st-wave-2', '波線 2', waveH(3.5, 10, 0.7))
add('st-brick', 'レンガ枠', brick(12, 8, 0.55))
add('st-zigzag', 'ジグザグ', zigzag(5, 0.55))
add('st-rings', '同心円', concentricRings(4))

// 追加バリエーション（濃淡）
add('st-dot-gray', 'ドット灰', dotsGrid(6, 1, '#6b7280'))
add('st-line-h-soft', '横線（淡）', lineH(4, 0.45, '#9ca3af'))
add('st-screentone-50', '50% 網点風', dotsGrid(3.2, 0.85, '#404040'))

const catalogById = new Map(SCREEN_TONE_CATALOG.map((e) => [e.id, e]))

export function getScreenToneDataUrl(id: string): string | undefined {
    return catalogById.get(id)?.dataUrl
}

export function isBuiltinBackgroundPath(path: string | undefined): boolean {
    return !!path && path.startsWith('builtin://')
}

export function isCustomTonePath(path: string | undefined): boolean {
    return !!path && path.startsWith('custom-tone://')
}

export function getCustomToneId(path: string): string {
    return path.slice('custom-tone://'.length)
}

export function parseBuiltinToneId(path: string): string | null {
    if (!path.startsWith('builtin://')) return null
    return path.slice('builtin://'.length) || null
}
