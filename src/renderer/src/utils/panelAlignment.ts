import type { Panel } from '../store/types'

export interface AlignmentRect {
    x: number
    y: number
    width: number
    height: number
}

export interface AlignmentGuide {
    orientation: 'vertical' | 'horizontal'
    /** vertical なら x 座標、horizontal なら y 座標 */
    position: number
    /** ガイド線の描画範囲（vertical なら y、horizontal なら x の範囲） */
    rangeStart: number
    rangeEnd: number
    /** ピッタリ重なっているかどうか（色の出し分けに使う） */
    matched: boolean
}

export interface AlignmentResult {
    /** スナップ後の左上 x（変更なしなら undefined） */
    snappedX?: number
    /** スナップ後の左上 y */
    snappedY?: number
    /** スナップ後にスナップが効いた幅・高さ（リサイズ用、移動時は undefined） */
    snappedWidth?: number
    snappedHeight?: number
    guides: AlignmentGuide[]
}

/** 自動スナップが効く距離（px） */
export const PANEL_SNAP_THRESHOLD = 10
/** ピッタリ重なっていると判定する許容誤差（px） */
const MATCH_EPSILON = 0.5

interface CandidateLine {
    pos: number
    /** 候補線を生成した元パネルの直交軸方向のレンジ（描画範囲計算用） */
    perpStart: number
    perpEnd: number
}

function collectCandidateLines(panels: Panel[]): { xLines: CandidateLine[]; yLines: CandidateLine[] } {
    const xLines: CandidateLine[] = []
    const yLines: CandidateLine[] = []
    for (const p of panels) {
        const left = p.x
        const right = p.x + p.width
        const top = p.y
        const bottom = p.y + p.height
        // X 候補（左・中央・右）。レンジは Y 方向。
        xLines.push({ pos: left, perpStart: top, perpEnd: bottom })
        xLines.push({ pos: left + p.width / 2, perpStart: top, perpEnd: bottom })
        xLines.push({ pos: right, perpStart: top, perpEnd: bottom })
        // Y 候補（上・中央・下）。レンジは X 方向。
        yLines.push({ pos: top, perpStart: left, perpEnd: right })
        yLines.push({ pos: top + p.height / 2, perpStart: left, perpEnd: right })
        yLines.push({ pos: bottom, perpStart: left, perpEnd: right })
    }
    return { xLines, yLines }
}

function pickBestSnap(
    myEdges: number[],
    candidates: CandidateLine[]
): { delta: number; pos: number } | null {
    let best: { delta: number; pos: number } | null = null
    for (const e of myEdges) {
        for (const c of candidates) {
            const d = c.pos - e
            const ad = Math.abs(d)
            if (ad <= PANEL_SNAP_THRESHOLD && (!best || ad < Math.abs(best.delta))) {
                best = { delta: d, pos: c.pos }
            }
        }
    }
    return best
}

/**
 * 移動・リサイズ中のパネルの矩形 `activeRect` を、`others` の辺・中央線に整列させ、
 * SNAP 閾値内なら自動スナップさせた delta と描画用ガイド線を返す。
 *
 * - 軸ごとに独立にスナップ判定（X と Y は別々に最適候補を選ぶ）
 * - 同じ位置に複数の候補線が重なる場合はレンジをマージ
 */
