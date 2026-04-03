import { app, shell, BrowserWindow, ipcMain, dialog, protocol, net, nativeImage } from 'electron'
import { join, extname, basename } from 'path'
import * as fs from 'fs'
import * as pathModule from 'path'
import { pathToFileURL } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { runRembgToFile, resolveReferenceRembgPaths, toProjectRelativePath } from './rembgRunner'
import {
    assertTemplateForSave,
    assertTemplateHasPersistableId,
    parseSaveProjectPayload,
    parseSaveProjectSyncPayload
} from './ipcGuards'
import { ASSETS_DUST_DIR, ASSETS_IMAGES_DIR, ASSETS_REFERENCES_DIR } from './assetsLayoutRoot'

// Add this for renderer logs to terminal
ipcMain.on('renderer-log', (_e, level, ...args) => {
    const color = level === 'error' ? '\x1b[31m' : (level === 'warn' ? '\x1b[33m' : '\x1b[32m')
    console.log(`${color}[Renderer ${level.toUpperCase()}]\x1b[0m`, ...args)
})

// Register custom protocol as privileged
protocol.registerSchemesAsPrivileged([
    { scheme: 'local-file', privileges: { secure: true, standard: true, supportFetchAPI: true, bypassCSP: false, stream: true } }
])

function createWindow(): void {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 900,
        show: false,
        autoHideMenuBar: true,
        webPreferences: {
            preload: join(__dirname, '../preload/index.mjs'),
            sandbox: false
        }
    })

    mainWindow.on('ready-to-show', () => {
        mainWindow.show()
    })

    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url)
        return { action: 'deny' }
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }
}

