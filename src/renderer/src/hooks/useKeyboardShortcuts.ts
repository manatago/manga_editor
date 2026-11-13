import { useEffect } from 'react'
import { useMangaStore } from '../store/useMangaStore'
import { useShortcutHelp } from '../components/ShortcutHelp'

const ARROWS: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1]
}

const isTypingTarget = (target: EventTarget | null): boolean => {
    const el = target as HTMLElement | null
    if (!el) return false
    return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable
}

/**
 * モーダル（全画面オーバーレイ）が開いているか。開いている間はキャンバス向けの操作を止める。
 * 画像合成・マジックワンド等は自前で Cmd+Z / Delete を処理するため、二重に効くのを防ぐ。
 * 台本エディタはストアの吹き出しを直接編集する画面なので例外として通す。
 */
const isBlockingModalOpen = (): boolean =>
    !useMangaStore.getState().scriptEditorOpen && !!document.querySelector('.fixed.inset-0')

/**
 * グローバルなキーボードショートカット（一覧は components/ShortcutHelp.tsx）。
 * ストアは購読せず、キー押下時に getState() で最新状態を読む。
 * ズーム・パンは components/Canvas/CanvasViewport.tsx。
 */
export const useKeyboardShortcuts = (): void => {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent): void => {
            if (isTypingTarget(e.target)) return
            if (useShortcutHelp.getState().open) return // 一覧表示中は一覧側が Esc を処理

            const s = useMangaStore.getState()
            const mod = e.metaKey || e.ctrlKey
            const key = e.key.toLowerCase()

            // 保存はどの画面でも有効
            if (mod && key === 's') {
                e.preventDefault()
                s.saveProject()
                return
            }
            if (isBlockingModalOpen()) return

            if (e.key === '?' && !mod) {
                e.preventDefault()
                useShortcutHelp.getState().setOpen(true)
                return
            }

            const { selectedPanelId, selectedBubbleId, selectedMaterialId } = s
            const currentPage = s.pages.find((p) => p.id === s.currentPageId)

            // Undo / Redo（Shift 併用時に key が大文字 'Z' で届く環境もあるため小文字化して判定）
            if (mod && key === 'z') {
                e.preventDefault()
                if (e.shiftKey) s.redo()
                else s.undo()
                return
            }
            if (mod && key === 'y') {
                e.preventDefault()
                s.redo()
                return
            }

            // Esc: モザイク描画モードを抜ける → 選択解除
            if (e.key === 'Escape') {
                if (s.isMosaicMode) s.setIsMosaicMode(false)
                else if (selectedPanelId || selectedBubbleId || selectedMaterialId || s.selectedMosaicId) {
                    s.setSelectedPanel(null)
                    s.setSelectedBubble(null)
                    s.setSelectedMaterial(null)
                    s.setSelectedMosaicId(null)
                }
                return
            }

            // 矢印: 選択中の要素を 1px、Shift で 10px 移動（スナップ・自動フィット無し）
            const arrow = ARROWS[e.key]
            if (arrow && !mod && !e.altKey) {
                const step = e.shiftKey ? 10 : 1
                const [dx, dy] = [arrow[0] * step, arrow[1] * step]
                if (selectedBubbleId) {
                    const b = currentPage?.bubbles.find((x) => x.id === selectedBubbleId)
                    if (b) {
                        e.preventDefault()
                        s.updateBubble(b.id, { x: b.x + dx, y: b.y + dy })
                    }
                } else if (selectedMaterialId) {
                    const m = currentPage?.materials.find((x) => x.id === selectedMaterialId)
                    if (m) {
                        e.preventDefault()
                        s.updateMaterial(m.id, { x: m.x + dx, y: m.y + dy })
                    }
                } else if (selectedPanelId) {
                    const p = currentPage?.panels.find((x) => x.id === selectedPanelId)
                    if (p) {
                        e.preventDefault()
                        s.updatePanel(p.id, { x: p.x + dx, y: p.y + dy })
                    }
                }
                return
            }

            // PageUp / PageDown: 前後のページへ
            if ((e.key === 'PageUp' || e.key === 'PageDown') && !mod) {
                const idx = s.pages.findIndex((p) => p.id === s.currentPageId)
                const next = s.pages[idx + (e.key === 'PageUp' ? -1 : 1)]
                e.preventDefault()
                if (idx >= 0 && next) s.selectPage(next.id)
                return
            }

            // Cmd+D: 複製
            if (mod && key === 'd') {
                e.preventDefault()
                if (selectedBubbleId) s.duplicateBubble(selectedBubbleId)
                else if (selectedMaterialId) s.duplicateMaterial(selectedMaterialId)
                else if (selectedPanelId) s.duplicatePanel(selectedPanelId)
                return
            }

            if (e.key === 'Backspace' || e.key === 'Delete') {
                if (selectedPanelId) {
                    const panel = currentPage?.panels.find((p) => p.id === selectedPanelId)
                    if (panel?.imagePath) {
                        // 画像のあるコマは、まず画像だけを外す
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
                        s.removePanel(selectedPanelId)
                    }
                } else if (selectedBubbleId) {
                    s.removeBubble(selectedBubbleId)
                } else if (selectedMaterialId) {
                    s.removeMaterial(selectedMaterialId)
                }
                return
            }

            // Copy
            if (mod && key === 'c') {
                if (selectedBubbleId) {
                    e.preventDefault()
                    s.copyBubble(selectedBubbleId)
                } else if (selectedPanelId) {
                    e.preventDefault()
                    s.copyPanel(selectedPanelId)
                }
                return
            }

            // Paste（最後にコピーした方を貼る。同時刻なら選択状況で判断）
            if (mod && key === 'v') {
                e.preventDefault()
                const hasPanelClip = !!s.clipboardPanel
                const hasBubbleClip = !!s.clipboardBubble
                if (!hasPanelClip && !hasBubbleClip) return
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
