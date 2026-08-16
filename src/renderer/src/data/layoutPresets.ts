/**
 * 定型コマ割りレイアウトのプリセット集。
 *
 * 各プリセットは「使用可能領域（ページからマージンを除いた矩形）」を 0..1 で表した
 * 正規化矩形（NormRect）の配列で定義する。配列の順序が日本漫画の読み順
 * （右→左・上→下）になるように並べてある（台本の1コマ目＝配列先頭）。
 */

import type { PanelType } from '../store/types'

export interface NormRect {
    /** 使用可能領域内の左上 X（0..1） */
    x: number
    /** 使用可能領域内の左上 Y（0..1） */
    y: number
    /** 幅（0..1） */
    w: number
    /** 高さ（0..1） */
    h: number
    /** コマの形（省略時 rect）。slanted=平行四辺形, trapezoid-h/v=台形 */
    type?: PanelType
    /**
     * 傾き・台形のオフセット。いずれもコマ自身の幅（slanted/trapezoid-h）または
     * 高さ（trapezoid-v）に対する割合。instantiate でピクセルへ換算する。
     */
    slant?: number
    offsetB?: number
    offsetC?: number
    offsetD?: number
}

export interface LayoutPreset {
    id: string
    /** 台本の [レイアウト名] で指定するときの表示名 */
    name: string
    category: string
    rects: NormRect[]
}

/** ページ外周のマージン（px） */
export const LAYOUT_OUTER_MARGIN = 24
/** コマ同士の間隔（px） */
export const LAYOUT_GUTTER = 16

const r = (x: number, y: number, w: number, h: number): NormRect => ({ x, y, w, h })

/** バンドルする定型レイアウト（コマ数の少ない順） */
export const LAYOUT_PRESETS: LayoutPreset[] = [
    { id: 'full-1', name: '1コマ・全面', category: '1コマ', rects: [r(0, 0, 1, 1)] },

    { id: 'v2', name: '2コマ・上下', category: '2コマ', rects: [r(0, 0, 1, 0.5), r(0, 0.5, 1, 0.5)] },
    { id: 'h2', name: '2コマ・左右', category: '2コマ', rects: [r(0.5, 0, 0.5, 1), r(0, 0, 0.5, 1)] },

    { id: 'rows3', name: '3コマ・3段', category: '3コマ', rects: [r(0, 0, 1, 1 / 3), r(0, 1 / 3, 1, 1 / 3), r(0, 2 / 3, 1, 1 / 3)] },
    { id: 'cols3', name: '3コマ・左右3列', category: '3コマ', rects: [r(2 / 3, 0, 1 / 3, 1), r(1 / 3, 0, 1 / 3, 1), r(0, 0, 1 / 3, 1)] },
    { id: 'big-top-2', name: '3コマ・大ゴマ＋下2', category: '3コマ', rects: [r(0, 0, 1, 0.5), r(0.5, 0.5, 0.5, 0.5), r(0, 0.5, 0.5, 0.5)] },
    { id: 'big-bottom-2', name: '3コマ・上2＋大ゴマ', category: '3コマ', rects: [r(0.5, 0, 0.5, 0.5), r(0, 0, 0.5, 0.5), r(0, 0.5, 1, 0.5)] },
    { id: 'center-big-3', name: '3コマ・中央大', category: '3コマ', rects: [r(0, 0, 1, 0.2), r(0, 0.2, 1, 0.6), r(0, 0.8, 1, 0.2)] },

    { id: 'grid4', name: '4コマ・格子', category: '4コマ', rects: [r(0.5, 0, 0.5, 0.5), r(0, 0, 0.5, 0.5), r(0.5, 0.5, 0.5, 0.5), r(0, 0.5, 0.5, 0.5)] },
    { id: 'cols4', name: '4コマ・左右4列', category: '4コマ', rects: [r(0.75, 0, 0.25, 1), r(0.5, 0, 0.25, 1), r(0.25, 0, 0.25, 1), r(0, 0, 0.25, 1)] },
    { id: 'yonkoma', name: '4コマ・起承転結(縦4段)', category: '4コマ', rects: [r(0, 0, 1, 0.25), r(0, 0.25, 1, 0.25), r(0, 0.5, 1, 0.25), r(0, 0.75, 1, 0.25)] },
    { id: 'big-top-3', name: '4コマ・大ゴマ＋下3', category: '4コマ', rects: [r(0, 0, 1, 0.55), r(2 / 3, 0.55, 1 / 3, 0.45), r(1 / 3, 0.55, 1 / 3, 0.45), r(0, 0.55, 1 / 3, 0.45)] },

    { id: 'var5a', name: '5コマ・上2下3', category: '5コマ', rects: [r(0.5, 0, 0.5, 0.45), r(0, 0, 0.5, 0.45), r(2 / 3, 0.45, 1 / 3, 0.55), r(1 / 3, 0.45, 1 / 3, 0.55), r(0, 0.45, 1 / 3, 0.55)] },
    { id: 'var5b', name: '5コマ・上3下2', category: '5コマ', rects: [r(2 / 3, 0, 1 / 3, 0.5), r(1 / 3, 0, 1 / 3, 0.5), r(0, 0, 1 / 3, 0.5), r(0.5, 0.5, 0.5, 0.5), r(0, 0.5, 0.5, 0.5)] },

    { id: 'grid6', name: '6コマ・格子', category: '6コマ', rects: [r(0.5, 0, 0.5, 1 / 3), r(0, 0, 0.5, 1 / 3), r(0.5, 1 / 3, 0.5, 1 / 3), r(0, 1 / 3, 0.5, 1 / 3), r(0.5, 2 / 3, 0.5, 1 / 3), r(0, 2 / 3, 0.5, 1 / 3)] },
    { id: 'var6', name: '6コマ・変則(1-2-3)', category: '6コマ', rects: [r(0, 0, 1, 0.34), r(0.5, 0.34, 0.5, 0.33), r(0, 0.34, 0.5, 0.33), r(2 / 3, 0.67, 1 / 3, 0.33), r(1 / 3, 0.67, 1 / 3, 0.33), r(0, 0.67, 1 / 3, 0.33)] }
]

