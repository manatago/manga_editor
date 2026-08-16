/**
 * 構造化エディタ用の座標計算。
 * - レイアウト名 → コマ矩形（プリセット／自作テンプレート）
 * - パネル矩形内での吹き出しの自動配置（1個ずつ）
 */
import type { PageTemplate } from '../../store/types'
import { autoGrid, findPresetByName, instantiate, resolveLayout, type PixelRect } from '../../data/layoutPresets'

/** テンプレートを作成したときの基準ページサイズ */
const TEMPLATE_BASE_W = 840
const TEMPLATE_BASE_H = 1188

export const PANEL_PADDING = 14
export const BUBBLE_GAP = 10

export interface Box {
    x: number
    y: number
    width: number
    height: number
}

/**
 * レイアウト名（プリセット or 自作テンプレート）とコマ数から、実ページのコマ矩形を返す。
 * - テンプレート一致: そのコマをページサイズへ拡縮
 * - 組み込みプリセット/自動: instantiate
 * panelCount はレイアウト未指定/自動時の既定選択に使う。
 */
export function resolvePanelRects(
    layoutName: string | undefined,
    panelCount: number,
    pageWidth: number,
    pageHeight: number,
    templates: PageTemplate[]
): PixelRect[] {
    const name = layoutName && layoutName !== '自動' ? layoutName : undefined
    const template = name ? templates.find((t) => t.name === name) : undefined
    if (template) {
        const sx = pageWidth / TEMPLATE_BASE_W
        const sy = pageHeight / TEMPLATE_BASE_H
        return template.panels.map((p) => ({
            x: Math.round(p.x * sx),
            y: Math.round(p.y * sy),
            width: Math.round(p.width * sx),
            height: Math.round(p.height * sy),
            type: p.type,
            slant: p.slant ? Math.round(p.slant * sx) : undefined,
            offsetB: p.offsetB ? Math.round(p.offsetB * sx) : undefined,
            offsetC: p.offsetC ? Math.round(p.offsetC * sx) : undefined,
            offsetD: p.offsetD ? Math.round(p.offsetD * sx) : undefined
        }))
    }
    const named = name ? findPresetByName(name) : undefined
    let preset = named ?? resolveLayout(layoutName, Math.max(1, panelCount))
    if (!named && preset.rects.length !== Math.max(1, panelCount)) {
        preset = autoGrid(Math.max(1, panelCount))
    }
    return instantiate(preset, pageWidth, pageHeight)
}

/**
 * パネル矩形内に、index 番目の吹き出しを読み順（上→下）で置く座標・サイズを返す。
 * ナレーションは左寄せ、通常は右寄せ（縦書き想定）。
 */
export function placeNewBubbleInPanel(
    rect: Box,
    index: number,
    isNarration: boolean
): { x: number; y: number; width: number; height: number } {
    const bw = Math.min(160, Math.max(70, rect.width * 0.42))
    const bh = 120
    const x = isNarration ? rect.x + PANEL_PADDING : rect.x + rect.width - bw - PANEL_PADDING
    const y = rect.y + PANEL_PADDING + index * (bh + BUBBLE_GAP)
    return {
        x: Math.round(Math.max(rect.x, x)),
        y: Math.round(y),
        width: Math.round(bw),
        height: Math.round(bh)
    }
}
