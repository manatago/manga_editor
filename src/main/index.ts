import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

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

    app.on('browser-window-created', (_, window) => {
        optimizer.watchWindowShortcuts(window)
    })

    createWindow()

    ipcMain.handle('select-folder', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog({
            properties: ['openDirectory'],
            title: 'プロジェクトを保存するフォルダを選択してください'
        })
        if (canceled) return null
        return filePaths[0]
    })

    ipcMain.handle('create-project', async (_, { path, name }) => {
        const fs = await import('fs')
        const pathModule = await import('path')
        const projectPath = pathModule.join(path, name)

        try {
            if (!fs.existsSync(projectPath)) {
                fs.mkdirSync(projectPath, { recursive: true })
            }
            const configPath = pathModule.join(projectPath, 'manga.json')
            const configData = JSON.stringify({ name, createdAt: new Date().toISOString(), pages: [] }, null, 2)
            fs.writeFileSync(configPath, configData)
            return projectPath
        } catch (error) {
            console.error('Main: failed to create project:', error)
            throw error
        }
    })

    ipcMain.handle('load-project', async (_, path) => {
        const fs = await import('fs')
        const pathModule = await import('path')
        const configPath = pathModule.join(path, 'manga.json')

        try {
            if (!fs.existsSync(configPath)) {
                throw new Error('プロジェクトファイル (manga.json) が見つかりませんでした。')
            }
            const data = fs.readFileSync(configPath, 'utf8')
            return JSON.parse(data)
        } catch (error) {
            console.error('Main: failed to load project:', error)
            throw error
        }
    })

    ipcMain.handle('save-project', async (_, { path, data }) => {
        const fs = await import('fs')
        const pathModule = await import('path')
        const configPath = pathModule.join(path, 'manga.json')

        try {
            fs.writeFileSync(configPath, JSON.stringify(data, null, 2))
            return true
        } catch (error) {
            console.error('Main: failed to save project:', error)
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

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})
