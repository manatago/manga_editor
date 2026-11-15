import { describe, it, expect } from 'vitest'
import * as zlib from 'zlib'
import { buildPdf, bitmapToRgb, flateRgbPage, jpegSize, pxToPt, type PdfImagePage } from './pdfWriter'

/** 最小の JPEG ヘッダ（SOI + APP0 + SOF0）。サイズ読み取りのテスト用。comp=成分数(3=カラー) */
const fakeJpeg = (w: number, h: number, comp = 3): Buffer =>
    Buffer.from([
        0xff, 0xd8,
        0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
        0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 0xff, w >> 8, w & 0xff, comp, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
        0xff, 0xd9
    ])

const page = (over: Partial<PdfImagePage> = {}): PdfImagePage => ({
    data: Buffer.from([1, 2, 3]),
    filter: 'DCTDecode',
    pixelWidth: 1680,
    pixelHeight: 2376,
    pageWidthPt: 630,
    pageHeightPt: 891,
    ...over
})

describe('bitmapToRgb', () => {
    it('BGRA を RGB に並べ替える', () => {
        const bgra = Buffer.from([10, 20, 30, 255, 1, 2, 3, 255])
        expect([...bitmapToRgb(bgra, 2, 1)]).toEqual([30, 20, 10, 3, 2, 1])
    })
    it('RGBA も扱える', () => {
        expect([...bitmapToRgb(Buffer.from([10, 20, 30, 255]), 1, 1, 'rgba')]).toEqual([10, 20, 30])
    })
    it('透過部分は白地に合成する', () => {
        expect([...bitmapToRgb(Buffer.from([0, 0, 0, 0]), 1, 1)]).toEqual([255, 255, 255])
        expect([...bitmapToRgb(Buffer.from([0, 0, 0, 128]), 1, 1)]).toEqual([127, 127, 127])
    })
    it('サイズが足りないバッファはエラー', () => {
        expect(() => bitmapToRgb(Buffer.alloc(4), 2, 1)).toThrow()
    })
})

describe('jpegSize / pxToPt', () => {
    it('SOF から幅・高さ・成分数を読む', () => {
        expect(jpegSize(fakeJpeg(1680, 2376))).toEqual({ width: 1680, height: 2376, components: 3 })
    })
    it('グレースケール/CMYK JPEG の成分数を見分ける（DeviceRGB 埋め込みの可否判定用）', () => {
        expect(jpegSize(fakeJpeg(100, 100, 1)).components).toBe(1)
        expect(jpegSize(fakeJpeg(100, 100, 4)).components).toBe(4)
    })
    it('JPEG でなければエラー', () => {
        expect(() => jpegSize(Buffer.from([0x89, 0x50]))).toThrow()
    })
    it('96dpi の px を 72dpi の pt にする', () => {
        expect(pxToPt(840)).toBe(630)
        expect(pxToPt(1188)).toBe(891)
    })
})

describe('buildPdf', () => {
    it('ページ数・用紙サイズ・画像の情報が入り、xref のオフセットが各オブジェクトを指す', () => {
        const pdf = buildPdf([page(), page({ filter: 'FlateDecode', pageWidthPt: 810, pageHeightPt: 1440 })], { title: '漫画テスト' })
        const text = pdf.toString('latin1')
        expect(text.startsWith('%PDF-1.4')).toBe(true)
        expect(text.trimEnd().endsWith('%%EOF')).toBe(true)
        expect(text).toContain('/Count 2')
        expect(text).toContain('/MediaBox [0 0 630 891]')
        expect(text).toContain('/MediaBox [0 0 810 1440]')
        expect(text).toContain('/Filter /DCTDecode')
        expect(text).toContain('/Filter /FlateDecode')
        expect(text).toContain('/Width 1680 /Height 2376')

        const startxref = Number(text.match(/startxref\n(\d+)/)![1])
        expect(text.slice(startxref, startxref + 4)).toBe('xref')
        const entries = text.slice(startxref).split('\n').slice(3).filter((l) => / n $/.test(l))
        expect(entries).toHaveLength(3 + 2 * 3)
        entries.forEach((line, i) => {
            const off = Number(line.slice(0, 10))
            expect(text.slice(off, off + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`)
        })
    })

    it('タイトルは UTF-16BE で入る（日本語が文字化けしない）', () => {
        const text = buildPdf([page()], { title: '漫画' }).toString('latin1')
        expect(text).toContain('/Title <FEFF6F2B753B>')
    })

    it('ストリームの /Length が実際のバイト数と一致する', () => {
        const data = Buffer.alloc(1000, 7)
        const text = buildPdf([page({ data })]).toString('latin1')
        expect(text).toContain('/Length 1000 >>')
    })

    it('flateRgbPage は可逆圧縮（展開すると元に戻る）', () => {
        const rgb = Buffer.from(Array.from({ length: 300 }, (_, i) => i % 256))
        const p = flateRgbPage(rgb, 10, 10, 7.5, 7.5)
        expect(zlib.inflateSync(p.data).equals(rgb)).toBe(true)
        expect(p.filter).toBe('FlateDecode')
    })

    it('ページがなければエラー', () => {
        expect(() => buildPdf([])).toThrow()
    })
})
