import { ipcMain } from 'electron'
import * as fs from 'fs'
import * as pathModule from 'path'
import { ASSETS_COMPOSITES_DIR } from '../assetsLayoutRoot'
import { sanitizeAssetsSubPath } from './sanitizers'

export function registerExportHandlers(): void {
    ipcMain.handle('export-text', async (_, { path, data }: { path: string; data: string }) => {
        const trimmedPath = path.trim()
        const exportDir = pathModule.join(trimmedPath, 'exports')
        try {
            if (!fs.existsSync(exportDir)) {
                fs.mkdirSync(exportDir, { recursive: true })
            }
            const filePath = pathModule.join(exportDir, 'script.txt')
            fs.writeFileSync(filePath, data, 'utf8')
            console.log('Main: text exported to', filePath)
            return filePath
        } catch (error) {
            console.error('Main: failed to export text:', error)
            throw error
        }
    })

    ipcMain.handle('export-png', async (_, { path, name, data, format }: { path: string; name: string; data: string; format?: 'png' | 'jpeg' }) => {
        const trimmedPath = path.trim()
        const exportDir = pathModule.join(trimmedPath, 'exports')
        const ext = format === 'jpeg' ? 'jpg' : 'png'

        try {
            if (!fs.existsSync(exportDir)) {
                fs.mkdirSync(exportDir, { recursive: true })
            }
            const filePath = pathModule.join(exportDir, `${name}.${ext}`)
            const base64Data = data.replace(/^data:image\/\w+;base64,/, '')
            fs.writeFileSync(filePath, base64Data, 'base64')
            console.log('Main: image exported to', filePath)
            return filePath
        } catch (error) {
            console.error('Main: failed to export image:', error)
            throw error
        }
    })

    /** 合成ツール: assets/composites/ に日時ベースのファイル名で PNG 保存 */
    ipcMain.handle('save-composite-png', async (_, { projectPath, data }: { projectPath: string; data: string }) => {
        const root = String(projectPath ?? '').trim()
        const compositeDir = pathModule.join(root, 'assets', ASSETS_COMPOSITES_DIR)
        try {
            if (!fs.existsSync(compositeDir)) {
                fs.mkdirSync(compositeDir, { recursive: true })
            }
            const d = new Date()
            const pad = (n: number) => String(n).padStart(2, '0')
            const baseName = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}_${d.getMilliseconds()}`
            let filePath = pathModule.join(compositeDir, `${baseName}.png`)
            let n = 0
            while (fs.existsSync(filePath)) {
                n += 1
                filePath = pathModule.join(compositeDir, `${baseName}_${n}.png`)
            }
            const base64Data = data.replace(/^data:image\/png;base64,/, '')
            fs.writeFileSync(filePath, base64Data, 'base64')
            const rel = pathModule.relative(root, filePath).split(pathModule.sep).join('/')
            console.log('Main: composite PNG saved to', rel)
            return { relativePath: rel }
        } catch (error) {
            console.error('Main: failed to save composite png:', error)
            throw error
        }
    })

    /** マジックワンド編集後の PNG を参照キャラクター assets に保存 */
    ipcMain.handle('save-wand-png', async (_, { projectPath, assetsSubPath, baseName, data }: { projectPath: string; assetsSubPath: string; baseName: string; data: string }) => {
        const root = String(projectPath ?? '').trim()
        const sub = sanitizeAssetsSubPath(assetsSubPath)
        if (!sub) throw new Error('assetsSubPath が不正です')
        const dir = pathModule.join(root, 'assets', sub)
        try {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true })
            }
            const safe = String(baseName ?? 'wand').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'wand'
            let filePath = pathModule.join(dir, `${safe}_wand.png`)
            let n = 0
            while (fs.existsSync(filePath)) {
                n += 1
                filePath = pathModule.join(dir, `${safe}_wand_${n}.png`)
            }
            const base64Data = data.replace(/^data:image\/png;base64,/, '')
            fs.writeFileSync(filePath, base64Data, 'base64')
            const rel = pathModule.relative(root, filePath).split(pathModule.sep).join('/')
            console.log('Main: wand PNG saved to', rel)
            return { relativePath: rel }
        } catch (error) {
            console.error('Main: failed to save wand png:', error)
            throw error
        }
    })
}