app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.electron')

    // Handle local-file protocol
    protocol.handle('local-file', (request) => {
        try {
            // Electron's protocol.handle gives a full URL.
            // For custom standard protocols, local-file:///Users/... might have /Users as pathname or Users as host.
            // To be robust, we combine host and pathname if host exists.
            const url = new URL(request.url)
            let rawPath = url.host ? (url.host + url.pathname) : url.pathname
            
            // On Mac/Linux, if rawPath doesn't start with /, it should probably have one.
            if (!rawPath.startsWith('/') && !/^[a-zA-Z]:/.test(rawPath)) {
                rawPath = '/' + rawPath
            }

            const decodedPath = decodeURIComponent(rawPath)
            
            if (!fs.existsSync(decodedPath)) {
                console.error('Main: local-file protocol - File NOT FOUND at:', decodedPath)
            }

            return net.fetch(pathToFileURL(decodedPath).toString())
        } catch (error) {
            console.error('Main: local-file protocol fatal error:', error)
            throw error
        }
    })

    app.on('browser-window-created', (_, window) => {
        optimizer.watchWindowShortcuts(window)
    })

    createWindow()

    /** assets/ 以下のみ。`..` や不正文字を拒否 */
    function sanitizeAssetsSubPath(input: unknown): string {
        if (input == null || typeof input !== 'string') return ''
        const s = input.replace(/\\/g, '/').replace(/^\/+/g, '').replace(/\/+$/g, '')
        if (!s || s.includes('..')) return ''
        if (!/^[a-zA-Z0-9/_-]+$/.test(s)) return ''
        const parts = s.split('/').filter(Boolean)
        if (parts.length === 0 || parts.length > 16) return ''
        for (const p of parts) {
            if (p.length > 120) return ''
        }
        return parts.join(pathModule.sep)
    }

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

    ipcMain.handle('create-project', async (_, { path, name }) => {
        const projectPath = pathModule.join(path.trim(), name.trim())

        try {
            if (!fs.existsSync(projectPath)) {
                fs.mkdirSync(projectPath, { recursive: true })
            }
            // assets 直下は images / dust / references のみ（ファイル混在なし）
            const assetsDir = pathModule.join(projectPath, 'assets')
            const imagesDir = pathModule.join(assetsDir, ASSETS_IMAGES_DIR)
            const dustDir = pathModule.join(assetsDir, ASSETS_DUST_DIR)
            const referencesDir = pathModule.join(assetsDir, ASSETS_REFERENCES_DIR)
            const compositeDir = pathModule.join(imagesDir, 'composite')
            const exportsDir = pathModule.join(projectPath, 'exports')
            if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true })
            if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true })
            if (!fs.existsSync(dustDir)) fs.mkdirSync(dustDir, { recursive: true })
            if (!fs.existsSync(referencesDir)) fs.mkdirSync(referencesDir, { recursive: true })
            if (!fs.existsSync(compositeDir)) fs.mkdirSync(compositeDir, { recursive: true })
            if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir, { recursive: true })

            const configPath = pathModule.join(projectPath, 'manga.json')
            const configData = JSON.stringify({ name, createdAt: new Date().toISOString(), pages: [] }, null, 2)
            fs.writeFileSync(configPath, configData)
            console.log('Main: Created project at:', projectPath)
            return projectPath
        } catch (error) {
            console.error('Main: failed to create project:', error)
            throw error
        }
    })

    ipcMain.handle('load-project', async (_, path) => {
        const trimmedPath = path.trim()
        const configPath = pathModule.join(trimmedPath, 'manga.json')
        console.log('Main: Loading project from:', configPath)

        try {
            if (!fs.existsSync(configPath)) {
                console.error('Main: manga.json not found at:', configPath)
                throw new Error('プロジェクトファイル (manga.json) が見つかりませんでした。')
            }
            const data = fs.readFileSync(configPath, 'utf8')
            const parsedData = JSON.parse(data)
            console.log('Main: Project data loaded successfully from', trimmedPath)
            return parsedData
        } catch (error) {
            console.error('Main: failed to load project:', error)
            throw error
        }
    })

    ipcMain.handle('save-project', async (_, payload: unknown) => {
        const { path: savePath, data } = parseSaveProjectPayload(payload)
        const configPath = pathModule.join(savePath, 'manga.json')

        try {
            fs.writeFileSync(configPath, JSON.stringify(data, null, 2))
            return true
        } catch (error) {
            console.error('Main: failed to save project at:', configPath, error)
            throw error
        }
    })

    // Synchronous save path used only for app close/beforeunload flush.
    ipcMain.on('save-project-sync', (event, payload: unknown) => {
        try {
            const parsed = parseSaveProjectSyncPayload(payload)
            if (!parsed) {
                event.returnValue = false
                return
            }
            const configPath = pathModule.join(parsed.path, 'manga.json')
            fs.writeFileSync(configPath, JSON.stringify(parsed.data, null, 2))
            event.returnValue = true
        } catch (error) {
            console.error('Main: failed to save project synchronously:', error)
            event.returnValue = false
        }
    })

    ipcMain.handle('get-templates', async () => {
        const fs = await import('fs')
        const pathModule = await import('path')
        const templatePath = pathModule.join(app.getPath('userData'), 'templates.json')

        try {
            if (!fs.existsSync(templatePath)) return []
            const data = fs.readFileSync(templatePath, 'utf8')
            return JSON.parse(data)
        } catch (error) {
            console.error('Main: failed to get templates:', error)
            return []
        }
    })

    ipcMain.handle('save-template', async (_, templateRaw: unknown) => {
        const fs = await import('fs')
        const pathModule = await import('path')
        const userDataPath = app.getPath('userData')
        const templatePath = pathModule.join(userDataPath, 'templates.json')

        console.log('Main: saving template to', templatePath)

        try {
            const template = assertTemplateForSave(templateRaw)
            let templates = []
            if (fs.existsSync(templatePath)) {
                const existingData = fs.readFileSync(templatePath, 'utf8')
                console.log('Main: existing templates found', existingData)
                templates = JSON.parse(existingData)
            }

            const newTemplate = { ...template, id: Math.random().toString(36).substr(2, 9) }
            assertTemplateHasPersistableId(newTemplate)
            templates.push(newTemplate)

            fs.writeFileSync(templatePath, JSON.stringify(templates, null, 2))
            console.log('Main: template saved successfully. Total templates:', templates.length)
            return templates
        } catch (error) {
            console.error('Main: failed to save template:', error)
            throw error
        }
    })

    ipcMain.handle('delete-template', async (_, templateId) => {
        const fs = await import('fs')
        const pathModule = await import('path')
        const userDataPath = app.getPath('userData')
        const templatePath = pathModule.join(userDataPath, 'templates.json')

        try {
            if (!fs.existsSync(templatePath)) return []
            const data = fs.readFileSync(templatePath, 'utf8')
            let templates = JSON.parse(data)
            templates = templates.filter((t: any) => t.id !== templateId)
            fs.writeFileSync(templatePath, JSON.stringify(templates, null, 2))
            return templates
        } catch (error) {
            console.error('Main: failed to delete template:', error)
            throw error
        }
    })

    ipcMain.handle('export-png', async (_, { path, name, data }) => {
        const trimmedPath = path.trim()
        const exportDir = pathModule.join(trimmedPath, 'exports')

        try {
            if (!fs.existsSync(exportDir)) {
                fs.mkdirSync(exportDir, { recursive: true })
            }
            const filePath = pathModule.join(exportDir, `${name}.png`)
            const base64Data = data.replace(/^data:image\/png;base64,/, '')
            fs.writeFileSync(filePath, base64Data, 'base64')
            console.log('Main: PNG exported to', filePath)
            return filePath
        } catch (error) {
            console.error('Main: failed to export png:', error)
            throw error
        }
    })

    /** 合成ツール: assets/images/composite/ に日時ベースのファイル名で PNG 保存 */
    ipcMain.handle('save-composite-png', async (_, { projectPath, data }: { projectPath: string; data: string }) => {
        const root = String(projectPath ?? '').trim()
        const compositeDir = pathModule.join(root, 'assets', ASSETS_IMAGES_DIR, 'composite')
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

    ipcMain.handle(
        'rembg-remove-background',
        async (_, { projectPath, inputRelativePath }: { projectPath: string; inputRelativePath: string }) => {
            try {
                const root = String(projectPath ?? '').trim()
                const relIn = String(inputRelativePath ?? '').trim()
                const { inputAbs, outputAbs } = resolveReferenceRembgPaths(root, relIn)
                await runRembgToFile(inputAbs, outputAbs)
                return { relativePath: toProjectRelativePath(root, outputAbs) }
            } catch (e) {
                console.error('Main: rembg-remove-background failed', e)
                throw e
            }
        }
    )

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

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})
