import type { Bubble, BubbleType } from '../../store/useMangaStore'

/** 吹き出しタイプごとの内側余白比率（上下左右） */
export function getBubbleInnerPaddingRatio(type: BubbleType): number {
    const isRectType = type === 'rect' || type === 'rect-double' || type === 'megaphone'
    return isRectType ? 0.05 : 0.1
}

export function getBubbleInnerSizeRatio(type: BubbleType): number {
    const p = getBubbleInnerPaddingRatio(type)
    return 1 - p * 2
}

/**
 * 自動フィット計算用の「安全領域比率」。形状の曲面・スパイクで内側の有効スペースが
 * 描画用の inner padding 矩形よりさらに狭くなるため、形状ごとに実測ベースの係数を返す。
 *
 * 例: rounded は drawRoundedPath が半径 0.42 程度の楕円なので、外接矩形の 84% に楕円が
 * 入る → その楕円の内接矩形は 0.84 × 1/√2 ≈ 0.594 の領域に収まる。
 *
 * deformation を渡すと rounded/jagged 系は半径揺らぎの最悪値で再計算する。
 */
export function getBubbleAutoFitSafeRatio(type: BubbleType, deformation?: number): number {
    const def = Math.max(0, deformation ?? 1)
    switch (type) {
        case 'rect':
        case 'rect-double':
            return getBubbleInnerSizeRatio(type) // ≈ 0.9
        case 'rounded': {
            // drawRoundedPath: r = 0.5 - 0.08*max(1, def) + jitter, jitter ∈ ±0.045*def
            // 内接矩形の半幅 = r_min * √2 / 2 → 矩形辺 / バブル外形 = r_min * √2
            const rMin = 0.5 - 0.08 * Math.max(1, def) - 0.045 * def
            // 描画揺らぎ・テキスト計測誤差ぶんの 5% マージン、最低 0.2 を保証
            return Math.max(0.2, rMin * Math.SQRT2 * 0.95)
        }
        case 'jagged':
        case 'square-jagged':
            // ギザの内側が 0.5 - 0.05 程度まで食い込む。さらに楕円的に絞られる
            return 0.6
        case 'shout':
            // 鋭いスパイク状なので中央しか使えない
            return 0.5
        case 'flash':
            // 稲妻状で内側が大きく削れる
            return 0.55
        case 'megaphone':
        default:
            return getBubbleInnerSizeRatio(type)
    }
}

export type TextWeightLevel = 0 | 1 | 2

export function resolveTextWeightLevel(bubble: Pick<Bubble, 'textWeightLevel' | 'fontWeight'>): TextWeightLevel {
    if (bubble.textWeightLevel !== undefined && bubble.textWeightLevel !== null) {
        const v = Number(bubble.textWeightLevel)
        if (v === 0 || v === 1 || v === 2) return v
    }
    return bubble.fontWeight === 'bold' ? 1 : 0
}

export function resolveBaseFontStyle(weightLevel: TextWeightLevel): 'normal' | 'bold' {
    return weightLevel === 0 ? 'normal' : 'bold'
}

/** 極太：同系色の太い stroke で擬似的に太らせる */
export function heavyStrokeWidthFor(weightLevel: TextWeightLevel, fontSize: number): number {
    if (weightLevel !== 2) return 0
    return Math.max(0.8, fontSize * 0.06)
}

export function clampRoughness(bubble: Pick<Bubble, 'textRoughness'>): number {
    return Math.max(0, Math.min(1, bubble.textRoughness ?? 0))
}

/** 掠れフィルタの粒サイズ（DistressAlpha に渡す） */
export const BUBBLE_TEXT_DISTRESS_SCALE = 1.2

// --- 自動フィット用の計測ユーティリティ ---

let measureCanvas: HTMLCanvasElement | null = null
let measureCtx: CanvasRenderingContext2D | null = null

function getMeasureContext(): CanvasRenderingContext2D | null {
    if (typeof document === 'undefined') return null
    if (measureCtx) return measureCtx
    measureCanvas = document.createElement('canvas')
    measureCtx = measureCanvas.getContext('2d')
    return measureCtx
}

function buildFontShorthand(fontSize: number, fontFamily: string, fontWeight: string): string {
    return `${fontWeight || 'normal'} ${fontSize}px ${fontFamily}`
}

