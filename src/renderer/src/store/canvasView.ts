import { create } from 'zustand'

/**
 * キャンバスの表示倍率（ビューの状態）。
 * 漫画データではないので MangaStore とは分け、保存・Undo 履歴の対象にしない。
 */

export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 4

/** ボタン・キー操作で順に切り替える倍率 */
export const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4] as const

export const clampZoom = (z: number): number => {
    if (!Number.isFinite(z)) return 1
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(z * 1000) / 1000))
}

/** 現在の倍率から、次（dir=1）／前（dir=-1）の段階の倍率を返す。段階の間にいる場合は隣の段階へ */
export const stepZoom = (zoom: number, dir: 1 | -1): number => {
    const eps = 1e-3
    if (dir > 0) return ZOOM_STEPS.find((s) => s > zoom + eps) ?? MAX_ZOOM
    for (let i = ZOOM_STEPS.length - 1; i >= 0; i--) {
        if (ZOOM_STEPS[i] < zoom - eps) return ZOOM_STEPS[i]
    }
    return MIN_ZOOM
}

/** ホイール／ピンチ 1 イベント分の倍率変化（大きなホイール量は抑える） */
export const wheelZoomFactor = (deltaY: number): number => {
    const d = Math.max(-30, Math.min(30, deltaY))
    return Math.exp(-d * 0.01)
}

/** 表示領域にページ全体が収まる倍率 */
export const fitZoom = (viewW: number, viewH: number, pageW: number, pageH: number, margin = 48): number => {
    if (pageW <= 0 || pageH <= 0) return 1
    return clampZoom(Math.min((viewW - margin * 2) / pageW, (viewH - margin * 2) / pageH))
}

const ZOOM_STORAGE_KEY = 'manga-yarou-canvas-zoom'

const loadZoom = (): number => {
    try {
        const v = Number(localStorage.getItem(ZOOM_STORAGE_KEY))
        return v ? clampZoom(v) : 1
    } catch {
        return 1
    }
}

interface CanvasViewState {
    zoom: number
    setZoom: (zoom: number) => void
}

export const useCanvasView = create<CanvasViewState>((set) => ({
    zoom: loadZoom(),
    setZoom: (zoom) => {
        const z = clampZoom(zoom)
        set({ zoom: z })
        try {
            localStorage.setItem(ZOOM_STORAGE_KEY, String(z))
        } catch {
            /* 端末ローカルの利便機能なので失敗は無視 */
        }
    }
}))
