import React from 'react'
import { Group, Shape, Rect } from 'react-konva'
import type { MosaicRegion, MosaicType } from '../../store/types'

/**
 * 楕円形アルファマスクを生成する。
 *
 * 「大きい σ のガウシアンでぼかす」と角が残る（Φ(-d/σ) が大きい）。
 * 正解は「内接楕円をそのまま描いて、小さい σ でタイトにぼかす」こと。
 * d/σ ≈ 3〜4 になるため Φ(-3.5) ≈ 0.02% → 角がほぼ消える。
 *
 * physW/physH は物理ピクセル単位。
 */
function createEllipseMask(physW: number, physH: number): HTMLCanvasElement {
    // σ = 短辺の 6%（最低 5px）。小さいほど急峻な falloff で角が消えやすい。
    const σ = Math.max(5, Math.min(physW, physH) * 0.06)
    // ぼかしが枠外に逃げないよう 4σ の余白を確保する
    const pad = Math.ceil(σ) * 4

    const padded = document.createElement('canvas')
    padded.width = physW + pad * 2
    padded.height = physH + pad * 2
    const pc = padded.getContext('2d')!

    // 完全内接楕円（内側オフセットなし）を白く塗る
    pc.fillStyle = '#ffffff'
    pc.beginPath()
    pc.ellipse(
        padded.width / 2, padded.height / 2,
        physW / 2, physH / 2,
        0, 0, Math.PI * 2
    )
    pc.fill()

    const result = document.createElement('canvas')
    result.width = physW
    result.height = physH
    const rc = result.getContext('2d')!
    rc.filter = `blur(${σ}px)`
    rc.drawImage(padded, -pad, -pad)

    return result
}

/**
 * ピクセルモザイク：各ブロック内のピクセルの平均色を計算して塗りつぶす。
 * グローバルグリッド整合: physX/physY を基準にオフセットし、
 * 隣接領域がブロック境界でシームレスにつながる。
 */
function applyPixelate(
    srcData: ImageData,
    physW: number,
    physH: number,
    physBlock: number,
    physX: number,
    physY: number
): HTMLCanvasElement {
    const out = new ImageData(physW, physH)

    const offX = physX % physBlock
    const offY = physY % physBlock

    for (let by = -offY; by < physH; by += physBlock) {
        for (let bx = -offX; bx < physW; bx += physBlock) {
            let r = 0, g = 0, b = 0, a = 0, count = 0
            const pyMin = Math.max(0, by)
            const pyMax = Math.min(physH, by + physBlock)
            const pxMin = Math.max(0, bx)
            const pxMax = Math.min(physW, bx + physBlock)

            for (let py = pyMin; py < pyMax; py++) {
                for (let px = pxMin; px < pxMax; px++) {
                    const idx = (py * physW + px) * 4
                    r += srcData.data[idx]
                    g += srcData.data[idx + 1]
                    b += srcData.data[idx + 2]
                    a += srcData.data[idx + 3]
                    count++
                }
            }
            if (count === 0) continue

            const ar = Math.round(r / count)
            const ag = Math.round(g / count)
            const ab = Math.round(b / count)
            const aa = Math.round(a / count)

            for (let py = pyMin; py < pyMax; py++) {
                for (let px = pxMin; px < pxMax; px++) {
                    const idx = (py * physW + px) * 4
                    out.data[idx]     = ar
                    out.data[idx + 1] = ag
                    out.data[idx + 2] = ab
                    out.data[idx + 3] = aa
                }
            }
        }
    }

    const canvas = document.createElement('canvas')
    canvas.width = physW
    canvas.height = physH
    canvas.getContext('2d')!.putImageData(out, 0, 0)
    return canvas
}

interface MosaicItemProps {
    region: MosaicRegion
    mosaicType: MosaicType
    isSelected: boolean
    onSelect: (id: string) => void
    isExporting: boolean
}

