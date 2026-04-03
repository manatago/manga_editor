import { describe, expect, it } from 'vitest'
import { normalizeReferenceCharacters, referenceAssetsSubdir } from './referenceCharacters'

describe('normalizeReferenceCharacters', () => {
    it('returns empty for non-array', () => {
        expect(normalizeReferenceCharacters(null)).toEqual([])
        expect(normalizeReferenceCharacters({})).toEqual([])
    })

    it('normalizes valid entries', () => {
        const out = normalizeReferenceCharacters([
            {
                id: 'a1',
                name: 'Test',
                positivePrompt: 'p',
                negativePrompt: 'n',
                images: [{ id: 'i1', relativePath: 'assets/x.png', addedAt: '2020-01-01' }]
            }
        ])
        expect(out).toHaveLength(1)
        expect(out[0].id).toBe('a1')
        expect(out[0].images[0].relativePath).toBe('assets/x.png')
    })
})

describe('referenceAssetsSubdir', () => {
    it('sanitizes character id segment', () => {
        expect(referenceAssetsSubdir('abc-12')).toBe('reference/characters/abc-12')
        expect(referenceAssetsSubdir('../../evil')).toBe('reference/characters/evil')
    })
})
