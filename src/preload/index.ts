import { contextBridge, ipcRenderer, webUtils } from 'electron'
import path from 'node:path'

if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld('electron', {
            selectFolder: () => ipcRenderer.invoke('select-folder'),
            createProject: (path: string, name: string) => ipcRenderer.invoke('create-project', { path, name }),
            loadProject: (path: string) => ipcRenderer.invoke('load-project', path),
            saveProject: (path: string, data: any) => ipcRenderer.invoke('save-project', { path, data }),
            getTemplates: () => ipcRenderer.invoke('get-templates'),
            saveTemplate: (template: any) => ipcRenderer.invoke('save-template', template),
            deleteTemplate: (templateId: string) => ipcRenderer.invoke('delete-template', templateId),
            exportPNG: (path: string, name: string, data: string) => ipcRenderer.invoke('export-png', { path, name, data }),
            selectFile: () => ipcRenderer.invoke('select-file'),
            copyFileToProject: (projectPath: string, sourcePath: string) => ipcRenderer.invoke('copy-file-to-project', { projectPath, sourcePath }),
            getAssets: (projectPath: string) => ipcRenderer.invoke('get-assets', projectPath),
            deleteFile: (path: string) => ipcRenderer.invoke('delete-file', path),
            pathToUrl: (p: string) => {
                if (!p || p.startsWith('data:') || p.startsWith('local-file://')) return p
                const encodedPath = encodeURI(p)
                const standardPath = encodedPath.startsWith('/') ? encodedPath : `/${encodedPath}`
                return `local-file://${standardPath}`
            },
            /** manga.json の assets/... 相対パス、またはレガシー絶対パスを実ファイルの絶対パスに解決 */
            resolveAssetPath: (projectRoot: string, stored: string) => {
                if (!stored) return ''
                if (path.isAbsolute(stored)) {
                    return stored
                }
                return path.join(projectRoot, stored.replace(/\//g, path.sep))
            },
            getPathForFile: (file: File) => webUtils.getPathForFile(file),
            log: (level: string, ...args: any[]) => ipcRenderer.send('renderer-log', level, ...args)
        })
    } catch (error) {
        console.error(error)
    }
} else {
    // @ts-ignore (define in dts)
    window.electron = {
        selectFolder: () => ipcRenderer.invoke('select-folder'),
        createProject: (path, name) => ipcRenderer.invoke('create-project', { path, name }),
        loadProject: (path) => ipcRenderer.invoke('load-project', path),
        saveProject: (path, data) => ipcRenderer.invoke('save-project', { path, data }),
        getTemplates: () => ipcRenderer.invoke('get-templates'),
        saveTemplate: (template) => ipcRenderer.invoke('save-template', template),
        deleteTemplate: (templateId) => ipcRenderer.invoke('delete-template', templateId),
        exportPNG: (path, name, data) => ipcRenderer.invoke('export-png', { path, name, data }),
        selectFile: () => ipcRenderer.invoke('select-file'),
        copyFileToProject: (projectPath, sourcePath) => ipcRenderer.invoke('copy-file-to-project', { projectPath, sourcePath }),
        getAssets: (projectPath) => ipcRenderer.invoke('get-assets', projectPath),
        deleteFile: (path) => ipcRenderer.invoke('delete-file', path),
        pathToUrl: (p) => {
            if (!p || p.startsWith('data:') || p.startsWith('local-file://')) return p
            const encodedPath = encodeURI(p)
            const standardPath = encodedPath.startsWith('/') ? encodedPath : `/${encodedPath}`
            return `local-file://${standardPath}`
        },
        resolveAssetPath: (projectRoot: string, stored: string) => {
            if (!stored) return ''
            if (path.isAbsolute(stored)) {
                return stored
            }
            return path.join(projectRoot, stored.replace(/\//g, path.sep))
        },
        getPathForFile: (file) => webUtils.getPathForFile(file),
        log: (level, ...args) => ipcRenderer.send('renderer-log', level, ...args)
    }
}
