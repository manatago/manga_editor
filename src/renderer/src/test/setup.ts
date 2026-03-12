import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock Electron
vi.stubGlobal('electron', {
  getPathForFile: vi.fn(),
  pathToUrl: vi.fn(),
  saveProject: vi.fn(),
  getTemplates: vi.fn(),
  saveTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
  // Add other mocks as needed
})
