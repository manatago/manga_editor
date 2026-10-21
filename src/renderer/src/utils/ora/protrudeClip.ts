// はみ出しを許す範囲（コマのローカル座標の多角形の集まり）。DOM に触らない純粋関数。
//
// コマの辺ごとに「その辺の外へ抜けてよいか」を持つ（docs: gousei/docs/FORMAT.md「mangas でのはみ出し表現」。
// 頭は上の枠を突き破るが、下で切れた胴体は下の枠で切る、を表すため）。
// 許した辺ごとに、辺から外へ大きく伸ばした四角を作る。隣り合う 2 辺を両方許したら、角のすき間も埋める。
// 辺はコマの線の太さの半分だけ内側から始める（線の上にも人物が重なり、突き破ったように見える）。

export type ProtrudeEdge = 'top' | 'right' | 'bottom' | 'left'
export type ProtrudeEdges = Partial<Record<ProtrudeEdge, boolean>>

/** 全部の辺を許す（設定が無いときの既定） */
export const ALL_EDGES: Record<ProtrudeEdge, boolean> = { top: true, right: true, bottom: true, left: true }

/** 辺の外向きの向きから、上下左右のどれかを決める */
export function edgeSide(nx: number, ny: number): ProtrudeEdge {
    if (Math.abs(nx) > Math.abs(ny)) return nx > 0 ? 'right' : 'left'
    return ny > 0 ? 'bottom' : 'top'
}

/**
 * @param points コマの多角形 [x0, y0, x1, y1, ...]（getPanelPoints と同じ）
 * @param edges 許す辺
 * @param inset 辺をこれだけ内側へずらしてから伸ばす（線の太さの半分）
 * @param far 外へ伸ばす長さ
 * @returns 多角形の一覧（それぞれ [x0, y0, ...]）。これらを合わせた範囲に描く
 */
export function protrudeRegions(points: number[], edges: ProtrudeEdges, inset = 0, far = 100000): number[][] {
    const n = points.length / 2
    if (n < 3) return []
    let area = 0
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n
        area += points[i * 2] * points[j * 2 + 1] - points[j * 2] * points[i * 2 + 1]
    }
    // 画面の座標（y が下向き）では、area > 0 のとき辺の左手側（(dy, -dx) の向き）が外
    const sign = area > 0 ? 1 : -1
    const normals: [number, number][] = []
    const allowed: boolean[] = []
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n
        const dx = points[j * 2] - points[i * 2], dy = points[j * 2 + 1] - points[i * 2 + 1]
        const len = Math.hypot(dx, dy) || 1
        const nx = (dy / len) * sign, ny = (-dx / len) * sign
        normals.push([nx, ny])
        allowed.push(!!edges[edgeSide(nx, ny)])
    }
    const out: number[][] = []
    for (let i = 0; i < n; i++) {
        if (!allowed[i]) continue
        const j = (i + 1) % n
        const [nx, ny] = normals[i]
        const ax = points[i * 2] - nx * inset, ay = points[i * 2 + 1] - ny * inset
        const bx = points[j * 2] - nx * inset, by = points[j * 2 + 1] - ny * inset
        out.push([ax, ay, bx, by, bx + nx * far, by + ny * far, ax + nx * far, ay + ny * far])
        // 次の辺も許すなら、角のすき間（2 つの四角のあいだ）を埋める
        const k = (i + 1) % n
        if (allowed[k]) {
            const [mx, my] = normals[k]
            const cx = points[k * 2], cy = points[k * 2 + 1]
            out.push([cx, cy, cx + nx * far, cy + ny * far, cx + (nx + mx) * far, cy + (ny + my) * far, cx + mx * far, cy + my * far])
        }
    }
    return out
}
