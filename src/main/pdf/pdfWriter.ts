import * as zlib from 'zlib'

/**
 * 依存ライブラリなしの最小 PDF 生成（1 ページ = 1 枚の画像）。
 * - JPEG はそのまま DCTDecode で埋め込む（再圧縮しない）
 * - 生の RGB は zlib で可逆圧縮して FlateDecode で埋め込む（線画・トーンが劣化しない）
 */

export interface PdfImagePage {
    /** 画像ストリーム本体（JPEG のバイト列、または deflate 済みの RGB） */
    data: Buffer
    filter: 'DCTDecode' | 'FlateDecode'
    /** 画像の画素数 */
    pixelWidth: number
    pixelHeight: number
    /** 用紙サイズ（pt = 1/72 inch） */
    pageWidthPt: number
    pageHeightPt: number
}

/** CSS px（96dpi）→ PDF pt（72dpi） */
export const pxToPt = (px: number): number => Math.round(px * 0.75 * 100) / 100

/** 不透明 BGRA/RGBA ではない画像も白地に合成して RGB にする（nativeImage.toBitmap() は BGRA） */
export function bitmapToRgb(bitmap: Buffer, width: number, height: number, order: 'bgra' | 'rgba' = 'bgra'): Buffer {
    const n = width * height
    if (bitmap.length < n * 4) throw new Error(`bitmap too small: ${bitmap.length} < ${n * 4}`)
    const out = Buffer.allocUnsafe(n * 3)
    const [ri, bi] = order === 'bgra' ? [2, 0] : [0, 2]
    for (let i = 0, j = 0; i < n; i++, j += 3) {
        const o = i * 4
        const a = bitmap[o + 3]
        if (a === 255) {
            out[j] = bitmap[o + ri]
            out[j + 1] = bitmap[o + 1]
            out[j + 2] = bitmap[o + bi]
        } else {
            // 白地に合成: c * a + 255 * (1 - a)
            const inv = 255 - a
            out[j] = Math.round((bitmap[o + ri] * a + 255 * inv) / 255)
            out[j + 1] = Math.round((bitmap[o + 1] * a + 255 * inv) / 255)
            out[j + 2] = Math.round((bitmap[o + bi] * a + 255 * inv) / 255)
        }
    }
    return out
}

export const flateRgbPage = (
    rgb: Buffer,
    pixelWidth: number,
    pixelHeight: number,
    pageWidthPt: number,
    pageHeightPt: number
): PdfImagePage => ({
    data: zlib.deflateSync(rgb, { level: 6 }),
    filter: 'FlateDecode',
    pixelWidth,
    pixelHeight,
    pageWidthPt,
    pageHeightPt
})

/**
 * JPEG の SOF マーカーから画素サイズと成分数を読む。
 * components=3 が通常のカラー（YCbCr→PDF では DeviceRGB 扱いでよい）。
 * 1=グレースケール, 4=CMYK は DeviceRGB 固定だと破損表示になるため、呼び出し側で再デコード経路に回す。
 */
export function jpegSize(jpeg: Buffer): { width: number; height: number; components: number } {
    if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new Error('not a JPEG')
    let i = 2
    while (i + 9 < jpeg.length) {
        if (jpeg[i] !== 0xff) {
            i++
            continue
        }
        const marker = jpeg[i + 1]
        const len = jpeg.readUInt16BE(i + 2)
        // SOF0..SOF15（DHT=C4, JPG=C8, DAC=CC を除く）
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
            // SOF: len(2) precision(1) height(2) width(2) components(1)
            return { height: jpeg.readUInt16BE(i + 5), width: jpeg.readUInt16BE(i + 7), components: jpeg[i + 9] }
        }
        i += 2 + len
    }
    throw new Error('JPEG size not found')
}

/** PDF の文字列（日本語可）: UTF-16BE の16進文字列 */
const pdfTextString = (s: string): string => {
    const hex = ['FEFF']
    for (const ch of s) {
        const cp = ch.codePointAt(0)!
        if (cp > 0xffff) {
            const v = cp - 0x10000
            hex.push(((0xd800 + (v >> 10)) & 0xffff).toString(16).padStart(4, '0'))
            hex.push(((0xdc00 + (v & 0x3ff)) & 0xffff).toString(16).padStart(4, '0'))
        } else {
            hex.push(cp.toString(16).padStart(4, '0'))
        }
    }
    return `<${hex.join('').toUpperCase()}>`
}

export function buildPdf(pages: PdfImagePage[], meta: { title?: string } = {}): Buffer {
    if (pages.length === 0) throw new Error('no pages')
    const chunks: Buffer[] = []
    const offsets: number[] = [] // index = オブジェクト番号
    let pos = 0
    const write = (b: Buffer | string): void => {
        const buf = typeof b === 'string' ? Buffer.from(b, 'latin1') : b
        chunks.push(buf)
        pos += buf.length
    }
    const obj = (num: number, body: string, stream?: Buffer): void => {
        offsets[num] = pos
        write(`${num} 0 obj\n${body}\n`)
        if (stream) {
            write('stream\n')
            write(stream)
            write('\nendstream\n')
        }
        write('endobj\n')
    }

    // 1: Catalog, 2: Pages, 3: Info, 以降ページごとに Page / Contents / Image の 3 つ
    const pageObj = (i: number): number => 4 + i * 3
    write('%PDF-1.4\n')
    write(Buffer.from([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])) // バイナリを含むことを示すコメント

    obj(1, '<< /Type /Catalog /Pages 2 0 R >>')
    obj(2, `<< /Type /Pages /Kids [${pages.map((_, i) => `${pageObj(i)} 0 R`).join(' ')}] /Count ${pages.length} >>`)
    obj(3, `<< /Producer (manga-yarou)${meta.title ? ` /Title ${pdfTextString(meta.title)}` : ''} >>`)

    pages.forEach((p, i) => {
        const [pageNum, contentNum, imageNum] = [pageObj(i), pageObj(i) + 1, pageObj(i) + 2]
        const w = p.pageWidthPt
        const h = p.pageHeightPt
        obj(
            pageNum,
            `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${imageNum} 0 R >> >> /Contents ${contentNum} 0 R >>`
        )
        const content = Buffer.from(`q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`, 'latin1')
        obj(contentNum, `<< /Length ${content.length} >>`, content)
        obj(
            imageNum,
            `<< /Type /XObject /Subtype /Image /Width ${p.pixelWidth} /Height ${p.pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /${p.filter} /Length ${p.data.length} >>`,
            p.data
        )
    })

    const size = 4 + pages.length * 3
    const xrefPos = pos
    write(`xref\n0 ${size}\n0000000000 65535 f \n`)
    for (let n = 1; n < size; n++) write(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`)
    write(`trailer\n<< /Size ${size} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`)
    return Buffer.concat(chunks)
}
