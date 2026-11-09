import { useEffect } from 'react'
import { useMangaStore } from '../store/useMangaStore'

/**
 * グローバルなキーボードショートカット。
 * ストアは購読せず、キー押下時に getState() で最新状態を読む。
 * （購読すると編集のたびに再描画＋リスナー付け直しが発生していた）
 */
export const useKeyboardShortcuts = (): void => {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent): void => {
            // Ignore if typing in an input field
            const target = e.target as HTMLElement
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return
            }

            const s = useMangaStore.getState()
            const { selectedPanelId, selectedBubbleId, selectedMaterialId } = s
            const currentPage = s.pages.find((p) => p.id === s.currentPageId)
            const mod = e.metaKey || e.ctrlKey

            // Shift + 矢印キー: 選択中のコマを 1px 単位で移動（スナップ・自動フィット無し）
            if (
                selectedPanelId &&
                e.shiftKey &&
                !mod &&
                !e.altKey &&
                (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown')
            ) {
                const panel = currentPage?.panels.find((p) => p.id === selectedPanelId)
                if (panel) {
                    e.preventDefault()
                    let dx = 0
                    let dy = 0
                    if (e.key === 'ArrowLeft') dx = -1
                    else if (e.key === 'ArrowRight') dx = 1
                    else if (e.key === 'ArrowUp') dy = -1
                    else if (e.key === 'ArrowDown') dy = 1
                    s.updatePanel(selectedPanelId, { x: panel.x + dx, y: panel.y + dy })
                    return
                }
            }

            if (e.key === 'Backspace' || e.key === 'Delete') {
                if (selectedPanelId) {
                    const panel = currentPage?.panels.find((p) => p.id === selectedPanelId)
                    if (panel?.imagePath) {
                        // If panel has image, clear the image first
                        s.updatePanel(selectedPanelId, {
                            imagePath: undefined,
                            imageX: undefined,
                            imageY: undefined,
                            imageScale: undefined,
                            imageRotation: undefined,
                            imageFlipX: undefined,
                            isGrayscale: false,
                            grayscaleBrightness: 0
                        })
                    } else {
                        // If no image, remove the panel itself
                        s.removePanel(selectedPanelId)
                    }
                } else if (selectedBubbleId) {
                    s.removeBubble(selectedBubbleId)
                } else if (selectedMaterialId) {
                    s.removeMaterial(selectedMaterialId)
                }
            }

            // Undo / Redo
            if (mod && !e.shiftKey && e.key === 'z') {
                e.preventDefault()
                s.undo()
            } else if (mod && e.shiftKey && e.key === 'z') {
                e.preventDefault()
                s.redo()
            } else if (mod && e.key === 'y') {
                e.preventDefault()
                s.redo()
            }

            // Save
            if (mod && e.key === 's') {
                e.preventDefault()
                s.saveProject()
            }

            // Copy
            if (mod && e.key === 'c') {
                if (selectedBubbleId) {
                    e.preventDefault()
                    s.copyBubble(selectedBubbleId)
                } else if (selectedPanelId) {
                    e.preventDefault()
                    s.copyPanel(selectedPanelId)
                }
            }

            // Paste
            if (mod && e.key === 'v') {
                e.preventDefault()
                const hasPanelClip = !!s.clipboardPanel
                const hasBubbleClip = !!s.clipboardBubble
                if (!hasPanelClip && !hasBubbleClip) return

                // Last copied wins; if timestamps are equal/missing, fall back to selection context.
                if (hasPanelClip && hasBubbleClip) {
                    const panelTs = s.clipboardPanelCopiedAt ?? 0
                    const bubbleTs = s.clipboardBubbleCopiedAt ?? 0
                    if (panelTs > bubbleTs) s.pastePanel()
                    else if (bubbleTs > panelTs) s.pasteBubble()
                    else if (selectedPanelId && !selectedBubbleId && !selectedMaterialId) s.pastePanel()
                    else s.pasteBubble()
                } else if (hasPanelClip) {
                    s.pastePanel()
                } else {
                    s.pasteBubble()
                }
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])
}