export function computePanelAlignment(
    activeRect: AlignmentRect,
    others: Panel[]
): AlignmentResult {
    if (others.length === 0) return { guides: [] }

    const { xLines, yLines } = collectCandidateLines(others)

    const myLeft = activeRect.x
    const myRight = activeRect.x + activeRect.width
    const myCenterX = activeRect.x + activeRect.width / 2
    const myTop = activeRect.y
    const myBottom = activeRect.y + activeRect.height
    const myCenterY = activeRect.y + activeRect.height / 2

    const bestX = pickBestSnap([myLeft, myCenterX, myRight], xLines)
    const bestY = pickBestSnap([myTop, myCenterY, myBottom], yLines)

    const dx = bestX?.delta ?? 0
    const dy = bestY?.delta ?? 0

    const finalLeft = myLeft + dx
    const finalRight = myRight + dx
    const finalCenterX = myCenterX + dx
    const finalTop = myTop + dy
    const finalBottom = myBottom + dy
    const finalCenterY = myCenterY + dy

    type GuideAccum = {
        rangeStart: number
        rangeEnd: number
        bestDistance: number
    }
    const xGuides = new Map<string, GuideAccum>()
    const yGuides = new Map<string, GuideAccum>()

    const consider = (
        map: Map<string, GuideAccum>,
        cand: CandidateLine,
        myEdges: number[],
        movingPerpStart: number,
        movingPerpEnd: number
    ): void => {
        let best = Infinity
        for (const e of myEdges) {
            const d = Math.abs(cand.pos - e)
            if (d < best) best = d
        }
        if (best > PANEL_SNAP_THRESHOLD) return
        const key = cand.pos.toFixed(2)
        const existing = map.get(key)
        const rangeStart = Math.min(cand.perpStart, movingPerpStart)
        const rangeEnd = Math.max(cand.perpEnd, movingPerpEnd)
        if (existing) {
            existing.rangeStart = Math.min(existing.rangeStart, rangeStart)
            existing.rangeEnd = Math.max(existing.rangeEnd, rangeEnd)
            existing.bestDistance = Math.min(existing.bestDistance, best)
        } else {
            map.set(key, { rangeStart, rangeEnd, bestDistance: best })
        }
    }

    for (const c of xLines) {
        consider(xGuides, c, [finalLeft, finalCenterX, finalRight], finalTop, finalBottom)
    }
    for (const c of yLines) {
        consider(yGuides, c, [finalTop, finalCenterY, finalBottom], finalLeft, finalRight)
    }

    const guides: AlignmentGuide[] = []
    for (const [key, g] of xGuides) {
        guides.push({
            orientation: 'vertical',
            position: parseFloat(key),
            rangeStart: g.rangeStart,
            rangeEnd: g.rangeEnd,
            matched: g.bestDistance <= MATCH_EPSILON
        })
    }
    for (const [key, g] of yGuides) {
        guides.push({
            orientation: 'horizontal',
            position: parseFloat(key),
            rangeStart: g.rangeStart,
            rangeEnd: g.rangeEnd,
            matched: g.bestDistance <= MATCH_EPSILON
        })
    }

    return {
        snappedX: dx !== 0 ? activeRect.x + dx : undefined,
        snappedY: dy !== 0 ? activeRect.y + dy : undefined,
        guides
    }
}

/**
 * Transformer のリサイズ用：左上 x/y と width/height を独立に整列させる。
 * リサイズ時は「掴んでいる辺」がどれか分からないため、4辺すべてをチェックして最も近いものに合わせる。
 * x/y を動かして寸法を変える場合と、寸法だけを変える場合の両方が起こりうるため、
 * snappedX/Y/Width/Height をすべて返し、呼び出し側で boundBox を再構築する。
 */
