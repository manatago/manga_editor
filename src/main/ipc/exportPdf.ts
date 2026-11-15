import { ipcMain, nativeImage } from 'electron'
import * as fs from 'fs'
import * as pathModule from 'path'
import { randomUUID } from 'crypto'
import { bitmapToRgb, buildPdf, flateRgbPage, jpegSize, pxToPt, type PdfImagePage } from '../pdf/pdfWriter'

/**
 * 全ページ PDF 書き出し。レンダラーがページを 1 枚ずつ送り（大きな画像を一度に IPC しないため）、
 * 最後に finish で PDF を組み立てて <project>/exports/<作品フォルダ名>.pdf に保存する。
 */
const sessions = new Map<string, { projectPath: string; pages: PdfImagePage[]; createdAt: number }>()

/** finish/cancel されずに放置されたセッション（ウィンドウを閉じた等）を掃除してメモリを解放する */
const SESSION_TTL_MS = 30 * 60 * 1000
const pruneStaleSessions = (): void => {
    const now = Date.now()
    for (const [id, s] of sessions) {
        if (now - s.createdAt > SESSION_TTL_MS) sessions.delete(id)
    }
}

const decodeDataUrl = (dataUrl: string): { mime: string; buf: Buffer } => {
    const m = /^data:(image\/[a-z+]+);base64,/.exec(dataUrl)
    if (!m) throw new Error('invalid data URL')
    return { mime: m[1], buf: Buffer.from(dataUrl.slice(m[0].length), 'base64') }
}

const safeFileName = (name: string): string => name.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').trim() || 'manga'

export function registerExportPdfHandlers(): void {
    ipcMain.handle('export-pdf-begin', (_, { projectPath }: { projectPath: string }) => {
        pruneStaleSessions()
        const id = randomUUID()
        sessions.set(id, { projectPath: String(projectPath ?? '').trim(), pages: [], createdAt: Date.now() })
        return id
    })

    ipcMain.handle(
        'export-pdf-add-page',
        (_, { sessionId, data, pageWidthPx, pageHeightPx }: { sessionId: string; data: string; pageWidthPx: number; pageHeightPx: number }) => {
            const s = sessions.get(sessionId)
            if (!s) throw new Error('unknown PDF session')
            const { mime, buf } = decodeDataUrl(data)
            const wPt = pxToPt(pageWidthPx)
            const hPt = pxToPt(pageHeightPx)
            const jpeg = mime === 'image/jpeg' ? jpegSize(buf) : null
            if (jpeg && jpeg.components === 3) {
                // 通常のカラー JPEG は再圧縮せずそのまま埋め込む（DeviceRGB で正しく表示できる）
                s.pages.push({ data: buf, filter: 'DCTDecode', pixelWidth: jpeg.width, pixelHeight: jpeg.height, pageWidthPt: wPt, pageHeightPt: hPt })
            } else {
                // PNG、またはグレースケール/CMYK JPEG。画素に戻して可逆圧縮し RGB 化する
                // （PDF の画像は透過を持てないので白地に合成。DeviceRGB 固定でも破損しない）
                const img = nativeImage.createFromBuffer(buf)
                const { width, height } = img.getSize()
                if (!width || !height) throw new Error('failed to decode page image')
                const rgb = bitmapToRgb(img.toBitmap(), width, height, 'bgra')
                s.pages.push(flateRgbPage(rgb, width, height, wPt, hPt))
            }
            return s.pages.length
        }
    )

    ipcMain.handle('export-pdf-finish', (_, { sessionId }: { sessionId: string }) => {
        const s = sessions.get(sessionId)
        sessions.delete(sessionId)
        if (!s) throw new Error('unknown PDF session')
        const title = pathModule.basename(s.projectPath)
        const exportDir = pathModule.join(s.projectPath, 'exports')
        fs.mkdirSync(exportDir, { recursive: true })
        const filePath = pathModule.join(exportDir, `${safeFileName(title)}.pdf`)
        fs.writeFileSync(filePath, buildPdf(s.pages, { title }))
        console.log('Main: PDF exported to', filePath, `(${s.pages.length} pages)`)
        return filePath
    })

    ipcMain.handle('export-pdf-cancel', (_, { sessionId }: { sessionId: string }) => {
        sessions.delete(sessionId)
    })
}
