import { describe, it, expect } from 'vitest'
import { canvasZoomCommandFor } from './canvasZoomKeys'

const key = (k: string, mods: Partial<{ meta: boolean; control: boolean; alt: boolean }> = {}, type = 'keyDown') => ({
    type,
    key: k,
    meta: false,
    control: false,
    alt: false,
    ...mods
})

describe('canvasZoomCommandFor', () => {
    it('mac: Cmd + = / + / - / 0 / 1', () => {
        expect(canvasZoomCommandFor(key('=', { meta: true }), 'darwin')).toBe('in')
        expect(canvasZoomCommandFor(key('+', { meta: true }), 'darwin')).toBe('in')
        expect(canvasZoomCommandFor(key(';', { meta: true }), 'darwin')).toBe('in')
        expect(canvasZoomCommandFor(key('-', { meta: true }), 'darwin')).toBe('out')
        expect(canvasZoomCommandFor(key('0', { meta: true }), 'darwin')).toBe('fit')
        expect(canvasZoomCommandFor(key('1', { meta: true }), 'darwin')).toBe('actual')
    })

    it('Windows: Ctrl を使う（mac の Ctrl、Windows の Win キーは対象外）', () => {
        expect(canvasZoomCommandFor(key('=', { control: true }), 'win32')).toBe('in')
        expect(canvasZoomCommandFor(key('=', { control: true }), 'darwin')).toBeNull()
        expect(canvasZoomCommandFor(key('=', { meta: true }), 'win32')).toBeNull()
    })

    it('修飾キーなし・Alt 併用・keyUp・他のキーは対象外', () => {
        expect(canvasZoomCommandFor(key('='), 'darwin')).toBeNull()
        expect(canvasZoomCommandFor(key('=', { meta: true, alt: true }), 'darwin')).toBeNull()
        expect(canvasZoomCommandFor(key('=', { meta: true }, 'keyUp'), 'darwin')).toBeNull()
        expect(canvasZoomCommandFor(key('z', { meta: true }), 'darwin')).toBeNull()
    })
})
