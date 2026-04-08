import React from 'react'
import { Group, Shape, Rect } from 'react-konva'
import type { MosaicRegion, MosaicType } from '../../store/types'

/**
 * ソフトな楕円形アルファマスクを生成する。
 * 鮮明な楕円を描いてから CSS blur でぼかすことでコーナーが消えて楕円形に見える。
 * feather は物理ピクセル単位。
 */
function createEllipseMask(physW: number, physH: number, feather: number): HTMLCanvasElement {
    const pad = Math.ceil(feather) * 2

    // ぼかしが枠外に逃げないよう余白付きキャンバスに楕円を描く
    const padded = document.createElement('canvas')
    padded.width = physW + pad * 2
    padded.height = physH + pad * 2
    const pc = padded.getContext('2d')!

    const inset = feather * 0.35
    pc.fillStyle = '#ffffff'
    pc.beginPath()
    pc.ellipse(
        padded.width / 2,
        padded.height / 2,
        Math.max(1, physW / 2 - inset),
        Math.max(1, physH / 2 - inset),
        0, 0, Math.PI * 2
    )
    pc.fill()

    // 余白分ずらして描くことで blur が端まで適切にフェードアウトする
    const result = document.createElement('canvas')
    result.width = physW
    result.height = physH
    const rc = result.getContext('2d')!
    rc.filter = `blur(${feather}px)`
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

    // グローバルグリッドの開始オフセット（負値で左上方向にはみ出して揃える）
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
                    const dpr = t.a                          // scaleX = devicePixelRatio
                    const physX = Math.round(t.e)            // = x * dpr
                    const physY = Math.round(t.f)            // = y * dpr
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
                            // フォールバック：グレー塗りつぶし
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
                            const blurPad = Math.max(20, Math.round(12 * dpr))
                            const tmpW = physW + blurPad * 2
                            const tmpH = physH + blurPad * 2
                            const tmp = document.createElement('canvas')
                            tmp.width = tmpW
                            tmp.height = tmpH
                            const tc = tmp.getContext('2d')!
                            tc.putImageData(srcData, blurPad, blurPad)

                            const blurAmt = Math.max(4, Math.round(8 * dpr))
                            octx.filter = `blur(${blurAmt}px)`
                            octx.drawImage(tmp, -blurPad, -blurPad)
                            octx.filter = 'none'
                        } else {
                            octx.fillStyle = 'rgba(200,215,230,1)'
                            octx.fillRect(0, 0, physW, physH)
                        }

                        // 白みを重ねる
                        octx.fillStyle = 'rgba(255,255,255,0.50)'
                        octx.fillRect(0, 0, physW, physH)
                    } else if (mosaicType === 'white-blur') {
                        octx.fillStyle = '#ffffff'
                        octx.fillRect(0, 0, physW, physH)
                    }

                    // 楕円形にぼかしたアルファマスクを適用
                    // feather は短辺の 30% 程度（最低 10px物理）でコーナーがほぼ消える
                    const feather = Math.max(10 * dpr, Math.min(physW, physH) * 0.30)
                    const mask = createEllipseMask(physW, physH, feather)
                    octx.globalCompositeOperation = 'destination-in'
                    octx.drawImage(mask, 0, 0)
                    octx.globalCompositeOperation = 'source-over'

                    // メインキャンバスに描画（ローカル座標 0,0 → 変換後の正しい位置へ）
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
