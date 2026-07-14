import { useCallback, useEffect, useRef, useState } from 'react'
import {
    cloneSnapshot,
    MAX_UNDO,
    type CompositorCharInstance,
    type CompositorSnapshot,
    type LayerTransform
} from './types'

type Args = {
    isOpen: boolean
    aspectPresetId: string
    canvasW: number
    canvasH: number
    bgLibraryId: string | null
    bgToneId: string | null
    bgToneScale: number
    bgT: LayerTransform
    charInstances: CompositorCharInstance[]
    selected: 'bg' | string | null
    applySnapshot: (snap: CompositorSnapshot) => void
}

export function useCompositorUndo({
    isOpen,
    aspectPresetId,
    canvasW,
    canvasH,
    bgLibraryId,
    bgToneId,
    bgToneScale,
    bgT,
    charInstances,
    selected,
    applySnapshot
}: Args): {
    pushUndo: () => void
    handleUndo: () => void
    resetUndo: () => void
} {
    const [, setUndoStack] = useState<CompositorSnapshot[]>([])
    const snapshotRef = useRef<CompositorSnapshot | null>(null)

    useEffect(() => {
        if (!isOpen) return
        snapshotRef.current = {
            aspectPresetId,
            canvasW,
            canvasH,
            bgLibraryId,
            bgToneId,
            bgToneScale,
            bgT: { ...bgT },
            charInstances: charInstances.map((c) => ({
                ...c,
                layoutResolved: c.layoutResolved,
                transform: { ...c.transform }
            })),
            selected
        }
    }, [isOpen, aspectPresetId, canvasW, canvasH, bgLibraryId, bgToneId, bgToneScale, bgT, charInstances, selected])

    const pushUndo = useCallback(() => {
        const s = snapshotRef.current
        if (!s) return
        setUndoStack((st) => [...st.slice(-(MAX_UNDO - 1)), cloneSnapshot(s)])
    }, [])

    const handleUndo = useCallback(() => {
        setUndoStack((st) => {
            if (st.length === 0) return st
            const top = st[st.length - 1]
            const next = st.slice(0, -1)
            requestAnimationFrame(() => applySnapshot(top))
            return next
        })
    }, [applySnapshot])

    const resetUndo = useCallback(() => setUndoStack([]), [])

    return { pushUndo, handleUndo, resetUndo }
}
