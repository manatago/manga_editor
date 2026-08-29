import { app, shell, BrowserWindow, ipcMain, protocol } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { LOCAL_FILE_PROTOCOL_SCHEMES, registerLocalFileProtocol } from './ipc/protocols'
import { registerDialogHandlers } from './ipc/dialogs'
import { registerFileHandlers } from './ipc/files'
import { registerProjectHandlers } from './ipc/project'
import { registerTemplateHandlers } from './ipc/templates'
import { registerExportHandlers } from './ipc/export'
import { registerCustomToneHandlers } from './ipc/customTones'
import { registerRembgHandlers } from './ipc/rembg'
import { registerNovelAIHandlers } from './ipc/novelai'
import { registerLocalizationHandlers } from './ipc/localization'
import { registerGitHandlers } from './ipc/git'

// Add this for renderer logs to terminal
ipcMain.on('renderer-log', (_e, level, ...args) => {
    const color = level === 'error' ? '\x1b[31m' : (level === 'warn' ? '\x1b[33m' : '\x1b[32m')
    console.log(`${color}[Renderer ${level.toUpperCase()}]\x1b[0m`, ...args)
})

// Register custom protocol as privileged
protocol.registerSchemesAsPrivileged(LOCAL_FILE_PROTOCOL_SCHEMES)

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

    registerLocalFileProtocol()

    app.on('browser-window-created', (_, window) => {
        optimizer.watchWindowShortcuts(window)
    })

    createWindow()

    registerDialogHandlers()
    registerFileHandlers()
    registerProjectHandlers()
    registerTemplateHandlers()
    registerExportHandlers()
    registerCustomToneHandlers()
    registerRembgHandlers()
    registerNovelAIHandlers()
    registerLocalizationHandlers()
    registerGitHandlers()

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})