export const MosaicItem: React.FC<MosaicItemProps> = ({
    region,
    mosaicType,
    isSelected,
    onSelect,
    isExporting
}) => {
    const { x, y, width: w, height: h } = region

    if (mosaicType === 'none') {
        if (isExporting) return null
        return (
            <Rect
                x={x} y={y} width={w} height={h}
                stroke={isSelected ? '#3b82f6' : '#64748b'}
                strokeWidth={1} dash={[5, 4]}
                fill="rgba(100,120,255,0.05)"
                listening={true}
                onClick={() => onSelect(region.id)}
                onTap={() => onSelect(region.id)}
            />
        )
    }

    return (
        <Group x={x} y={y}>
            {/* 視覚エフェクト */}
            <Shape
                width={w}
                height={h}
                listening={false}
                perfectDrawEnabled={false}
                sceneFunc={(ctx) => {
                    const rawCtx = (ctx as any)._context as CanvasRenderingContext2D

                    // 現在の変換行列から物理ピクセル座標を取得
                    // Konva は layer に scale(dpr, dpr) + group に translate(x, y) を適用している
                    const t = rawCtx.getTransform()
                    const dpr = t.a                    // scaleX = devicePixelRatio
                    const physX = Math.round(t.e)      // = x * dpr
                    const physY = Math.round(t.f)      // = y * dpr
                    const physW = Math.round(w * dpr)
                    const physH = Math.round(h * dpr)

                    if (physW <= 0 || physH <= 0) return

                    const off = document.createElement('canvas')
                    off.width = physW
                    off.height = physH
                    const octx = off.getContext('2d')!

                    if (mosaicType === 'pixel-4' || mosaicType === 'pixel-12') {
                        const blockSize = mosaicType === 'pixel-4' ? 4 : 12
                        const physBlock = Math.max(1, Math.round(blockSize * dpr))

                        // 既に描画済みのキャンバスから下地ピクセルをサンプリング
                        let srcData: ImageData | null = null
                        try {
                            srcData = rawCtx.getImageData(physX, physY, physW, physH)
                        } catch {
                            // CORS等で失敗した場合はフォールバック
                        }

                        if (srcData) {
                            const pixelated = applyPixelate(srcData, physW, physH, physBlock, physX, physY)
                            octx.drawImage(pixelated, 0, 0)
                        } else {
                            octx.fillStyle = 'rgba(140,140,140,0.95)'
                            octx.fillRect(0, 0, physW, physH)
                        }
                    } else if (mosaicType === 'frosted') {
                        // 曇りガラス：下地をぼかして白みを加える
                        let srcData: ImageData | null = null
                        try {
                            srcData = rawCtx.getImageData(physX, physY, physW, physH)
                        } catch {
                            // fallthrough
                        }

                        if (srcData) {
                            const blurPad = Math.max(20, Math.round(14 * dpr))
                            const tmp = document.createElement('canvas')
                            tmp.width = physW + blurPad * 2
                            tmp.height = physH + blurPad * 2
                            const tc = tmp.getContext('2d')!
                            tc.putImageData(srcData, blurPad, blurPad)

                            const blurAmt = Math.max(6, Math.round(10 * dpr))
                            octx.filter = `blur(${blurAmt}px)`
                            octx.drawImage(tmp, -blurPad, -blurPad)
                            octx.filter = 'none'
                        } else {
                            octx.fillStyle = 'rgba(200,215,230,1)'
                            octx.fillRect(0, 0, physW, physH)
                        }
                        // 白みを重ねてより「曇りガラス」らしくする
                        octx.fillStyle = 'rgba(255,255,255,0.68)'
                        octx.fillRect(0, 0, physW, physH)
                    } else if (mosaicType === 'white-blur') {
                        octx.fillStyle = '#ffffff'
                        octx.fillRect(0, 0, physW, physH)
                    }

                    // 楕円形アルファマスクを適用（小σ → コーナーがほぼ消える）
                    const mask = createEllipseMask(physW, physH)
                    octx.globalCompositeOperation = 'destination-in'
                    octx.drawImage(mask, 0, 0)
                    octx.globalCompositeOperation = 'source-over'

                    // メインキャンバスに描画（ローカル座標 (0,0) → 変換後の正しい位置へ）
                    rawCtx.drawImage(off, 0, 0, w, h)
                }}
            />
            {/* インタラクション用透明レイヤー（エクスポート時は非表示）*/}
            {!isExporting && (
                <Rect
                    width={w} height={h}
                    fill="transparent"
                    stroke={isSelected ? '#3b82f6' : 'transparent'}
                    strokeWidth={isSelected ? 2 : 0}
                    dash={isSelected ? [6, 3] : undefined}
                    listening={true}
                    onClick={() => onSelect(region.id)}
                    onTap={() => onSelect(region.id)}
                />
            )}
        </Group>
    )
}
