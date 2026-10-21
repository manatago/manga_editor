// @vitest-environment node
// （jsdom だと Uint8Array が別の realm になり、fflate がファイルをフォルダと取り違える。本番の画面では起きない）
import { describe, expect, it } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import { isProtrudeRole, readOra } from './readOra'

const png = (n: number) => new Uint8Array([137, 80, 78, 71, n])

function makeOra(withMeta: boolean): Uint8Array {
    const stack = `<?xml version="1.0" encoding="UTF-8"?>
<image version="0.0.5" w="768" h="1024"><stack>
<layer name="人物 &amp; 影" src="data/person-1.png" x="120" y="300" opacity="1" />
<layer name="背景" src="data/bg.png" x="0" y="0" opacity="0.8" visibility="hidden" />
</stack></image>`
    const files: Record<string, Uint8Array> = {
        mimetype: strToU8('image/openraster'),
        'stack.xml': strToU8(stack),
        'data/person-1.png': png(1),
        'data/bg.png': png(2),
        'mergedimage.png': png(9)
    }
    if (withMeta) files['gousei/meta.json'] = strToU8(JSON.stringify({ layers: [{ src: 'data/person-1.png', role: 'person', scale: 0.5 }, { src: 'data/bg.png', role: 'bg' }] }))
    return zipSync(files)
}

describe('.ora を読む', () => {
    it('gousei の .ora: 大きさ・並び（先頭が上）・位置・不透明度・表示・役割・倍率', () => {
        const o = readOra(makeOra(true))
        expect(o.width).toBe(768)
        expect(o.height).toBe(1024)
        expect(o.fromGousei).toBe(true)
        expect(o.layers.map(l => l.role)).toEqual(['person', 'bg'])
        expect(o.layers[0]).toMatchObject({ name: '人物 & 影', x: 120, y: 300, scale: 0.5, visible: true })
        expect(o.layers[1]).toMatchObject({ opacity: 0.8, visible: false, scale: 1 })
        expect(o.merged?.[4]).toBe(9)
        expect(isProtrudeRole(o.layers[0].role)).toBe(true)
        expect(isProtrudeRole(o.layers[1].role)).toBe(false)
    })
    it('ほかのツールの .ora（meta.json 無し）は役割なし', () => {
        const o = readOra(makeOra(false))
        expect(o.fromGousei).toBe(false)
        expect(o.layers.every(l => l.role === undefined)).toBe(true)
    })
    it('.ora でないものは断る', () => {
        expect(() => readOra(zipSync({ 'a.txt': strToU8('x') }))).toThrow()
    })
})
