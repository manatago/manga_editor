import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock Electron
vi.stubGlobal('electron', {
  getPathForFile: vi.fn(),
  pathToUrl: vi.fn((p: string) => p),
  resolveAssetPath: vi.fn((_root: string, stored: string) => stored),
  saveProject: vi.fn(),
  saveProjectSync: vi.fn(() => true),
  getTemplates: vi.fn(),
  saveTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
  showMessage: vi.fn(async () => true),
  confirmMessage: vi.fn(async () => true),
  // Add other mocks as needed
})
