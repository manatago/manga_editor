import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useMangaStore } from '../useMangaStore'

describe('useMangaStore', () => {
    beforeEach(() => {
        // Reset store state before each test
        const state = useMangaStore.getState()
        useMangaStore.setState({
            pages: [],
            currentPageId: null,
            currentProjectPath: null,
        })
    })

    it('getProjectData should return centralized project structure', () => {
        const testPages = [
            { id: 'page-1', name: '001', panels: [], bubbles: [], materials: [], backgroundColor: '#fff', backgroundOpacity: 1 }
        ]
        
        useMangaStore.setState({
            pages: testPages,
            currentPageId: 'page-1'
        })

        const projectData = useMangaStore.getState().getProjectData()

        expect(projectData).toHaveProperty('pages')
        expect(projectData).toHaveProperty('lastPageId')
        expect(projectData.pages).toEqual(testPages)
        expect(projectData.lastPageId).toBe('page-1')
    })

    it('saveAsTemplate should filter out image data from panels', async () => {
        const testPanel = {
            id: 'panel-1',
            type: 'rect' as const,
            x: 0, y: 0, width: 100, height: 100,
            imagePath: 'secret/path.png',
            imageScale: 2,
            isGrayscale: true,
            slant: 0, offsetB: 0, offsetC: 0, offsetD: 0,
            strokeWidth: 4,
            strokeColor: '#000000',
            focusCenterX: 0.5, focusCenterY: 0.5,
            focusDensity: 100, focusWidth: 1, focusRadius: 50,
            fadeStrength: 0.4, fadeDirection: 'none' as const,
            hasFocusLines: false, imageFlipX: false, imageRotation: 0, imageX: 0, imageY: 0
        }

        useMangaStore.setState({
            pages: [{
                id: 'page-1',
                name: '001',
                panels: [testPanel],
                bubbles: [],
                materials: [],
                backgroundColor: '#fff',
                backgroundOpacity: 1
            }],
            currentPageId: 'page-1'
        })

        // Mock window.electron.saveTemplate
        const mockSaveTemplate = vi.fn().mockResolvedValue(undefined)
        vi.stubGlobal('electron', {
            saveTemplate: mockSaveTemplate,
            getTemplates: vi.fn().mockResolvedValue([])
        })

        await useMangaStore.getState().saveAsTemplate('Test Template')

        expect(mockSaveTemplate).toHaveBeenCalled()
        const savedTemplate = mockSaveTemplate.mock.calls[0][0]
        
        const savedPanel = savedTemplate.panels[0]
        expect(savedPanel.imagePath).toBeUndefined()
        expect(savedPanel.imageScale).toBeUndefined()
        expect(savedPanel.isGrayscale).toBeUndefined()
        expect(savedPanel.width).toBe(100) // Structure should remain
    })

    it('addPanel and undo/redo should mutate pages with history', () => {
        useMangaStore.setState({
            pages: [{ id: 'page-1', name: '001', panels: [], bubbles: [], materials: [], backgroundColor: '#fff', backgroundOpacity: 1 }],
            currentPageId: 'page-1'
        })

        useMangaStore.getState().addPanel({ x: 10, y: 20, width: 100, height: 80 })
        let state = useMangaStore.getState()
        expect(state.pages[0].panels.length).toBe(1)
        expect(state.past.length).toBe(1)

        useMangaStore.getState().undo()
        state = useMangaStore.getState()
        expect(state.pages[0].panels.length).toBe(0)

        useMangaStore.getState().redo()
        state = useMangaStore.getState()
        expect(state.pages[0].panels.length).toBe(1)
    })

    it('removeBubble should delete selected bubble', () => {
        useMangaStore.setState({
            pages: [{
                id: 'page-1',
                name: '001',
                panels: [],
                bubbles: [{
                    id: 'bubble-1',
                    type: 'rounded',
                    x: 10, y: 10, width: 120, height: 80,
                    text: 'x',
                    fontSize: 22,
                    fontFamily: "'Hiragino Mincho ProN', 'MS PMincho', serif",
                    lineHeight: 1,
                    letterSpacing: 0,
                    fontColor: '#000000',
                    fontWeight: 'bold',
                    isVertical: true,
                    backgroundColor: '#ffffff',
                    backgroundOpacity: 1,
                    borderColor: '#000000',
                    borderWidth: 1,
                    opacity: 1,
                    textOffsetX: 0,
                    textOffsetY: 0,
                    deformation: 1,
                    isClipped: false,
                    rotation: 0
                }],
                materials: [],
                backgroundColor: '#fff',
                backgroundOpacity: 1
            }],
            currentPageId: 'page-1',
            selectedBubbleId: 'bubble-1'
        })

        useMangaStore.getState().removeBubble('bubble-1')
        const state = useMangaStore.getState()
        expect(state.pages[0].bubbles).toHaveLength(0)
        expect(state.selectedBubbleId).toBeNull()
    })
})