/** 1 行の幅（letterSpacing も加味）。Canvas 2D measureText を使う */
export function measureLineWidth(line: string, font: string, letterSpacing: number): number {
    const ctx = getMeasureContext()
    if (!ctx) {
        // SSR / テスト環境向けの近似フォールバック
        return line.length * 12 + Math.max(0, line.length - 1) * letterSpacing
    }
    ctx.font = font
    const baseW = ctx.measureText(line).width
    const spacing = Math.max(0, line.length - 1) * letterSpacing
    return baseW + spacing
}

const NO_BREAK_BEFORE = new Set(['、', '。', '」', '』', '）', '）', ')', ']', '】', '〉', '》', '！', '？', '!', '?', '：', '；', '・'])

interface LayoutHorizontalTextOpts {
    text: string
    innerW: number
    fontSize: number
    fontFamily: string
    fontWeight: string
    letterSpacing: number
    lineHeight: number
}

interface HorizontalTextLayout {
    lines: string[]
    totalHeight: number
    widestLine: number
}

/**
 * text を (innerW) 内で横書き折り返しした結果を返す。
 * - 明示 `\n` は最優先で尊重
 * - 行頭に来てはいけない約物は前の行へ送り直す（最低限の禁則）
 * - innerW が 0 以下のときは空配列を返す
 */
export function layoutHorizontalText(opts: LayoutHorizontalTextOpts): HorizontalTextLayout {
    const { text, innerW, fontSize, fontFamily, fontWeight, letterSpacing, lineHeight } = opts
    if (!text || innerW <= 0) {
        return { lines: text ? [text] : [], totalHeight: 0, widestLine: 0 }
    }

    const font = buildFontShorthand(fontSize, fontFamily, fontWeight)
    const explicitLines = text.split('\n')
    const out: string[] = []
    let widestLine = 0

    for (const logical of explicitLines) {
        if (logical.length === 0) {
            out.push('')
            continue
        }
        let cur = ''
        let curW = 0
        const chars = Array.from(logical)
        for (let i = 0; i < chars.length; i++) {
            const ch = chars[i]
            const candidate = cur + ch
            const candidateW = measureLineWidth(candidate, font, letterSpacing)
            if (candidateW > innerW && cur.length > 0) {
                // 改行点を確定。次の行頭に約物が来るならもう 1 文字戻す
                let breakIdx = i
                if (NO_BREAK_BEFORE.has(ch) && cur.length > 1) {
                    // 行頭が約物にならないようにこの ch を現行に押し込む
                    cur = candidate
                    curW = candidateW
                    continue
                }
                out.push(cur)
                if (curW > widestLine) widestLine = curW
                cur = ch
                curW = measureLineWidth(cur, font, letterSpacing)
                void breakIdx
            } else {
                cur = candidate
                curW = candidateW
            }
        }
        if (cur.length > 0 || logical.length === 0) {
            out.push(cur)
            if (curW > widestLine) widestLine = curW
        }
    }

    const lineH = fontSize * (lineHeight || 1.0)
    const totalHeight = out.length * lineH
    return { lines: out, totalHeight, widestLine }
}

interface LayoutVerticalTextOpts {
    text: string
    fontSize: number
    lineHeight: number
    letterSpacing: number
}

interface VerticalTextLayout {
    columns: number
    /** 一番長い列の高さ */
    tallestColumnHeight: number
    /** 全列の合計幅（列幅 fontSize + 列間 lineHeight*fontSize*0.6） */
    totalColumnsWidth: number
}

/**
 * 縦書きテキストのレイアウト見積。VerticalText の描画式と一致させてある。
 * 列の自動折り返しはせず、`\n` 区切りの列構造を尊重する（MVP）。
 */
export function layoutVerticalText(opts: LayoutVerticalTextOpts): VerticalTextLayout {
    const { text, fontSize, lineHeight, letterSpacing } = opts
    if (!text) return { columns: 0, tallestColumnHeight: 0, totalColumnsWidth: 0 }
    const lines = text.split('\n')
    const columns = lines.length
    const charSpacing = letterSpacing
    const columnSpacing = fontSize * (lineHeight || 1.0) * 0.6
    let tallest = 0
    for (const line of lines) {
        const n = Array.from(line).length
        const h = n * fontSize + Math.max(0, n - 1) * charSpacing
        if (h > tallest) tallest = h
    }
    const totalColumnsWidth = columns * fontSize + Math.max(0, columns - 1) * columnSpacing
    return { columns, tallestColumnHeight: tallest, totalColumnsWidth }
}

