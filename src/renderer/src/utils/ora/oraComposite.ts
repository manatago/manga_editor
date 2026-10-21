// .ora からコマに使う 2 枚の絵を作る（画面側。OffscreenCanvas を使う）。
//
// - 全体の絵: 全部を重ねた原寸の絵（mergedimage.png。無ければ重ね直す）。コマの形でクリップして敷く
// - はみ出し用: 人物・前面物だけを重ねた絵（同じ大きさ。ほかは透明）。コマの外の、許した辺の側だけに描く
// 2 枚は同じ大きさなので、コマの画像と同じ位置・倍率で重ねればぴったり合う（PanelProtrudeImage）

import { isProtrudeRole, type OraFile, type OraLayer } from './readOra'

async function bitmap(png: Uint8Array): Promise<ImageBitmap> {
    return createImageBitmap(new Blob([png as BlobPart], { type: 'image/png' }))
}

/** 下から順に重ねる（`pick` で選んだレイヤーだけ。隠したレイヤーは描かない） */
async function compose(ora: OraFile, pick: (l: OraLayer) => boolean): Promise<OffscreenCanvas> {
    const c = new OffscreenCanvas(ora.width, ora.height)
    const ctx = c.getContext('2d')!
    for (const l of [...ora.layers].reverse()) {
        if (!l.visible || !pick(l)) continue
        const b = await bitmap(l.png)
        ctx.globalAlpha = l.opacity
        ctx.drawImage(b, l.x, l.y, b.width * l.scale, b.height * l.scale)
        ctx.globalAlpha = 1
        b.close()
    }
    return c
}

async function toDataUrl(c: OffscreenCanvas): Promise<string> {
    const blob = await c.convertToBlob({ type: 'image/png' })
    return new Promise((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result))
        r.onerror = () => reject(r.error)
        r.readAsDataURL(blob)
    })
}

export interface OraImages {
    width: number
    height: number
    /** 全体の絵（data URL） */
    full: string
    /** 人物・前面物だけ（data URL）。gousei のシーンでなく役割が分からないときは null */
    protrude: string | null
    /** 人物・前面物の数 */
    figures: number
}

export async function oraImages(ora: OraFile): Promise<OraImages> {
    const full = ora.merged
        ? await (async () => { const b = await bitmap(ora.merged!); const c = new OffscreenCanvas(ora.width, ora.height); c.getContext('2d')!.drawImage(b, 0, 0); b.close(); return c })()
        : await compose(ora, () => true)
    const figures = ora.layers.filter(l => l.visible && isProtrudeRole(l.role)).length
    const protrude = figures ? await compose(ora, l => isProtrudeRole(l.role)) : null
    return { width: ora.width, height: ora.height, full: await toDataUrl(full), protrude: protrude ? await toDataUrl(protrude) : null, figures }
}
