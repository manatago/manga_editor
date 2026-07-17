/**
 * マジックワンド（背景除去）用のピクセルマスク処理。
 * MagicWandEditorModal から抽出した純粋関数群（DOM 非依存・テスト可能）。
 */

/**
 * スキャンライン flood-fill（4連結）。クリック色と距離 <= tolerance の連続領域のマスク（0/1）を返す。
 * アルファ 0 の画素は跨がない（既に抜けた部分で止まる）。
 */
export function contiguousMask(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    startX: number,
    startY: number,
    tolerance: number
): Uint8Array {
    const mask = new Uint8Array(width * height)
    const i0 = (startY * width + startX) * 4
    if (data[i0 + 3] === 0) return mask
    const tr = data[i0], tg = data[i0 + 1], tb = data[i0 + 2]
    const tol2 = tolerance * tolerance
    const within = (p: number): boolean => {
        const i = p * 4
        if (data[i + 3] === 0) return false
        const dr = data[i] - tr, dg = data[i + 1] - tg, db = data[i + 2] - tb
        return dr * dr + dg * dg + db * db <= tol2
    }
    const stack: number[] = [startY * width + startX]
    while (stack.length > 0) {
        const seed = stack.pop()!
        const py = (seed / width) | 0
        const sx = seed - py * width
        let x = sx
        while (x >= 0 && !mask[py * width + x] && within(py * width + x)) x--
        x++
        let spanAbove = false
        let spanBelow = false
        while (x < width && !mask[py * width + x] && within(py * width + x)) {
            mask[py * width + x] = 1
            if (py > 0) {
                const above = !mask[(py - 1) * width + x] && within((py - 1) * width + x)
                if (!spanAbove && above) { stack.push((py - 1) * width + x); spanAbove = true }
                else if (spanAbove && !above) spanAbove = false
            }
            if (py < height - 1) {
                const below = !mask[(py + 1) * width + x] && within((py + 1) * width + x)
                if (!spanBelow && below) { stack.push((py + 1) * width + x); spanBelow = true }
                else if (spanBelow && !below) spanBelow = false
            }
            x++
        }
    }
    return mask
}

/**
 * 色域選択（連結性を無視）。画像全体で、クリック色と距離 <= tolerance の画素すべてのマスク（0/1）を返す。
 */
export function globalMask(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    startX: number,
    startY: number,
    tolerance: number
): Uint8Array {
    const mask = new Uint8Array(width * height)
    const i0 = (startY * width + startX) * 4
    if (data[i0 + 3] === 0) return mask
    const tr = data[i0], tg = data[i0 + 1], tb = data[i0 + 2]
    const tol2 = tolerance * tolerance
    const total = width * height
    for (let p = 0; p < total; p++) {
        const i = p * 4
        if (data[i + 3] === 0) continue
        const dr = data[i] - tr, dg = data[i + 1] - tg, db = data[i + 2] - tb
        if (dr * dr + dg * dg + db * db <= tol2) mask[p] = 1
    }
    return mask
}

/** 分離ボックスブラー（1ch, Float32, 端はクランプ）。境界フェザー用。 */
export function boxBlur1ch(src: Float32Array, width: number, height: number, radius: number): Float32Array {
    if (radius < 1) return src
    const win = radius * 2 + 1
    const tmp = new Float32Array(src.length)
    for (let y = 0; y < height; y++) {
        let sum = 0
        for (let k = -radius; k <= radius; k++) sum += src[y * width + Math.min(width - 1, Math.max(0, k))]
        for (let x = 0; x < width; x++) {
            tmp[y * width + x] = sum / win
            const xo = Math.min(width - 1, Math.max(0, x - radius))
            const xi = Math.min(width - 1, Math.max(0, x + radius + 1))
            sum += src[y * width + xi] - src[y * width + xo]
        }
    }
    const out = new Float32Array(src.length)
    for (let x = 0; x < width; x++) {
        let sum = 0
        for (let k = -radius; k <= radius; k++) sum += tmp[Math.min(height - 1, Math.max(0, k)) * width + x]
        for (let y = 0; y < height; y++) {
            out[y * width + x] = sum / win
            const yo = Math.min(height - 1, Math.max(0, y - radius))
            const yi = Math.min(height - 1, Math.max(0, y + radius + 1))
            sum += tmp[yi * width + x] - tmp[yo * width + x]
        }
    }
    return out
}

/**
 * マスクをアルファに適用。feather 0 なら二値で透明化。feather>0 はマスクをぼかした被覆率で
 * アルファを段階的に下げ、切り抜きの縁を柔らかくする。
 */
export function applyMask(
    data: Uint8ClampedArray,
    mask: Uint8Array,
    width: number,
    height: number,
    feather: number
): void {
    if (feather <= 0) {
        for (let p = 0; p < mask.length; p++) if (mask[p]) data[p * 4 + 3] = 0
        return
    }
    const cov = new Float32Array(mask.length)
    for (let p = 0; p < mask.length; p++) cov[p] = mask[p]
    const blurred = boxBlur1ch(cov, width, height, Math.round(feather))
    for (let p = 0; p < mask.length; p++) {
        const c = blurred[p]
        if (c <= 0) continue
        const a = data[p * 4 + 3]
        data[p * 4 + 3] = Math.round(a * (1 - Math.min(1, c)))
    }
}
