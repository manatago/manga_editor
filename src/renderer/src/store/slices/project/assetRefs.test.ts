import { describe, it, expect } from 'vitest'
import { collectReferencedAssetPaths, isProtectedAssetDir } from './assetRefs'
import type { Page, Panel } from '../../types'

const ROOT = '/Users/me/proj'

const panel = (overrides: Partial<Panel>): Panel =>
    ({ id: 'a', type: 'rect', x: 0, y: 0, width: 1, height: 1, slant: 0, offsetB: 0, offsetC: 0, offsetD: 0, strokeWidth: 1, strokeColor: '#000', ...overrides }) as Panel

const page = (panels: Panel[], overrides: Partial<Page> = {}): Page => ({ id: 'p', name: '001', panels, bubbles: [], materials: [], ...overrides })

describe('collectReferencedAssetPaths（Assets整理で保護する参照）', () => {
    it('コマが参照するすべての画像を集める（はみ出し・漫画化・トーン・NovelAI 履歴・精密参照を含む）', () => {
        const refs = collectReferencedAssetPaths(ROOT, {
            pages: [
                page([
                    panel({
                        imagePath: 'assets/images/main.png',
                        protrudeImagePath: 'assets/images/people.png',
                        mangaImagePath: 'assets/manga/m.png',
                        mangaProtrudePath: 'assets/manga/mp.png',
                        backgroundImagePath: `${ROOT}/assets/images/bg.png`,
                        fgTonePath: 'assets/images/tone.png',
                        novelai: {
                            history: [{ relativePath: 'assets/images/novelai/a/1.png', seed: 1, createdAt: 0 }],
                            preciseRefs: [
                                { source: 'composite', id: 'assets/composites/c.png', strength: 1, fidelity: 1, type: 'character' },
                                { source: 'character-image', id: 'char/img', strength: 1, fidelity: 1, type: 'character' }
                            ]
                        }
                    } as Partial<Panel>)
                ])
            ]
        })
        expect([...refs].sort()).toEqual(
            [
                'assets/composites/c.png',
                'assets/images/bg.png',
                'assets/images/main.png',
                'assets/images/novelai/a/1.png',
                'assets/images/people.png',
                'assets/images/tone.png',
                'assets/manga/m.png',
                'assets/manga/mp.png'
            ].sort()
        )
    })

    it('素材・ページ背景・保管ページ・参照キャラ・背景ライブラリも集める', () => {
        const refs = collectReferencedAssetPaths(ROOT, {
            pages: [page([], { backgroundImagePath: 'assets/images/page_bg.png', materials: [{ id: 'm', imagePath: 'assets/images/mat.png' } as Page['materials'][number]] })],
            archivedPages: [page([panel({ imagePath: 'assets/images/archived.png' })])],
            referenceCharacters: [{ id: 'c', name: 'A', positivePrompt: '', negativePrompt: '', images: [{ id: 'i', relativePath: 'assets/references/characters/c/i.png', addedAt: '' }] }],
            backgroundLibrary: [{ id: 'b', name: 'B', relativePath: 'assets/reference/backgrounds/b.png', addedAt: '' }]
        })
        for (const p of [
            'assets/images/page_bg.png',
            'assets/images/mat.png',
            'assets/images/archived.png',
            'assets/references/characters/c/i.png',
            'assets/reference/backgrounds/b.png'
        ]) {
            expect(refs.has(p), p).toBe(true)
        }
    })

    it('builtin:// や custom-tone:// は参照に含めない', () => {
        const refs = collectReferencedAssetPaths(ROOT, {
            pages: [page([panel({ backgroundImagePath: 'builtin://dots', fgTonePath: 'custom-tone://t' })], { backgroundImagePath: 'builtin://x' })]
        })
        expect(refs.size).toBe(0)
    })
})

describe('isProtectedAssetDir', () => {
    it('合成画像フォルダは参照がなくても整理対象外', () => {
        expect(isProtectedAssetDir('assets/composites/20260101_0.png')).toBe(true)
        expect(isProtectedAssetDir('assets\\composites\\x.png')).toBe(true)
        expect(isProtectedAssetDir('assets/images/x.png')).toBe(false)
    })
})
