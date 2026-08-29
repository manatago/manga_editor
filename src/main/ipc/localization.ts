import { ipcMain, dialog, BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as fsp from 'fs/promises'
import * as pathModule from 'path'

function focusedWindow(): BrowserWindow | undefined {
    return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
}

/** フォルダ名として安全か（区切り文字・.. を含まない、空でない） */
function isSafeFolderName(name: string): boolean {
    if (!name || !name.trim()) return false
    if (name.includes('/') || name.includes('\\')) return false
    if (name === '.' || name === '..' || name.includes('..')) return false
    return true
}

export function registerLocalizationHandlers(): void {
    // 翻訳シート(JSON)を保存ダイアログで書き出す
    ipcMain.handle('export-translation-sheet', async (_, payload: unknown) => {
        const p = (payload ?? {}) as { defaultName?: unknown; content?: unknown }
        const defaultName = typeof p.defaultName === 'string' ? p.defaultName : 'translation-sheet.json'
        const content = typeof p.content === 'string' ? p.content : ''
        const win = focusedWindow()
        const saveOpts = {
            title: '翻訳シートの保存先',
            defaultPath: defaultName,
            filters: [{ name: 'JSON', extensions: ['json'] }]
        }
        const { canceled, filePath } = win
            ? await dialog.showSaveDialog(win, saveOpts)
            : await dialog.showSaveDialog(saveOpts)
        if (canceled || !filePath) return null
        await fsp.writeFile(filePath, content, 'utf8')
        return filePath
    })

    // 翻訳シート(JSON)を選択して中身を返す
    ipcMain.handle('select-translation-sheet', async () => {
        const win = focusedWindow()
        const openOpts = {
            title: '翻訳シート（JSON）を選択',
            properties: ['openFile' as const],
            filters: [{ name: 'JSON', extensions: ['json'] }]
        }
        const { canceled, filePaths } = win
            ? await dialog.showOpenDialog(win, openOpts)
            : await dialog.showOpenDialog(openOpts)
        if (canceled || !filePaths[0]) return null
        const content = await fsp.readFile(filePaths[0], 'utf8')
        return { path: filePaths[0], content }
    })

    // 翻訳版プロジェクトを新フォルダに生成（assets をコピーし、翻訳済み manga.json を書き出す）
    ipcMain.handle('create-localized-project', async (_, payload: unknown) => {
        const p = (payload ?? {}) as { sourcePath?: unknown; folderName?: unknown; data?: unknown }
        const sourcePath = typeof p.sourcePath === 'string' ? p.sourcePath.trim() : ''
        const folderName = typeof p.folderName === 'string' ? p.folderName.trim() : ''
        const data = p.data

        if (!sourcePath || !fs.existsSync(sourcePath)) {
            throw new Error('元プロジェクトのフォルダが見つかりません')
        }
        if (!isSafeFolderName(folderName)) {
            throw new Error('出力フォルダ名が不正です')
        }
        if (data === null || typeof data !== 'object' || Array.isArray(data)) {
            throw new Error('プロジェクトデータが不正です')
        }

        const parentDir = pathModule.dirname(sourcePath)
        const targetPath = pathModule.join(parentDir, folderName)
        if (fs.existsSync(targetPath)) {
            throw new Error(`同名のフォルダが既に存在します:\n${targetPath}`)
        }

        await fsp.mkdir(targetPath, { recursive: true })

        // assets/ を丸ごとコピー（画像は相対パス参照のため、翻訳版だけで自己完結させる）
        const srcAssets = pathModule.join(sourcePath, 'assets')
        if (fs.existsSync(srcAssets)) {
            await fsp.cp(srcAssets, pathModule.join(targetPath, 'assets'), { recursive: true })
        }
        // 書き出し先（exports）は空で用意
        await fsp.mkdir(pathModule.join(targetPath, 'exports'), { recursive: true })

        // 翻訳済みデータを manga.json として書き出し
        await fsp.writeFile(
            pathModule.join(targetPath, 'manga.json'),
            JSON.stringify(data, null, 2),
            'utf8'
        )

        console.log('Main: created localized project at', targetPath)
        return targetPath
    })
}
