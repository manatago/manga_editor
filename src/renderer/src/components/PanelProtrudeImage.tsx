import React, { useEffect, useMemo, useRef } from 'react'
import Konva from 'konva'
import { Group, Image as KonvaImage } from 'react-konva'
import useImage from 'use-image'
import type { Panel } from '../store/types'

/**
 * コマ枠からはみ出させた人物画像。
 *
 * 通常のコマ画像はパネル形状の Line に fillPattern として敷かれ、コマ形状でクリップされる。
 * こちらはクリップされないレイヤー（コマ枠の上）へ、同じ変換で画像を「素の Konva.Image」として
 * 描き直す。Konva の fillPattern 変換は translate(x,y)∘rotate∘scale∘translate(-offset) で、
 * Konva.Image ノードの変換と同一構造なので、下記の指定でクリップ版とピクセル一致する。
 *
 * 枠内の背景は「元画像(imagePath)をコマ形状でクリップした下地」（PanelItem の content パス）が
 * 担保する。こちらは切り抜き(protrudeImagePath, 背景透過)を、コマ枠線の上に一切クリップせず重ねる。
 * これにより人物が枠線を突き破って前面に出る（はみ出し演出）。両者は同一ソース・同一変換なので、
 * 枠内では人物部分が下地とピタリ重なり、切り抜きの透明部からは下地の背景がそのまま見える。
 *
 * ・コマ内の背景は下地が出す＝背景がコマ範囲内で復活・非破壊・コマ変形に連動
 * ・ワンド補正でコマ内側の切り抜きを消しても、下地が出るので結果に影響しない
 * ・人物は枠線の手前（枠の上）に描かれる＝枠を突き破ったように見える
 * 切り抜き未生成の間は imagePath で代用する。
 */
export const PanelProtrudeImage: React.FC<{
    panel: Panel
    projectPath: string | null
}> = ({ panel, projectPath }) => {
    // 切り抜きがあればそれを、無ければ元画像で代用
    const sourcePath = panel.protrudeImagePath || panel.imagePath
    const imageUrl = useMemo(() => {
        if (!sourcePath) return ''
        if (window.electron?.resolveAssetPath && projectPath) {
            return window.electron.pathToUrl(window.electron.resolveAssetPath(projectPath, sourcePath))
        }
        return window.electron ? window.electron.pathToUrl(sourcePath) : sourcePath
    }, [sourcePath, projectPath])

    const [image] = useImage(imageUrl)
    const imgRef = useRef<Konva.Image>(null)

    // グレースケール／ぼかしはコマ本体と同じ見た目にそろえる（フィルタ適用には cache が必要）
    useEffect(() => {
        const node = imgRef.current
        if (!node) return
        node.clearCache()
        if (image && (panel.isGrayscale || (panel.blurRadius ?? 0) > 0)) {
            node.cache()
        }
    }, [
        image,
        panel.isGrayscale,
        panel.grayscaleBrightness,
        panel.blurRadius,
        panel.imageFlipX,
        panel.imageScale,
        panel.imageRotation,
        panel.imageX,
        panel.imageY,
        panel.imagePath,
        panel.protrudeImagePath
    ])

    if (!panel.imageProtrude || !panel.imagePath || !image) return null

    const sign = panel.imageFlipX ? -1 : 1
    const scale = panel.imageScale ?? 1

    return (
        <Group
            x={panel.x + panel.width / 2}
            y={panel.y + panel.height / 2}
            offsetX={panel.width / 2}
            offsetY={panel.height / 2}
            rotation={panel.rotation ?? 0}
            listening={false}
        >
            <KonvaImage
                ref={imgRef}
                image={image}
                x={panel.imageX ?? 0}
                y={panel.imageY ?? 0}
                offsetX={image.width / 2}
                offsetY={image.height / 2}
                scaleX={sign * scale}
                scaleY={scale}
                rotation={panel.imageRotation ?? 0}
                filters={[
                    ...(panel.isGrayscale ? [Konva.Filters.Grayscale, Konva.Filters.Brighten] : []),
                    ...((panel.blurRadius ?? 0) > 0 ? [Konva.Filters.Blur] : [])
                ]}
                brightness={panel.isGrayscale ? (panel.grayscaleBrightness ?? 0) : 0}
                blurRadius={panel.blurRadius ?? 0}
                listening={false}
            />
        </Group>
    )
}
