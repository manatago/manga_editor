import { app, shell, BrowserWindow, ipcMain, dialog, protocol, net, nativeImage, safeStorage } from 'electron'
import { join, extname, basename } from 'path'
import * as fs from 'fs'
import * as pathModule from 'path'
import { pathToFileURL } from 'url'
import { unzipSync } from 'fflate'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { runRembgToFile, resolveReferenceRembgPaths, toProjectRelativePath } from './rembgRunner'
import {
    assertTemplateForSave,
    assertTemplateHasPersistableId,
    parseSaveProjectPayload,
    parseSaveProjectSyncPayload
} from './ipcGuards'
import { ASSETS_COMPOSITES_DIR, ASSETS_DUST_DIR, ASSETS_IMAGES_DIR, ASSETS_REFERENCES_DIR } from './assetsLayoutRoot'

// Add this for renderer logs to terminal
ipcMain.on('renderer-log', (_e, level, ...args) => {
    const color = level === 'error' ? '\x1b[31m' : (level === 'warn' ? '\x1b[33m' : '\x1b[32m')
    console.log(`${color}[Renderer ${level.toUpperCase()}]\x1b[0m`, ...args)
})

// Register custom protocol as privileged
protocol.registerSchemesAsPrivileged([
    { scheme: 'local-file', privileges: { secure: true, standard: true, supportFetchAPI: true, bypassCSP: false, stream: true } }
])

