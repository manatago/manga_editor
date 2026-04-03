import { describe, expect, it, vi, afterEach } from 'vitest'
import {
    assertTemplateForSave,
    assertTemplateHasPersistableId,
    parseSaveProjectPayload,
    parseSaveProjectSyncPayload
} from './ipcGuards'

describe('parseSaveProjectPayload', () => {
    it('returns path and data on success', () => {
        const out = parseSaveProjectPayload({
            path: '  /tmp/proj  ',
            data: { pages: [] }
        })
        expect(out.path).toBe('/tmp/proj')
        expect(out.data).toEqual({ pages: [] })
    })

    it('throws when payload is not a plain object', () => {
        expect(() => parseSaveProjectPayload(null)).toThrow('オブジェクトではありません')
        expect(() => parseSaveProjectPayload([])).toThrow('オブジェクトではありません')
        expect(() => parseSaveProjectPayload('x')).toThrow('オブジェクトではありません')
    })

    it('throws when path is empty', () => {
        expect(() => parseSaveProjectPayload({ path: '   ', data: {} })).toThrow('path が空')
        expect(() => parseSaveProjectPayload({ data: {} })).toThrow('path が空')
    })

    it('throws when data key is missing', () => {
        expect(() => parseSaveProjectPayload({ path: '/p' } as unknown)).toThrow('data がありません')
    })

    it('throws when data is not a non-array object', () => {
        expect(() => parseSaveProjectPayload({ path: '/p', data: null })).toThrow(
            'オブジェクトである必要があります'
        )
        expect(() => parseSaveProjectPayload({ path: '/p', data: [] })).toThrow(
            'オブジェクトである必要があります'
        )
        expect(() => parseSaveProjectPayload({ path: '/p', data: 's' })).toThrow(
            'オブジェクトである必要があります'
        )
    })
})

describe('parseSaveProjectSyncPayload', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('returns null and logs on invalid payload', () => {
        const err = vi.spyOn(console, 'error').mockImplementation(() => {})
        expect(parseSaveProjectSyncPayload({ path: '', data: {} })).toBeNull()
        expect(err).toHaveBeenCalled()
    })

    it('returns parsed result when valid', () => {
        const out = parseSaveProjectSyncPayload({ path: '/ok', data: { a: 1 } })
        expect(out).toEqual({ path: '/ok', data: { a: 1 } })
    })
})

describe('assertTemplateForSave', () => {
    const valid = { name: 'T', panels: [] as unknown[] }

    it('returns template on success without id', () => {
        expect(assertTemplateForSave(valid)).toBe(valid)
    })

    it('returns template when id is a non-empty string', () => {
        const t = { ...valid, id: 'abc' }
        expect(assertTemplateForSave(t)).toBe(t)
    })

    it('throws when template is not an object', () => {
        expect(() => assertTemplateForSave(null)).toThrow('オブジェクトではありません')
    })

    it('throws when name is not a string', () => {
        expect(() => assertTemplateForSave({ name: 1, panels: [] })).toThrow('name が文字列ではありません')
    })

    it('throws when panels is not an array', () => {
        expect(() => assertTemplateForSave({ name: 'x', panels: {} })).toThrow(
            'panels が配列ではありません'
        )
    })

    it('throws when id is present but empty string', () => {
        expect(() => assertTemplateForSave({ ...valid, id: '' })).toThrow('id が不正')
    })

    it('throws when id is only whitespace', () => {
        expect(() => assertTemplateForSave({ ...valid, id: '   ' })).toThrow('id が不正')
    })

    it('throws when id is not a string', () => {
        expect(() => assertTemplateForSave({ ...valid, id: 1 })).toThrow('id が不正')
    })
})

describe('assertTemplateHasPersistableId', () => {
    it('throws when id missing or empty', () => {
        expect(() => assertTemplateHasPersistableId({ name: 'x' })).toThrow('id がありません')
        expect(() => assertTemplateHasPersistableId({ id: '' })).toThrow('id がありません')
        expect(() => assertTemplateHasPersistableId({ id: 0 as unknown as string })).toThrow()
    })

    it('does not throw when id is non-empty string', () => {
        expect(() => assertTemplateHasPersistableId({ id: 'z1' })).not.toThrow()
    })
})
