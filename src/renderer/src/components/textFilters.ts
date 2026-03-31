import Konva from 'konva'

function hash2(x: number, y: number, seed: number): number {
    // 0..1 の簡易ハッシュ（色は変えずに alpha だけに使う）
    const v = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453
    return v - Math.floor(v)
}

function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0 || 1)))
    return t * t * (3 - 2 * t)
}

/**
 * 印刷物が経年で欠けたように「alpha を削る」フィルタ。
 * RGB は触らないので、砂嵐っぽい色ノイズにはならない。
 */
export function ensureDistressFilterRegistered(): void {
    const Filters: any = (Konva as any).Filters
    if (Filters.DistressAlpha) return

    Filters.DistressAlpha = function DistressAlphaFilter(imageData: ImageData) {
        const data = imageData.data
        const src = new Uint8ClampedArray(data)
        const w = imageData.width
        const h = imageData.height
        const node = this as any
        const rawS = node.getAttr?.('distressStrength') ?? node.attrs?.distressStrength
        const rawSc = node.getAttr?.('distressScale') ?? node.attrs?.distressScale
        const strength = Math.max(0, Math.min(1, Number(rawS) || 0))
        const scale = Math.max(0.25, Math.min(6, Number(rawSc) || 1))

        if (strength <= 0) return

        // 中間値でも効くように強める
        const s = Math.pow(strength, 0.7)
        const grainScale = Math.max(0.35, scale)
        const seed = 1337

        const alphaAt = (x: number, y: number) => {
            if (x < 0 || y < 0 || x >= w || y >= h) return 0
            return src[(y * w + x) * 4 + 3]
        }

        for (let i = 0; i < data.length; i += 4) {
            const a = src[i + 3]
            if (a === 0) continue

            const p = i / 4
            const px = p % w
            const py = Math.floor(p / w)
            const x = px / grainScale
            const y = py / grainScale
            // 丸穴感を避けるため、方向性のある線状ノイズを混ぜる
            const nA = hash2(x * 1.9 + y * 0.18, y * 0.25, seed)
            const nB = hash2(x * 0.22, y * 1.7 + x * 0.31, seed + 17)
            const nC = hash2(x * 0.8 + y * 0.8, y * 0.8 - x * 0.8, seed + 101)
            const r = (nA * 0.5) + (nB * 0.35) + (nC * 0.15)

            // 文字の輪郭付近を優先して削る（経年劣化っぽく）
            const edge =
                alphaAt(px - 1, py) === 0 ||
                alphaAt(px + 1, py) === 0 ||
                alphaAt(px, py - 1) === 0 ||
                alphaAt(px, py + 1) === 0

            // 輪郭ほど強く、内部は控えめに
            const edgeBoost = edge ? (0.18 + 0.5 * s) : 0
            const chipThreshold = 0.1 + 0.55 * s + edgeBoost
            const fadeThreshold = 0.2 + 0.62 * s + edgeBoost * 0.7

            // 完全欠け
            if (r < chipThreshold * 0.55) {
                data[i + 3] = 0
                continue
            }

            // 部分的に薄くする（経年劣化感）
            if (r < fadeThreshold) {
                const k = 1 - smoothstep(chipThreshold * 0.45, fadeThreshold, r)
                const fade = 1 - (0.18 + 0.72 * s) * k
                data[i + 3] = Math.max(0, Math.round(a * fade))
            }
        }
    }
}

// モジュール読込時に登録して、初回描画から確実に使えるようにする
ensureDistressFilterRegistered()
export const DISTRESS_FILTER = (Konva as any).Filters.DistressAlpha

