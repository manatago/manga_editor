import * as fs from 'fs'
import { ipcMain, dialog, BrowserWindow } from 'electron'

export function registerDialogHandlers(): void {
    ipcMain.handle('select-file', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [
                { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }
            ],
            title: '画像を選択してください'
        })
        if (canceled) return null
        return filePaths[0]
    })

    ipcMain.handle('select-ora-file', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [{ name: 'gousei のシーン（OpenRaster）', extensions: ['ora'] }],
            title: 'gousei のシーン（.ora）を選択してください'
        })
        if (canceled) return null
        return filePaths[0]
    })

    // gousei のシーン（.ora）の中身を読む。画面側は CSP（default-src 'self'）で local-file:// を fetch できないので、
    // ここで読んで渡す。読めるのは .ora だけ
    ipcMain.handle('read-ora-file', async (_e, filePath: string) => {
        const p = String(filePath ?? '')
        if (!/\.ora$/i.test(p)) throw new Error('.ora のファイルだけ読めます')
        const buf = await fs.promises.readFile(p)
        return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
    })

    ipcMain.handle('select-folder', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog({
            properties: ['openDirectory'],
            title: 'プロジェクトを保存するフォルダを選択してください'
        })
        if (canceled) return null
        return filePaths[0]
    })

    ipcMain.handle('show-message', async (_, payload: { title?: string; message: string; type?: 'none' | 'info' | 'error' | 'warning' }) => {
        const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
        await dialog.showMessageBox(win ?? undefined, {
            type: payload?.type ?? 'info',
            title: payload?.title ?? 'お知らせ',
            message: payload?.message ?? ''
        })
        return true
    })

    ipcMain.handle('confirm-message', async (_, payload: { title?: string; message: string }) => {
        const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
        const result = await dialog.showMessageBox(win ?? undefined, {
            type: 'question',
            title: payload?.title ?? '確認',
            message: payload?.message ?? '',
            buttons: ['キャンセル', 'OK'],
            defaultId: 1,
            cancelId: 0
        })
        return result.response === 1
    })
}
