import { ipcMain, nativeImage } from 'electron'
import * as fs from 'fs'
import * as pathModule from 'path'
import { ASSETS_DUST_DIR, ASSETS_IMAGES_DIR } from '../assetsLayoutRoot'
import { sanitizeAssetsSubPath } from './sanitizers'

function listAssetFilesRecursive(dir: string): string[] {
    const out: string[] = []
    if (!fs.existsSync(dir)) return out
    for (const name of fs.readdirSync(dir)) {
        const full = pathModule.join(dir, name)
        const st = fs.statSync(full)
        if (st.isDirectory()) out.push(...listAssetFilesRecursive(full))
        else out.push(full)
    }
    return out
}

export function registerFileHandlers(): void {
    ipcMain.handle('copy-file-to-project', async (_, { projectPath, sourcePath, assetsSubPath }) => {
        const trimmedRoot = String(projectPath ?? '').trim()
        const sub = sanitizeAssetsSubPath(assetsSubPath)
        const assetsDir = pathModule.join(trimmedRoot, 'assets', sub || ASSETS_IMAGES_DIR)

        try {
            if (!fs.existsSync(assetsDir)) {
                fs.mkdirSync(assetsDir, { recursive: true })
            }

            const ext = pathModule.extname(sourcePath)
            // Sanitize filename: remove spaces, commas, and other tricky characters
            const rawBaseName = pathModule.basename(sourcePath, ext)
            const sanitizedBaseName = rawBaseName
                .replace(/\s+/g, '_')           // Spaces to underscores
                .replace(/[^a-z0-9_\-]/gi, '') // Remove everything else except alphanumeric, underscores, and hyphens
                .substring(0, 100)              // Prevent extremely long filenames

            const newFileName = `${Date.now()}_${sanitizedBaseName}${ext}`
            const destPath = pathModule.join(assetsDir, newFileName)

            fs.copyFileSync(sourcePath, destPath)
            return pathModule.relative(trimmedRoot, destPath).split(pathModule.sep).join('/')
        } catch (error) {
            console.error('Main: failed to copy file to project:', error)
            throw error
        }
    })

    // HTML dragstart から呼ぶ（非同期 IPC 不可）。Finder 等へファイルをドラッグする。
    ipcMain.on('start-drag-file', (event, absPath: string) => {
        const p = typeof absPath === 'string' ? absPath.trim() : ''
        if (!p || !fs.existsSync(p)) {
            console.warn('Main: start-drag-file skipped — missing path:', p)
            return
        }
        try {
            let icon = nativeImage.createFromPath(p)
            if (icon.isEmpty()) {
                icon = nativeImage.createEmpty()
            }
            event.sender.startDrag({ file: p, icon })
        } catch (error) {
            console.error('Main: start-drag-file failed:', error)
        }
    })

    ipcMain.handle('get-assets', async (_, projectPath) => {
        const assetsDir = pathModule.join(projectPath.trim(), 'assets')
        try {
            return listAssetFilesRecursive(assetsDir)
        } catch (error) {
            console.error('Main: failed to get assets:', error)
            return []
        }
    })

    ipcMain.handle('delete-file', async (_, filePath) => {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath)
                return true
            }
            return false
        } catch (error) {
            console.error('Main: failed to delete file:', error)
            throw error
        }
    })

    /** 未使用アセット整理用: 削除せず assets/dust/ へ移動 */
    ipcMain.handle(
        'move-asset-to-trash',
        async (_, payload: { projectPath: string; absoluteFilePath: string }) => {
            const root = pathModule.resolve(String(payload.projectPath ?? '').trim())
            const assetsRoot = pathModule.resolve(pathModule.join(root, 'assets'))
            const src = pathModule.resolve(String(payload.absoluteFilePath ?? '').trim())

            if (!fs.existsSync(src)) {
                return { moved: false as const, reason: 'missing' as const }
            }

            const relFromAssets = pathModule.relative(assetsRoot, src)
            if (relFromAssets.startsWith('..') || pathModule.isAbsolute(relFromAssets)) {
                throw new Error('パスがプロジェクトの assets 外です')
            }

            const relNorm = relFromAssets.split(pathModule.sep).join('/')
            if (relNorm === '_trash' || relNorm.startsWith('_trash/')) {
                return { moved: false as const, reason: 'already-trash' as const }
            }
            if (relNorm === `${ASSETS_DUST_DIR}` || relNorm.startsWith(`${ASSETS_DUST_DIR}/`)) {
                return { moved: false as const, reason: 'already-trash' as const }
            }
            if (relNorm === `workspace/_trash` || relNorm.startsWith(`workspace/_trash/`)) {
                return { moved: false as const, reason: 'already-trash' as const }
            }

            const dustDir = pathModule.join(assetsRoot, ASSETS_DUST_DIR)
            if (!fs.existsSync(dustDir)) fs.mkdirSync(dustDir, { recursive: true })

            const base = pathModule.basename(src)
            const ext = pathModule.extname(base)
            const stem = pathModule.basename(base, ext)
            let dest = pathModule.join(dustDir, `${Date.now()}_${stem}${ext}`)
            let n = 0
            while (fs.existsSync(dest)) {
                n += 1
                dest = pathModule.join(dustDir, `${Date.now()}_${n}_${stem}${ext}`)
            }

            try {
                fs.renameSync(src, dest)
            } catch {
                fs.copyFileSync(src, dest)
                fs.unlinkSync(src)
            }

            const relOut = pathModule.relative(root, dest).split(pathModule.sep).join('/')
            console.log('Main: moved unused asset to dust', relOut)
            return { moved: true as const, relativePath: relOut }
        }
    )
}
