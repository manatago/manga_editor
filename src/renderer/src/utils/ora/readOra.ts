// OpenRaster (.ora) を読む。gousei（../gousei）が書いたシーンを想定する（docs/FORMAT.md と同じ形）。
// DOM に触らない純粋関数だけを置く（zip は fflate）。
//
// - stack.xml: レイヤーの並び（先頭が上）・位置・不透明度・表示
// - gousei/meta.json: レイヤーの役割（bg / tone-back / fx-back / shadow / person / object / fx-front / tone-front）と倍率
//   （gousei は人物を元の解像度のまま入れ、倍率を別に持つ。.ora の規格に倍率は無い）
// - mergedimage.png: 全部を重ねた原寸の絵

import { strFromU8, unzipSync } from 'fflate'

export type OraRole = 'bg' | 'tone-back' | 'fx-back' | 'shadow' | 'person' | 'object' | 'fx-front' | 'tone-front'

export interface OraLayer {
    name: string
    src: string
    x: number
    y: number
    opacity: number
    visible: boolean
    /** gousei の役割（ほかのツールの .ora なら undefined） */
    role?: OraRole
    /** 倍率（gousei の人物・前面物。無ければ 1） */
    scale: number
    png: Uint8Array
}

export interface OraFile {
    width: number
    height: number
    /** 先頭が上 */
    layers: OraLayer[]
    merged?: Uint8Array
    /** gousei が書いたファイルか（meta.json がある） */
    fromGousei: boolean
}

const attr = (tag: string, name: string): string | undefined => {
    const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`))
    return m ? m[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&') : undefined
}

export function readOra(bytes: Uint8Array): OraFile {
    const files = unzipSync(bytes)
    const stack = files['stack.xml']
    if (!stack) throw new Error('.ora ではありません（stack.xml がありません）')
    const xml = strFromU8(stack)
    const image = xml.match(/<image\b[^>]*>/)?.[0] ?? ''
    const width = Number(attr(image, 'w') ?? 0)
    const height = Number(attr(image, 'h') ?? 0)
    if (!(width > 0 && height > 0)) throw new Error('.ora の大きさが読めません')

    type Meta = { layers?: { src: string; role?: OraRole; scale?: number }[] }
    let meta: Meta | null = null
    if (files['gousei/meta.json']) {
        try { meta = JSON.parse(strFromU8(files['gousei/meta.json'])) as Meta } catch { meta = null }
    }
    const metaBySrc = new Map((meta?.layers ?? []).map(l => [l.src, l]))

    const layers: OraLayer[] = []
    for (const tag of xml.match(/<layer\b[^>]*>/g) ?? []) {
        const src = attr(tag, 'src')
        if (!src || !files[src]) continue
        const m = metaBySrc.get(src)
        layers.push({
            name: attr(tag, 'name') ?? src,
            src,
            x: Number(attr(tag, 'x') ?? 0),
            y: Number(attr(tag, 'y') ?? 0),
            opacity: attr(tag, 'opacity') !== undefined ? Number(attr(tag, 'opacity')) : 1,
            visible: attr(tag, 'visibility') !== 'hidden',
            role: m?.role,
            scale: m?.scale ?? 1,
            png: files[src]
        })
    }
    return { width, height, layers, merged: files['mergedimage.png'], fromGousei: !!meta }
}

/** はみ出させるレイヤー（人物・前面物） */
export const isProtrudeRole = (r: OraRole | undefined): boolean => r === 'person' || r === 'object'
