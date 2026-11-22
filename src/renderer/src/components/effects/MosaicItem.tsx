import React, { useRef } from 'react'
import Konva from 'konva'
import { Group, Shape, Rect } from 'react-konva'
import type { MosaicRegion } from '../../store/types'

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
    isSelected: boolean
    isMosaicMode: boolean
    onSelect: (id: string) => void
    isExporting: boolean
    onUpdate?: (id: string, updates: Partial<Omit<MosaicRegion, 'id'>>) => void
}

export const MosaicItem: React.FC<MosaicItemProps> = ({
    region,
    isSelected,
    isMosaicMode,
    onSelect,
    isExporting,
    onUpdate
}) => {
    const { x, y, width: w, height: h, type: mosaicType } = region
    const groupRef = useRef<Konva.Group>(null)

    if (mosaicType === 'none' && isExporting) return null

    // つまみ（Transformer）でのリサイズ・回転を確定する。
    // Transformer は Group を scale/rotate するので、scale を width/height に焼き直して戻す。
    const commitTransform = () => {
        const node = groupRef.current
        if (!node || !onUpdate) return
        const scaleX = node.scaleX()
        const scaleY = node.scaleY()
        node.scaleX(1)
        node.scaleY(1)
        onUpdate(region.id, {
            x: node.x(),
            y: node.y(),
            width: Math.max(4, Math.round(node.width() * scaleX)),
            height: Math.max(4, Math.round(node.height() * scaleY)),
            rotation: node.rotation()
        })
    }

    const commitDrag = () => {
        const node = groupRef.current
        if (!node || !onUpdate) return
        onUpdate(region.id, { x: node.x(), y: node.y() })
    }

    return (
        <Group
            id={`mosaic-${region.id}`}
            ref={groupRef}
            x={x} y={y}
            width={w} height={h}
            rotation={region.rotation ?? 0}
            draggable={isMosaicMode}
            onClick={() => isMosaicMode && onSelect(region.id)}
            onTap={() => isMosaicMode && onSelect(region.id)}
            onDragStart={() => isMosaicMode && onSelect(region.id)}
            onDragEnd={commitDrag}
            onTransformEnd={commitTransform}
        >
            {mosaicType === 'none' ? (
                <Rect
                    width={w} height={h}
                    stroke={isSelected ? '#3b82f6' : '#64748b'}
                    strokeWidth={1} dash={[5, 4]}
                    fill="rgba(100,120,255,0.05)"
                    listening={isMosaicMode}
                />
            ) : (
            <>
            {/* 視覚エフェクト */}
            <Shape
                width={w}
                height={h}
                listening={false}
                perfectDrawEnabled={false}
                sceneFunc={(ctx) => {
                    const rawCtx = (ctx as any)._context as CanvasRenderingContext2D

                    // 現在の変換行列から物理ピクセル座標を取得。
                    // 矩形回転やつまみ操作中の scale が入るため、スケール倍率は √(a²+b²)。
                    const t = rawCtx.getTransform()
                    const dpr = Math.hypot(t.a, t.b) || 1
                    const physX = Math.round(t.e)      // 回転時は近似（pixel/frosted のサンプリング用）
                    const physY = Math.round(t.f)
                    const physW = Math.round(w * dpr)
                    const physH = Math.round(h * dpr)

                    if (physW <= 0 || physH <= 0) return

                    const off = document.createElement('canvas')
                    off.width = physW
                    off.height = physH
                    const octx = off.getContext('2d')!

                    // 楕円アルファマスクでソフトに縁取る（棒線モザイクだけは矩形のまま使う）
                    let useEllipseMask = true

                    if (mosaicType === 'pixel-12') {
                        const blockSize = 12
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
                        // すりガラス：下地を強くぼかし、薄い白みを加える
                        let srcData: ImageData | null = null
                        try {
                            srcData = rawCtx.getImageData(physX, physY, physW, physH)
                        } catch {
                            // fallthrough
                        }

                        if (srcData) {
                            const blurAmt = Math.max(12, Math.round(20 * dpr))
                            const blurPad = blurAmt * 2
                            const tmp = document.createElement('canvas')
                            tmp.width = physW + blurPad * 2
                            tmp.height = physH + blurPad * 2
                            const tc = tmp.getContext('2d')!
                            tc.putImageData(srcData, blurPad, blurPad)

                            octx.filter = `blur(${blurAmt}px)`
                            octx.drawImage(tmp, -blurPad, -blurPad)
                            octx.filter = 'none'
                        } else {
                            octx.fillStyle = 'rgba(200,215,230,1)'
                            octx.fillRect(0, 0, physW, physH)
                        }
                        // 薄い白みでガラス感を出す（ぼかし下地が透けて見える程度）
                        octx.fillStyle = 'rgba(255,255,255,0.22)'
                        octx.fillRect(0, 0, physW, physH)
                    } else if (mosaicType === 'white-blur') {
                        octx.fillStyle = '#ffffff'
                        octx.fillRect(0, 0, physW, physH)
                    } else if (mosaicType === 'bars') {
                        // 棒線モザイク。棒幅は固定（物理px換算）なので領域の大きさに関係なく確実に出る。
                        // 棒:透明 = 1:1、色は白か黒（region.barColor）。barAngle で縞を回転。
                        // 矩形いっぱいに敷くので楕円マスクはかけない（はみ出しは canvas 境界でクリップ）。
                        const unit = Math.max(1, Math.round((region.barWidth ?? 4) * dpr))
                        octx.fillStyle = region.barColor === 'black' ? '#000000' : '#ffffff'
                        octx.save()
                        octx.globalAlpha = Math.max(0, Math.min(1, region.barOpacity ?? 1))
                        octx.translate(physW / 2, physH / 2)
                        octx.rotate(((region.barAngle ?? 0) * Math.PI) / 180)
                        // 回転しても矩形全体を覆えるよう、対角線分の範囲に敷く
                        const ext = Math.ceil(Math.hypot(physW, physH) / 2) + unit * 2
                        for (let bx = -ext; bx < ext; bx += unit * 2) {
                            octx.fillRect(bx, -ext, unit, ext * 2)
                        }
                        octx.restore()
                        useEllipseMask = false
                    }

                    // 楕円形アルファマスクを適用（小σ → コーナーがほぼ消える）
                    if (useEllipseMask) {
                        const mask = createEllipseMask(physW, physH)
                        octx.globalCompositeOperation = 'destination-in'
                        octx.drawImage(mask, 0, 0)
                        octx.globalCompositeOperation = 'source-over'
                    }

                    // メインキャンバスに描画（ローカル座標 (0,0) → 変換後の正しい位置へ）
                    rawCtx.drawImage(off, 0, 0, w, h)
                }}
            />
            {/* インタラクション用透明レイヤー（ドラッグ・選択の当たり判定。エクスポート時は非表示）*/}
            {!isExporting && (
                <Rect
                    width={w} height={h}
                    fill="transparent"
                    listening={isMosaicMode}
                />
            )}
            </>
            )}
        </Group>
    )
}
