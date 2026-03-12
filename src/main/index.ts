import { app, shell, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron'
import { join, extname, basename } from 'path'
import * as fs from 'fs'
import * as pathModule from 'path'
import { pathToFileURL } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

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

    ipcMain.handle('copy-file-to-project', async (_, { projectPath, sourcePath }) => {
        const assetsDir = pathModule.join(projectPath, 'assets')

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
            return destPath
        } catch (error) {
            console.error('Main: failed to copy file to project:', error)
            throw error
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
            // Create subdirectories
            const assetsDir = pathModule.join(projectPath, 'assets')
            const exportsDir = pathModule.join(projectPath, 'exports')
            if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true })
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

    ipcMain.handle('save-project', async (_, { path, data }) => {
        const trimmedPath = path.trim()
        const configPath = pathModule.join(trimmedPath, 'manga.json')

        try {
            fs.writeFileSync(configPath, JSON.stringify(data, null, 2))
            return true
        } catch (error) {
            console.error('Main: failed to save project at:', configPath, error)
            throw error
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

    ipcMain.handle('save-template', async (_, template) => {
        const fs = await import('fs')
        const pathModule = await import('path')
        const userDataPath = app.getPath('userData')
        const templatePath = pathModule.join(userDataPath, 'templates.json')

        console.log('Main: saving template to', templatePath)

        try {
            let templates = []
            if (fs.existsSync(templatePath)) {
                const existingData = fs.readFileSync(templatePath, 'utf8')
                console.log('Main: existing templates found', existingData)
                templates = JSON.parse(existingData)
            }

            const newTemplate = { ...template, id: Math.random().toString(36).substr(2, 9) }
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

    ipcMain.handle('get-assets', async (_, projectPath) => {
        const assetsDir = pathModule.join(projectPath, 'assets')
        try {
            if (!fs.existsSync(assetsDir)) return []
            return fs.readdirSync(assetsDir).map(file => pathModule.join(assetsDir, file))
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

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})