/** コマ数 → 既定プリセット（台本でレイアウト名を省略したとき使う） */
const DEFAULT_BY_COUNT: Record<number, string> = {
    1: 'full-1',
    2: 'v2',
    3: 'rows3',
    4: 'grid4',
    5: 'var5a',
    6: 'grid6'
}

export function findPresetByName(name: string): LayoutPreset | undefined {
    const key = name.trim()
    return LAYOUT_PRESETS.find((p) => p.name === key || p.id === key)
}

/** コマ数から近似のグリッドレイアウトを生成（プリセットに無いコマ数の保険） */
export function autoGrid(panelCount: number): LayoutPreset {
    const n = Math.max(1, Math.floor(panelCount))
    const cols = Math.ceil(Math.sqrt(n))
    const rows = Math.ceil(n / cols)
    const rects: NormRect[] = []
    let remaining = n
    for (let row = 0; row < rows; row++) {
        const colsThisRow = Math.min(cols, remaining)
        const w = 1 / colsThisRow
        const h = 1 / rows
        // 各行は右→左の読み順で並べる
        for (let c = 0; c < colsThisRow; c++) {
            const x = 1 - w * (c + 1)
            rects.push(r(x, row * h, w, h))
        }
        remaining -= colsThisRow
    }
    return { id: 'auto', name: `自動(${n}コマ)`, category: '自動', rects }
}

/**
 * レイアウト名（省略可）とコマ数から、実際に使うプリセットを決める。
 * - 名前があり既知プリセット → それを返す（コマ数不一致でも返す。呼び出し側で警告する）
 * - 名前が無い/「自動」→ コマ数から既定プリセット、無ければ autoGrid
 */
export function resolveLayout(name: string | undefined, panelCount: number): LayoutPreset {
    if (name && name.trim() && name.trim() !== '自動') {
        const found = findPresetByName(name)
        if (found) return found
    }
    const id = DEFAULT_BY_COUNT[panelCount]
    if (id) {
        const preset = LAYOUT_PRESETS.find((p) => p.id === id)
        if (preset) return preset
    }
    return autoGrid(panelCount)
}

export interface PixelRect {
    x: number
    y: number
    width: number
    height: number
    /** コマの形（省略時 rect） */
    type?: PanelType
    /** 以下はピクセル換算済みの傾き・台形オフセット */
    slant?: number
    offsetB?: number
    offsetC?: number
    offsetD?: number
}

/**
 * プリセットの正規化矩形を、実ページのピクセル座標へ展開する。
 * 外周マージンとガター（コマ間隔）を差し引く。
 * type が斜め・台形のときは slant/offset をコマの幅（または高さ）基準でピクセル換算する。
 */
export function instantiate(preset: LayoutPreset, pageWidth: number, pageHeight: number): PixelRect[] {
    const margin = LAYOUT_OUTER_MARGIN
    const gutter = LAYOUT_GUTTER
    const usableW = Math.max(1, pageWidth - margin * 2)
    const usableH = Math.max(1, pageHeight - margin * 2)
    return preset.rects.map((nr) => {
        const x = margin + nr.x * usableW + gutter / 2
        const y = margin + nr.y * usableH + gutter / 2
        const width = Math.max(20, nr.w * usableW - gutter)
        const height = Math.max(20, nr.h * usableH - gutter)
        const base = nr.type === 'trapezoid-v' ? height : width
        const out: PixelRect = {
            x: Math.round(x),
            y: Math.round(y),
            width: Math.round(width),
            height: Math.round(height)
        }
        if (nr.type && nr.type !== 'rect') {
            out.type = nr.type
            if (nr.slant) out.slant = Math.round(nr.slant * base)
            if (nr.offsetB) out.offsetB = Math.round(nr.offsetB * base)
            if (nr.offsetC) out.offsetC = Math.round(nr.offsetC * base)
            if (nr.offsetD) out.offsetD = Math.round(nr.offsetD * base)
        }
        return out
    })
}
