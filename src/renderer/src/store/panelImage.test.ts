import { describe, it, expect } from 'vitest'
import { clearPanelImage, setPanelImage } from './panelImage'
import type { Panel } from './types'

const derived: Partial<Panel> = {
    imagePath: 'assets/images/old.png',
    isManga: true,
    mangaImagePath: 'assets/manga/p1_main.png',
    mangaProtrudePath: 'assets/manga/p1_people.png',
    mangaStamp: 123,
    mangaLevel: 'mid',
    imageProtrude: true,
    protrudeImagePath: 'assets/ora/fig.png',
    protrudeOutsideOnly: true,
    oraSourcePath: '/x/scene.ora'
}
const DERIVED_KEYS = ['isManga', 'mangaImagePath', 'mangaProtrudePath', 'mangaStamp', 'mangaLevel', 'imageProtrude', 'protrudeImagePath', 'protrudeOutsideOnly', 'oraSourcePath'] as const

describe('panelImage', () => {
    it('画像を外すと漫画化・はみ出しの派生画像も外れる（次の画像で古い絵が復活しない）', () => {
        const after = { ...derived, ...clearPanelImage() }
        expect(after.imagePath).toBeUndefined()
        for (const k of DERIVED_KEYS) expect(after[k]).toBeUndefined()
    })

    it('外したあとに新しい画像を入れると、新しい画像が表示対象になる', () => {
        const cleared = { ...derived, ...clearPanelImage() }
        const after = { ...cleared, ...setPanelImage({ width: 200, height: 100 }, 'assets/images/new.png') }
        expect(after.imagePath).toBe('assets/images/new.png')
        expect(after.isManga).toBeUndefined()
        expect(after).toMatchObject({ imageX: 100, imageY: 50, imageScale: 1, imageRotation: 0, imageFlipX: false })
    })

    it('外さずに差し替えても派生画像は外れる', () => {
        const after = { ...derived, ...setPanelImage({ width: 10, height: 10 }, 'n.png', { imageScale: undefined }) }
        for (const k of DERIVED_KEYS) expect(after[k]).toBeUndefined()
        expect(after.imageScale).toBeUndefined()
    })
})
