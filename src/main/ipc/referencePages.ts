import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import { promises as fsp } from 'node:fs'
import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * 参考資料（読んでいる漫画の参考ページ等）をプロジェクト直下の固定フォルダ「参考資料/」に置き、
 * スライドショー表示する。manga.json には保存せず、フォルダの中身をそのまま列挙する
 * ＝別プロジェクトへは「参考資料」フォルダを所定位置にコピペするだけで同様に参照できる。
 */

export const REFERENCE_DIR_NAME = '参考資料'

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tif', '.tiff'])

function refDir(projectPath: string): string {
    return path.join(projectPath, REFERENCE_DIR_NAME)
}

function isImage(name: string): boolean {
    return IMAGE_EXT.has(path.extname(name).toLowerCase())
}

/** 参考資料フォルダ内の画像を名前順（自然順）で列挙。無ければ空配列 */
function listPages(projectPath: string): { name: string; path: string }[] {
    const dir = refDir(projectPath)
    if (!fs.existsSync(dir)) return []
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    return entries
        .filter((e) => e.isFile() && isImage(e.name) && !e.name.startsWith('.'))
        .map((e) => ({ name: e.name, path: path.join(dir, e.name) }))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
}

/** 衝突しない保存名を作る（同名があれば _1, _2 ...） */
function uniqueName(dir: string, base: string): string {
    if (!fs.existsSync(path.join(dir, base))) return base
    const ext = path.extname(base)
    const stem = path.basename(base, ext)
    for (let i = 1; i < 10000; i++) {
        const cand = `${stem}_${i}${ext}`
        if (!fs.existsSync(path.join(dir, cand))) return cand
    }
    return `${stem}_${Date.now()}${ext}`
}

export function registerReferencePagesHandlers(): void {
    ipcMain.handle('reference-pages:list', async (_, { projectPath }: { projectPath: string }) => {
        const cwd = String(projectPath ?? '').trim()
        if (!cwd || !fs.existsSync(cwd)) return []
        return listPages(cwd)
    })

    ipcMain.handle('reference-pages:add', async (_, { projectPath }: { projectPath: string }) => {
        const cwd = String(projectPath ?? '').trim()
        if (!cwd || !fs.existsSync(cwd)) throw new Error('プロジェクトフォルダが見つかりません')
        const win = BrowserWindow.getFocusedWindow()
        const opts = {
            title: '参考資料に追加する画像を選択',
            properties: ['openFile' as const, 'multiSelections' as const],
            filters: [{ name: '画像', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tif', 'tiff'] }]
        }
        const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
        if (res.canceled || res.filePaths.length === 0) return listPages(cwd)
        const dir = refDir(cwd)
        await fsp.mkdir(dir, { recursive: true })
        for (const src of res.filePaths) {
            if (!isImage(src)) continue
            const dest = path.join(dir, uniqueName(dir, path.basename(src)))
            await fsp.copyFile(src, dest)
        }
        return listPages(cwd)
    })

    ipcMain.handle('reference-pages:reveal', async (_, { projectPath }: { projectPath: string }) => {
        const cwd = String(projectPath ?? '').trim()
        if (!cwd || !fs.existsSync(cwd)) throw new Error('プロジェクトフォルダが見つかりません')
        const dir = refDir(cwd)
        await fsp.mkdir(dir, { recursive: true })
        await shell.openPath(dir)
        return true
    })

    ipcMain.handle('reference-pages:delete', async (_, { projectPath, name }: { projectPath: string; name: string }) => {
        const cwd = String(projectPath ?? '').trim()
        const base = String(name ?? '').trim()
        // ディレクトリトラバーサル防止: 単純ファイル名のみ許可
        if (!cwd || !base || base.includes('/') || base.includes('\\') || base.includes('..')) {
            throw new Error('不正なファイル名です')
        }
        const target = path.join(refDir(cwd), base)
        if (fs.existsSync(target)) await fsp.unlink(target)
        return listPages(cwd)
    })
}