/** NovelAI API の応答 ZIP の中から最初の PNG を取り出す */
function extractFirstPngFromZipBuffer(buf: Buffer): Buffer | null {
    const entries = unzipSync(new Uint8Array(buf))
    for (const name of Object.keys(entries)) {
        if (name.toLowerCase().endsWith('.png')) {
            return Buffer.from(entries[name])
        }
    }
    return null
}

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

    /** 旧 `assets/images/composite/` 配下のファイルを `assets/composites/` へ移す（1回限り） */
    function migrateLegacyCompositesDir(root: string): void {
        const legacy = pathModule.join(root, 'assets', ASSETS_IMAGES_DIR, 'composite')
        if (!fs.existsSync(legacy)) return
        const target = pathModule.join(root, 'assets', ASSETS_COMPOSITES_DIR)
        try {
            if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true })
            const entries = fs.readdirSync(legacy)
            for (const name of entries) {
                const src = pathModule.join(legacy, name)
                const dst = pathModule.join(target, name)
                if (fs.existsSync(dst)) continue
                fs.renameSync(src, dst)
            }
            const remain = fs.readdirSync(legacy)
            if (remain.length === 0) {
                fs.rmdirSync(legacy)
                console.log('Main: migrated legacy composite directory:', legacy, '→', target)
            }
        } catch (e) {
            console.error('Main: failed to migrate legacy composites dir', e)
        }
    }

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
            // assets 直下は images / dust / references / composites のフォルダのみ（ファイル混在なし）
            const assetsDir = pathModule.join(projectPath, 'assets')
            const imagesDir = pathModule.join(assetsDir, ASSETS_IMAGES_DIR)
            const dustDir = pathModule.join(assetsDir, ASSETS_DUST_DIR)
            const referencesDir = pathModule.join(assetsDir, ASSETS_REFERENCES_DIR)
            const compositesDir = pathModule.join(assetsDir, ASSETS_COMPOSITES_DIR)
            const exportsDir = pathModule.join(projectPath, 'exports')
            if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true })
            if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true })
            if (!fs.existsSync(dustDir)) fs.mkdirSync(dustDir, { recursive: true })
            if (!fs.existsSync(referencesDir)) fs.mkdirSync(referencesDir, { recursive: true })
            if (!fs.existsSync(compositesDir)) fs.mkdirSync(compositesDir, { recursive: true })
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
            migrateLegacyCompositesDir(trimmedPath)
            let data = fs.readFileSync(configPath, 'utf8')
            const rewritten = data.replace(/assets\/images\/composite\//g, `assets/${ASSETS_COMPOSITES_DIR}/`)
            if (rewritten !== data) {
                fs.writeFileSync(configPath, rewritten)
                data = rewritten
                console.log('Main: rewrote legacy composite paths in manga.json')
            }
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

    /** カスタムトーン（app-wide）: userData/custom-tones/ に PNG を保存 */
    const customTonesDir = () => pathModule.join(app.getPath('userData'), 'custom-tones')
    const customTonesCatalog = () => pathModule.join(customTonesDir(), 'catalog.json')

    function readCustomTonesCatalog(): { id: string; name: string }[] {
        const p = customTonesCatalog()
        if (!fs.existsSync(p)) return []
        try { return JSON.parse(fs.readFileSync(p, 'utf-8')) } catch { return [] }
    }

    function writeCustomTonesCatalog(catalog: { id: string; name: string }[]): void {
        fs.writeFileSync(customTonesCatalog(), JSON.stringify(catalog))
    }

    ipcMain.handle('get-custom-tones', async () => {
        return readCustomTonesCatalog().map((e) => ({
            ...e,
            absolutePath: pathModule.join(customTonesDir(), `${e.id}.png`)
        }))
    })

    ipcMain.handle('add-custom-tone', async (_, { sourcePath, name }: { sourcePath: string; name: string }) => {
        const dir = customTonesDir()
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
        const src = pathModule.resolve(String(sourcePath ?? '').trim())
        if (!fs.existsSync(src)) throw new Error('ソースファイルが見つかりません')
        const id = `ct_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
        const dest = pathModule.join(dir, `${id}.png`)
        fs.copyFileSync(src, dest)
        const entry = { id, name: String(name || 'トーン').trim().slice(0, 80) }
        writeCustomTonesCatalog([...readCustomTonesCatalog(), entry])
        return { ...entry, absolutePath: dest }
    })

    ipcMain.handle('delete-custom-tone', async (_, { id }: { id: string }) => {
        const png = pathModule.join(customTonesDir(), `${id}.png`)
        if (fs.existsSync(png)) fs.unlinkSync(png)
        writeCustomTonesCatalog(readCustomTonesCatalog().filter((e) => e.id !== id))
    })

    ipcMain.handle('rename-custom-tone', async (_, { id, name }: { id: string; name: string }) => {
        const catalog = readCustomTonesCatalog().map((e) =>
            e.id === id ? { ...e, name: String(name || 'トーン').trim().slice(0, 80) } : e
        )
        writeCustomTonesCatalog(catalog)
    })

    ipcMain.handle('resolve-custom-tone', async (_, { id }: { id: string }) => {
        const p = pathModule.join(customTonesDir(), `${id}.png`)
        return fs.existsSync(p) ? p : null
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

    /** NovelAI トークンは safeStorage で暗号化して userData 配下に保存 */
    const novelaiTokenFile = () => pathModule.join(app.getPath('userData'), 'novelai-token.enc')

    ipcMain.handle('novelai:save-token', async (_, { token }: { token: string }) => {
        const t = String(token ?? '').trim()
        if (!t) {
            if (fs.existsSync(novelaiTokenFile())) fs.unlinkSync(novelaiTokenFile())
            return { saved: false }
        }
        if (!safeStorage.isEncryptionAvailable()) {
            throw new Error('OS の暗号化ストレージが使用できません')
        }
        const enc = safeStorage.encryptString(t)
        fs.writeFileSync(novelaiTokenFile(), enc)
        return { saved: true }
    })

    ipcMain.handle('novelai:load-token', async () => {
        const p = novelaiTokenFile()
        if (!fs.existsSync(p)) return { token: '' }
        if (!safeStorage.isEncryptionAvailable()) return { token: '' }
        try {
            const buf = fs.readFileSync(p)
            return { token: safeStorage.decryptString(buf) }
        } catch (e) {
            console.error('Main: failed to decrypt NovelAI token', e)
            return { token: '' }
        }
    })

    ipcMain.handle('novelai:clear-token', async () => {
        const p = novelaiTokenFile()
        if (fs.existsSync(p)) fs.unlinkSync(p)
        return { cleared: true }
    })

    function loadStoredNovelAIToken(): string {
        const p = novelaiTokenFile()
        if (!fs.existsSync(p) || !safeStorage.isEncryptionAvailable()) return ''
        try { return safeStorage.decryptString(fs.readFileSync(p)) } catch { return '' }
    }

    const NOVELAI_DEFAULT_NEGATIVE =
        'nsfw, lowres, {bad}, error, fewer, extra, missing, worst quality, jpeg artifacts, ' +
        'bad quality, watermark, unfinished, displeasing, chromatic aberration, signature, ' +
        'extra digits, artistic error, username, scan, [abstract]'
    const NOVELAI_QUALITY_PREFIX = 'best quality, amazing quality, very aesthetic, '
    const NOVELAI_ASPECT_MAP = {
        portrait: { width: 832, height: 1216 },
        square: { width: 1024, height: 1024 },
        landscape: { width: 1216, height: 832 }
    } as const

    type NovelAIGeneratePayload = {
        aspect?: 'portrait' | 'square' | 'landscape'
        situationPrompt?: string
        supplementaryPrompt?: string
        characterPrompts?: Array<{ prompt: string; uc?: string }>
        negativeOverride?: string
        seed?: number | null
        preciseRefs?: Array<{
            imageBase64Png: string
            strength: number
            fidelity: number
            type: 'character' | 'style' | 'character&style'
        }>
        /** 保存先のプロジェクトルート（絶対パス） */
        projectPath: string
        /** 保存先のサブディレクトリに使うコマ ID */
        panelId: string
    }

    const sanitizePanelId = (v: string): string => {
        const s = String(v ?? '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40)
        return s || 'panel'
    }

    ipcMain.handle('novelai:generate', async (_, payload: NovelAIGeneratePayload) => {
        const token = loadStoredNovelAIToken()
        if (!token) return { ok: false, error: 'token-missing' as const }

        const projectRoot = String(payload.projectPath ?? '').trim()
        if (!projectRoot || !fs.existsSync(projectRoot)) {
            return { ok: false, error: 'project-missing' as const }
        }
        const panelKey = sanitizePanelId(payload.panelId ?? '')

        const aspectKey = payload.aspect ?? 'portrait'
        const { width, height } = NOVELAI_ASPECT_MAP[aspectKey]
        const situation = String(payload.situationPrompt ?? '').trim()
        const supplementary = String(payload.supplementaryPrompt ?? '').trim()
        const rawChars = Array.isArray(payload.characterPrompts) ? payload.characterPrompts : []
        const chars = rawChars
            .map((c) => ({ prompt: String(c?.prompt ?? '').trim(), uc: String(c?.uc ?? '').trim() }))
            .filter((c) => !!c.prompt)
            .slice(0, 6)
        const negative = String(payload.negativeOverride ?? '').trim() || NOVELAI_DEFAULT_NEGATIVE
        const seed = Number.isFinite(payload.seed as number)
            ? Math.floor(payload.seed as number) >>> 0
            : Math.floor(Math.random() * 2 ** 31) >>> 0

        const baseCaption = `${NOVELAI_QUALITY_PREFIX}${[situation, supplementary].filter(Boolean).join(', ')}`
        const fullInput = chars.length
            ? `${baseCaption}, ${chars.map((c) => c.prompt).join(', ')}`
            : baseCaption

        const charCaptions = chars.map((c) => ({
            char_caption: c.prompt,
            centers: [{ x: 0.5, y: 0.5 }]
        }))
        const characterPromptsArray = chars.map((c) => ({
            prompt: c.prompt,
            uc: c.uc,
            center: { x: 0.5, y: 0.5 },
            enabled: true
        }))

        const parameters: Record<string, unknown> = {
            width,
            height,
            scale: 6.0,
            sampler: 'k_euler_ancestral',
            steps: 28,
            n_samples: 1,
            ucPreset: 0,
            qualityToggle: true,
            dynamic_thresholding: false,
            controlnet_strength: 1.0,
            legacy: false,
            add_original_image: false,
            cfg_rescale: 0,
            noise_schedule: 'karras',
            legacy_v3_extend: false,
            skip_cfg_above_sigma: null,
            params_version: 3,
            seed,
            input: fullInput,
            negative_prompt: negative,
            v4_prompt: {
                caption: {
                    base_caption: baseCaption,
                    char_captions: charCaptions
                },
                use_coords: false,
                use_order: true
            },
            v4_negative_prompt: {
                caption: {
                    base_caption: negative,
                    char_captions: chars.map((c) => ({
                        char_caption: c.uc,
                        centers: [{ x: 0.5, y: 0.5 }]
                    }))
                },
                use_coords: false,
                use_order: false,
                legacy_uc: false
            },
            characterPrompts: characterPromptsArray,
            deliberate_euler_ancestral_bug: false,
            prefer_brownian: true,
            action: 'generate'
        }

        const refs = (payload.preciseRefs ?? []).slice(0, 5)
        if (refs.length > 0) {
            parameters.director_reference_images = refs.map((r) => r.imageBase64Png)
            parameters.director_reference_descriptions = refs.map((r) => ({
                caption: { base_caption: r.type, char_captions: [] },
                legacy_uc: false
            }))
            parameters.director_reference_strength_values = refs.map((r) =>
                Math.round(Math.max(0, Math.min(1, r.strength)) * 100) / 100
            )
            parameters.director_reference_secondary_strength_values = refs.map((r) =>
                Math.round(Math.max(0, Math.min(1, 1 - r.fidelity)) * 100) / 100
            )
            parameters.director_reference_information_extracted = refs.map(() => 1.0)
            parameters.normalize_reference_strength_multiple = false
        }

        const body = {
            model: 'nai-diffusion-4-5-full',
            parameters
        }

        // 送信前に「キャラが何人、どの prompt/uc で送られるか」を可視化（DevTools/メインログ用）
        // 実送信は切り詰めなし。ログ表示だけ 240 文字で丸めている
        console.log('[novelai:generate] chars sent to NovelAI:', {
            count: chars.length,
            seed,
            chars: chars.map((c, i) => ({
                idx: i,
                promptLen: c.prompt.length,
                ucLen: c.uc.length,
                prompt: c.prompt.length > 240 ? c.prompt.slice(0, 240) + '…(truncated)' : c.prompt,
                uc: c.uc.length > 240 ? c.uc.slice(0, 240) + '…(truncated)' : c.uc
            }))
        })

        let lastError: string | null = null
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const resp = await net.fetch('https://image.novelai.net/ai/generate-image', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(body)
                })
                if (resp.status === 402) {
                    return { ok: false, error: 'anlas-insufficient' as const, status: 402 }
                }
                if (resp.status === 429 || resp.status >= 500) {
                    lastError = `HTTP ${resp.status}`
                    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
                    continue
                }
                if (!resp.ok) {
                    const text = await resp.text().catch(() => '')
                    return {
                        ok: false,
                        error: 'http-error' as const,
                        status: resp.status,
                        message: text.slice(0, 500)
                    }
                }
                const buffer = Buffer.from(await resp.arrayBuffer())
                const png = extractFirstPngFromZipBuffer(buffer)
                if (!png) {
                    return { ok: false, error: 'zip-missing-png' as const }
                }
                const outDir = pathModule.join(projectRoot, 'assets', ASSETS_IMAGES_DIR, 'novelai', panelKey)
                if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
                const now = new Date()
                const pad = (n: number) => String(n).padStart(2, '0')
                const stampName = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}_${seed}`
                let filePath = pathModule.join(outDir, `${stampName}.png`)
                let suffix = 0
                while (fs.existsSync(filePath)) {
                    suffix += 1
                    filePath = pathModule.join(outDir, `${stampName}_${suffix}.png`)
                }
                fs.writeFileSync(filePath, png)
                const rel = pathModule.relative(projectRoot, filePath).split(pathModule.sep).join('/')
                return { ok: true, relativePath: rel, seed, width, height, createdAt: now.getTime() }
            } catch (e) {
                lastError = e instanceof Error ? e.message : String(e)
                await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
            }
        }
        return { ok: false, error: 'network' as const, message: lastError ?? 'unknown' }
    })

    /** 生成履歴から 1 件削除。assets/dust/ へ物理移動する */
    ipcMain.handle('novelai:delete-generation', async (_, { projectPath, relativePath }: { projectPath: string; relativePath: string }) => {
        const root = pathModule.resolve(String(projectPath ?? '').trim())
        const rel = String(relativePath ?? '').replace(/\\/g, '/').replace(/^\/+/, '')
        if (!root || !rel) return { moved: false as const, reason: 'invalid' as const }
        const src = pathModule.resolve(pathModule.join(root, ...rel.split('/')))
        const assetsRoot = pathModule.resolve(pathModule.join(root, 'assets'))
        const relFromAssets = pathModule.relative(assetsRoot, src)
        if (relFromAssets.startsWith('..') || pathModule.isAbsolute(relFromAssets)) {
            return { moved: false as const, reason: 'out-of-project' as const }
        }
        if (!fs.existsSync(src)) {
            return { moved: false as const, reason: 'missing' as const }
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
        return { moved: true as const, relativePath: relOut }
    })

    ipcMain.handle('novelai:test-connection', async (_, { token }: { token?: string } = {}) => {
        let useToken = String(token ?? '').trim()
        if (!useToken) {
            const p = novelaiTokenFile()
            if (fs.existsSync(p) && safeStorage.isEncryptionAvailable()) {
                try { useToken = safeStorage.decryptString(fs.readFileSync(p)) } catch { useToken = '' }
            }
        }
        if (!useToken) return { ok: false, error: 'token-missing' as const }
        try {
            const resp = await net.fetch('https://api.novelai.net/user/subscription', {
                method: 'GET',
                headers: { Authorization: `Bearer ${useToken}` }
            })
            if (!resp.ok) {
                return { ok: false, status: resp.status, error: `http-${resp.status}` as const }
            }
            const json = await resp.json() as {
                trainingStepsLeft?: {
                    fixedTrainingStepsLeft?: number
                    purchasedTrainingSteps?: number
                }
                tier?: number
                active?: boolean
            }
            const fixed = json.trainingStepsLeft?.fixedTrainingStepsLeft ?? 0
            const purchased = json.trainingStepsLeft?.purchasedTrainingSteps ?? 0
            return {
                ok: true,
                anlas: fixed + purchased,
                fixedAnlas: fixed,
                purchasedAnlas: purchased,
                tier: json.tier ?? null,
                active: json.active ?? null
            }
        } catch (e) {
            console.error('Main: novelai test-connection failed', e)
            return { ok: false, error: 'network' as const, message: e instanceof Error ? e.message : String(e) }
        }
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
