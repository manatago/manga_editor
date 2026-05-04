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
