import { useCallback, useEffect, useRef, useState } from 'react'

type Args = {
    isOpen: boolean
    canvasW: number
    canvasH: number
    viewportRef: React.RefObject<HTMLDivElement | null>
}

export function useFitScale({ isOpen, canvasW, canvasH, viewportRef }: Args): {
    fitScale: number
    fitScaleRef: React.RefObject<number>
    resetFitScale: () => void
} {
    const [fitScale, setFitScale] = useState(1)
    const fitScaleRef = useRef(1)

    useEffect(() => {
        fitScaleRef.current = fitScale
    }, [fitScale])

    useEffect(() => {
        if (!isOpen) return
        const el = viewportRef.current
        if (!el) return
        const update = (): void => {
            const pad = 16
            const w = Math.max(80, el.clientWidth - pad)
            const h = Math.max(80, el.clientHeight - pad)
            const sx = w / canvasW
            const sy = h / canvasH
            const s = Math.min(sx, sy, 1)
            setFitScale(s > 0 && Number.isFinite(s) ? s : 1)
        }
        update()
        const ro = new ResizeObserver(update)
        ro.observe(el)
        window.addEventListener('resize', update)
        return () => {
            ro.disconnect()
            window.removeEventListener('resize', update)
        }
    }, [isOpen, canvasW, canvasH, viewportRef])

    const resetFitScale = useCallback(() => setFitScale(1), [])

    return { fitScale, fitScaleRef, resetFitScale }
}
