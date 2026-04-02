import { useEffect } from 'react'
import { useMangaStore } from '../store/useMangaStore'

export const useKeyboardShortcuts = () => {
    const {
        selectedPanelId,
        selectedBubbleId,
        removePanel,
        removeBubble,
        removeMaterial,
        selectedMaterialId,
        undo,
        redo,
        saveProject,
        pages,
        currentPageId,
        updatePanel,
        copyBubble,
        pasteBubble,
        copyPanel,
        pastePanel,
        clipboardBubble,
        clipboardPanel
    } = useMangaStore()

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in an input field
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }

            if (e.key === 'Backspace' || e.key === 'Delete') {
                if (selectedPanelId) {
                    const currentPage = pages.find(p => p.id === currentPageId);
                    const panel = currentPage?.panels.find(p => p.id === selectedPanelId);
                    
                    if (panel?.imagePath) {
                        // If panel has image, clear the image first
                        updatePanel(selectedPanelId, {
                            imagePath: undefined,
                            imageX: undefined,
                            imageY: undefined,
                            imageScale: undefined,
                            imageRotation: undefined,
                            imageFlipX: undefined,
                            isGrayscale: false
                        });
                    } else {
                        // If no image, remove the panel itself
                        removePanel(selectedPanelId);
                    }
                } else if (selectedBubbleId) {
                    removeBubble(selectedBubbleId);
                } else if (selectedMaterialId) {
                    removeMaterial(selectedMaterialId);
                }
            }

            // Undo / Redo
            if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'z') {
                e.preventDefault();
                undo();
            } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z') {
                e.preventDefault();
                redo();
            } else if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
                e.preventDefault();
                redo();
            }

            // Save
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                saveProject();
            }

            // Copy bubble
            if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
                if (selectedBubbleId) {
                    e.preventDefault();
                    copyBubble(selectedBubbleId);
                } else if (selectedPanelId) {
                    e.preventDefault()
                    copyPanel(selectedPanelId)
                }
            }

            // Paste bubble
            if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
                e.preventDefault();
                if (selectedPanelId || (!selectedBubbleId && !selectedMaterialId && clipboardPanel)) {
                    pastePanel()
                } else if (selectedBubbleId || clipboardBubble) {
                    pasteBubble()
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
        selectedPanelId, 
        selectedBubbleId, 
        selectedMaterialId, 
        removePanel, 
        removeBubble, 
        removeMaterial, 
        undo, 
        redo, 
        saveProject, 
        pages, 
        currentPageId, 
        updatePanel, 
        copyBubble, 
        pasteBubble,
        copyPanel,
        pastePanel,
        clipboardBubble,
        clipboardPanel
    ]);
}