export function computePanelAlignmentForResize(
    box: AlignmentRect,
    others: Panel[],
    /** 旧 box（差分判定でどの辺が動いたかを推定するために使う） */
    prev: AlignmentRect
): AlignmentResult {
    if (others.length === 0) return { guides: [] }

    const { xLines, yLines } = collectCandidateLines(others)

    // 旧矩形と新矩形を比較し、左/右/上/下のどれが動いたかを判定する。
    // 左右両方動く場合（中央ハンドルなど）は両方を別々にスナップ候補にする。
    const movedLeft = Math.abs(box.x - prev.x) > 0.01
    const movedRight = Math.abs((box.x + box.width) - (prev.x + prev.width)) > 0.01
    const movedTop = Math.abs(box.y - prev.y) > 0.01
    const movedBottom = Math.abs((box.y + box.height) - (prev.y + prev.height)) > 0.01

    const myLeft = box.x
    const myRight = box.x + box.width
    const myCenterX = box.x + box.width / 2
    const myTop = box.y
    const myBottom = box.y + box.height
    const myCenterY = box.y + box.height / 2

    let snappedLeft = myLeft
    let snappedRight = myRight
    let snappedTop = myTop
    let snappedBottom = myBottom

    // 動いた辺を、最も近い候補線に吸着させる
    const snapEdge = (val: number, cands: CandidateLine[]): number => {
        let bestDelta = 0
        let bestAbs = Infinity
        for (const c of cands) {
            const d = c.pos - val
            const ad = Math.abs(d)
            if (ad <= PANEL_SNAP_THRESHOLD && ad < bestAbs) {
                bestAbs = ad
                bestDelta = d
            }
        }
        return val + bestDelta
    }

    if (movedLeft) snappedLeft = snapEdge(myLeft, xLines)
    if (movedRight) snappedRight = snapEdge(myRight, xLines)
    if (movedTop) snappedTop = snapEdge(myTop, yLines)
    if (movedBottom) snappedBottom = snapEdge(myBottom, yLines)

    // 中央ハンドル（左右両方動く＝平行移動）の場合は、中央線も候補にする
    if (movedLeft && movedRight && Math.abs((box.x + box.width) - (prev.x + prev.width) - (box.x - prev.x)) < 0.01) {
        // 平行移動っぽい挙動：中央でスナップを試す
        const cSnap = snapEdge(myCenterX, xLines)
        if (cSnap !== myCenterX) {
            const d = cSnap - myCenterX
            snappedLeft = myLeft + d
            snappedRight = myRight + d
        }
    }
    if (movedTop && movedBottom && Math.abs((box.y + box.height) - (prev.y + prev.height) - (box.y - prev.y)) < 0.01) {
        const cSnap = snapEdge(myCenterY, yLines)
        if (cSnap !== myCenterY) {
            const d = cSnap - myCenterY
            snappedTop = myTop + d
            snappedBottom = myBottom + d
        }
    }

    const finalX = snappedLeft
    const finalY = snappedTop
    const finalW = snappedRight - snappedLeft
    const finalH = snappedBottom - snappedTop

    const finalLeft = finalX
    const finalRight = finalX + finalW
    const finalCenterX = finalX + finalW / 2
    const finalTop = finalY
    const finalBottom = finalY + finalH
    const finalCenterY = finalY + finalH / 2

    type GuideAccum = { rangeStart: number; rangeEnd: number; bestDistance: number }
    const xGuides = new Map<string, GuideAccum>()
    const yGuides = new Map<string, GuideAccum>()

    const consider = (
        map: Map<string, GuideAccum>,
        cand: CandidateLine,
        myEdges: number[],
        movingPerpStart: number,
        movingPerpEnd: number
    ): void => {
        let best = Infinity
        for (const e of myEdges) {
            const d = Math.abs(cand.pos - e)
            if (d < best) best = d
        }
        if (best > PANEL_SNAP_THRESHOLD) return
        const key = cand.pos.toFixed(2)
        const existing = map.get(key)
        const rangeStart = Math.min(cand.perpStart, movingPerpStart)
        const rangeEnd = Math.max(cand.perpEnd, movingPerpEnd)
        if (existing) {
            existing.rangeStart = Math.min(existing.rangeStart, rangeStart)
            existing.rangeEnd = Math.max(existing.rangeEnd, rangeEnd)
            existing.bestDistance = Math.min(existing.bestDistance, best)
        } else {
            map.set(key, { rangeStart, rangeEnd, bestDistance: best })
        }
    }

    for (const c of xLines) {
        consider(xGuides, c, [finalLeft, finalCenterX, finalRight], finalTop, finalBottom)
    }
    for (const c of yLines) {
        consider(yGuides, c, [finalTop, finalCenterY, finalBottom], finalLeft, finalRight)
    }

    const guides: AlignmentGuide[] = []
    for (const [key, g] of xGuides) {
        guides.push({
            orientation: 'vertical',
            position: parseFloat(key),
            rangeStart: g.rangeStart,
            rangeEnd: g.rangeEnd,
            matched: g.bestDistance <= MATCH_EPSILON
        })
    }
    for (const [key, g] of yGuides) {
        guides.push({
            orientation: 'horizontal',
            position: parseFloat(key),
            rangeStart: g.rangeStart,
            rangeEnd: g.rangeEnd,
            matched: g.bestDistance <= MATCH_EPSILON
        })
    }

    return {
        snappedX: finalX !== box.x ? finalX : undefined,
        snappedY: finalY !== box.y ? finalY : undefined,
        snappedWidth: finalW !== box.width ? finalW : undefined,
        snappedHeight: finalH !== box.height ? finalH : undefined,
        guides
    }
}
