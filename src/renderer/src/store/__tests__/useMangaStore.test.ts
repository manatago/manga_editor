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
})
