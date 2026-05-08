import type { Panel } from '../store/types'
import { getPanelPoints } from '../components/utils/drawPaths'

export interface EdgePoint {
    x: number
    y: number
}

export interface DiagonalEdge {
    panelId: string
    /** 同一パネル内の辺インデックス（0..n-1） */
    edgeIndex: number
    start: EdgePoint
    end: EdgePoint
    /** [0, π) に正規化した角度（向きを問わない） */
    angle: number
}

export interface ParallelGuide {
    /** ガイドとして描く線分（絶対座標） */
    x1: number
    y1: number
    x2: number
    y2: number
    matched: boolean
}

export interface ParallelAlignmentResult {
    /** 適用すべき角度補正（rad）。スナップ不要なら undefined */
    snapDelta?: number
    /** マッチした他辺の参照 */
    matchedEdge?: DiagonalEdge
    /** 描画用ガイド線（マッチした他辺をハイライトする線分） */
    guides: ParallelGuide[]
}

/** スナップが効く角度しきい値（°）。これ以内なら自動で平行に揃える。 */
export const PARALLEL_SNAP_DEG = 1.5
/** ピッタリ平行と判定する角度しきい値（°） */
const PARALLEL_MATCH_DEG = 0.1

/**
 * パネルから「斜め辺」を絶対座標で取り出す。水平・垂直に近い辺は除外。
 */
export function getDiagonalEdges(panel: Panel): DiagonalEdge[] {
    const points = getPanelPoints(panel)
    const n = points.length / 2
    const edges: DiagonalEdge[] = []
    for (let i = 0; i < n; i++) {
        const lx1 = points[i * 2]
        const ly1 = points[i * 2 + 1]
        const lx2 = points[((i + 1) % n) * 2]
        const ly2 = points[((i + 1) % n) * 2 + 1]
        const ax1 = panel.x + lx1
        const ay1 = panel.y + ly1
        const ax2 = panel.x + lx2
        const ay2 = panel.y + ly2
        const dx = ax2 - ax1
        const dy = ay2 - ay1
        // 水平・垂直は除外（コマ整列ガイド側でカバーされるため）
        if (Math.abs(dx) < 0.5 || Math.abs(dy) < 0.5) continue
        let angle = Math.atan2(dy, dx)
        // [0, π) に正規化（線の向きは問わない）
        if (angle < 0) angle += Math.PI
        if (angle >= Math.PI) angle -= Math.PI
        edges.push({
            panelId: panel.id,
            edgeIndex: i,
            start: { x: ax1, y: ay1 },
            end: { x: ax2, y: ay2 },
            angle
        })
    }
    return edges
}

/** [0, π) 範囲の2つの角度の最小差分。回り込み考慮。 */
function angleDiff(a: number, b: number): number {
    let d = a - b
    while (d > Math.PI / 2) d -= Math.PI
    while (d < -Math.PI / 2) d += Math.PI
    return d
}

/**
 * 動かしている辺 movingEdge と他辺 others との平行整列を計算する。
 * SNAP しきい値内に最も近い他辺を見つけ、その方向に揃える delta を返す。
 * 同 SNAP 範囲内の他辺はガイド表示対象として返す（matched フラグで色分け）。
 */
export function computeParallelAlignment(
    movingEdge: { start: EdgePoint; end: EdgePoint },
    others: DiagonalEdge[]
): ParallelAlignmentResult {
    if (others.length === 0) return { guides: [] }

    const dx = movingEdge.end.x - movingEdge.start.x
    const dy = movingEdge.end.y - movingEdge.start.y
    if (Math.abs(dx) < 0.5 || Math.abs(dy) < 0.5) {
        // 水平/垂直化した瞬間は平行スナップ対象外（直交ガイド側に任せる）
        return { guides: [] }
    }
    let myAngle = Math.atan2(dy, dx)
    if (myAngle < 0) myAngle += Math.PI
    if (myAngle >= Math.PI) myAngle -= Math.PI

    const SNAP_RAD = (PARALLEL_SNAP_DEG * Math.PI) / 180
    const MATCH_RAD = (PARALLEL_MATCH_DEG * Math.PI) / 180

    let bestSnap: { delta: number; edge: DiagonalEdge; absDiff: number } | null = null
    for (const e of others) {
        const diff = angleDiff(e.angle, myAngle)
        const absDiff = Math.abs(diff)
        if (absDiff <= SNAP_RAD) {
            if (!bestSnap || absDiff < bestSnap.absDiff) {
                bestSnap = { delta: diff, edge: e, absDiff }
            }
        }
    }

    if (!bestSnap) return { guides: [] }

    // スナップ後の角度に対して、ガイドとして表示する候補をすべて拾う
    const snappedAngle = myAngle + bestSnap.delta
    const guides: ParallelGuide[] = []
    for (const e of others) {
        const diff = angleDiff(e.angle, snappedAngle)
        if (Math.abs(diff) <= SNAP_RAD) {
            guides.push({
                x1: e.start.x,
                y1: e.start.y,
                x2: e.end.x,
                y2: e.end.y,
                matched: Math.abs(diff) <= MATCH_RAD
            })
        }
    }

    return {
        snapDelta: bestSnap.delta,
        matchedEdge: bestSnap.edge,
        guides
    }
}

/**
 * X 自由度しか持たない頂点（trapezoid-h の各角）を、相手側固定点に対して
 * 目標角度 targetAngle で結ぶように移動させたときの新しい X 座標を返す。
 *
 * counter は固定点（絶対座標）。corner も絶対座標で渡す。
 */
export function snapCornerXForAngle(
    cornerY: number,
    counter: EdgePoint,
    targetAngle: number
): number | null {
    const dy = cornerY - counter.y
    if (Math.abs(dy) < 0.5) return null
    // 角度が水平に近すぎる場合は無限大に飛ぶので諦める
    const t = Math.tan(targetAngle)
    if (Math.abs(t) < 0.05) return null
    const dx = dy / t
    return counter.x + dx
}

/**
 * Y 自由度しか持たない頂点（trapezoid-v の各角）を、相手側固定点に対して
 * 目標角度で結ぶように移動させたときの新しい Y 座標を返す。
 */
export function snapCornerYForAngle(
    cornerX: number,
    counter: EdgePoint,
    targetAngle: number
): number | null {
    const dx = cornerX - counter.x
    if (Math.abs(dx) < 0.5) return null
    const t = Math.tan(targetAngle)
    if (Math.abs(t) > 20) return null // 垂直に近いと dy が無限大
    const dy = dx * t
    return counter.y + dy
}
