import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock Electron bridge
const electronBridge = {
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
  copyFileToProject: vi.fn(async () => 'assets/references/characters/x/test.png'),
  deleteFile: vi.fn(async () => true),
  moveAssetToTrash: vi.fn(async () => ({ moved: true as const, relativePath: 'assets/dust/1_test.png' })),
  getAssets: vi.fn(async () => []),
  exportPNG: vi.fn(async () => '/tmp/out.png'),
  saveCompositePng: vi.fn(async () => ({ relativePath: 'assets/images/composite/20260101_120000_0.png' })),
  selectFile: vi.fn(async () => null),
  startDragFile: vi.fn(),
  rembgRemoveBackground: vi.fn(async () => ({ relativePath: 'assets/references/characters/x/out_nobg.png' })),
  // Add other mocks as needed
}

vi.stubGlobal('electron', electronBridge)
if (typeof window !== 'undefined') {
  ;(window as any).electron = electronBridge
}

// Silence jsdom's unimplemented dialog methods when fallback is used.
vi.stubGlobal('alert', vi.fn())
vi.stubGlobal('confirm', vi.fn(() => true))
