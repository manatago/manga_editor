import React, { useEffect, useRef } from 'react'
import { Text } from 'react-konva'
import type { Text as KonvaText } from 'konva'
import { ensureDistressFilterRegistered, DISTRESS_FILTER } from './textFilters'

type TextProps = React.ComponentProps<typeof Text>

type Props = TextProps & {
    enableCache?: boolean
    distressStrength?: number
    distressScale?: number
}

/**
 * Konva の filters は cache() が必要。
 * react-konva はカスタム props をノードに載せないので setAttr で渡す。
 * cache はテキスト描画後に行う（rAF で1フレーム遅延）。
 */
export const FilteredText: React.FC<Props> = ({
    enableCache,
    distressStrength = 0,
    distressScale = 1,
    filters: _filtersProp,
    ...rest
}) => {
    const ref = useRef<KonvaText | null>(null)

    useEffect(() => {
        let cancelled = false
        const node = ref.current
        if (!node) return

        ensureDistressFilterRegistered()

        const apply = () => {
            if (cancelled) return
            const n = ref.current
            if (!n) return

            n.setAttrs({
                distressStrength,
                distressScale
            })

            const useDistress = distressStrength > 0 && enableCache
            if (useDistress) {
                n.filters([DISTRESS_FILTER])
                n.clearCache()
                n.cache({ pixelRatio: window.devicePixelRatio || 2 })
            } else {
                n.filters([])
                n.clearCache()
            }
            n.getLayer()?.batchDraw()
        }

        // 初回は Konva のテキストレイアウト後に cache する
        const id = requestAnimationFrame(() => {
            requestAnimationFrame(apply)
        })

        return () => {
            cancelled = true
            cancelAnimationFrame(id)
        }
    }, [
        enableCache,
        distressStrength,
        distressScale,
        rest.text,
        rest.fontSize,
        rest.fontFamily,
        rest.fontStyle,
        rest.stroke,
        rest.strokeWidth,
        rest.letterSpacing,
        rest.fill,
        rest.width,
        rest.height
    ])

    return <Text ref={ref as any} {...rest} />
}
