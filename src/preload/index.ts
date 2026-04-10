import { contextBridge, ipcRenderer, webUtils } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

function toAbs(projectRoot: string, relPosix: string): string {
    const parts = relPosix.split('/').filter(Boolean)
    return path.join(projectRoot, ...parts)
}

/** manga.json の相対パスを実ファイルへ。images/dust/references と旧 workspace・直下配置のフォールバック */
function resolveAssetPathWithFallback(projectRoot: string, stored: string): string {
    if (!stored) return ''
    if (path.isAbsolute(stored)) {
        return stored
    }
    const norm = stored.replace(/\\/g, '/').replace(/^\/+/, '')
    const candidates: string[] = []
    const add = (relPosix: string) => {
        const a = toAbs(projectRoot, relPosix)
        if (!candidates.includes(a)) candidates.push(a)
    }

    add(norm)

    if (norm.startsWith('assets/')) {
        const rest = norm.slice('assets/'.length)

        if (rest.startsWith('images/')) {
            const t = rest.slice('images/'.length)
            add(`assets/workspace/${t}`)
        }
        if (rest.startsWith('references/')) {
            const t = rest.slice('references/'.length)
            add(`assets/workspace/reference/${t}`)
            add(`assets/reference/${t}`)
        }
        if (rest.startsWith('dust/')) {
            const t = rest.slice('dust/'.length)
            add(`assets/workspace/_trash/${t}`)
            add(`assets/_trash/${t}`)
        }
        if (rest.startsWith('workspace/')) {
            const t = rest.slice('workspace/'.length)
            if (t.startsWith('reference/')) {
                add(`assets/references/${t.slice('reference/'.length)}`)
            } else if (t.startsWith('_trash/') || t === '_trash') {
                const sub = t.startsWith('_trash/') ? t.slice('_trash/'.length) : ''
                if (sub) add(`assets/dust/${sub}`)
            } else if (t.startsWith('composite/')) {
                add(`assets/images/composite/${t.slice('composite/'.length)}`)
            } else if (t.length > 0) {
                add(`assets/images/${t}`)
            }
        }
        if (rest.startsWith('_trash/')) {
            add(`assets/dust/${rest.slice('_trash/'.length)}`)
        }
        if (/^[^/]+\.(png|jpe?g|gif|webp)$/i.test(rest)) {
            add(`assets/images/${rest}`)
            add(`assets/workspace/${rest}`)
        }
    }

    for (const c of candidates) {
        if (fs.existsSync(c)) return c
    }
    return candidates[0] ?? toAbs(projectRoot, norm)
}

if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld('electron', {
            selectFolder: () => ipcRenderer.invoke('select-folder'),
            createProject: (path: string, name: string) => ipcRenderer.invoke('create-project', { path, name }),
            loadProject: (path: string) => ipcRenderer.invoke('load-project', path),
            saveProject: (path: string, data: unknown) => ipcRenderer.invoke('save-project', { path, data }),
            saveProjectSync: (path: string, data: unknown) => ipcRenderer.sendSync('save-project-sync', { path, data }),
            getTemplates: () => ipcRenderer.invoke('get-templates'),
            saveTemplate: (template: unknown) => ipcRenderer.invoke('save-template', template),
            deleteTemplate: (templateId: string) => ipcRenderer.invoke('delete-template', templateId),
            exportPNG: (path: string, name: string, data: string) => ipcRenderer.invoke('export-png', { path, name, data }),
            exportText: (path: string, data: string) => ipcRenderer.invoke('export-text', { path, data }),
            saveCompositePng: (projectPath: string, data: string) =>
                ipcRenderer.invoke('save-composite-png', { projectPath, data }),
            selectFile: () => ipcRenderer.invoke('select-file'),
            copyFileToProject: (projectPath: string, sourcePath: string, assetsSubPath?: string) =>
                ipcRenderer.invoke('copy-file-to-project', { projectPath, sourcePath, assetsSubPath }),
            startDragFile: (absolutePath: string) => ipcRenderer.send('start-drag-file', absolutePath),
            rembgRemoveBackground: (projectPath: string, inputRelativePath: string) =>
                ipcRenderer.invoke('rembg-remove-background', { projectPath, inputRelativePath }),
            saveWandPng: (projectPath: string, assetsSubPath: string, baseName: string, data: string) =>
                ipcRenderer.invoke('save-wand-png', { projectPath, assetsSubPath, baseName, data }),
            getCustomTones: () => ipcRenderer.invoke('get-custom-tones'),
            addCustomTone: (sourcePath: string, name: string) =>
                ipcRenderer.invoke('add-custom-tone', { sourcePath, name }),
            deleteCustomTone: (id: string) => ipcRenderer.invoke('delete-custom-tone', { id }),
            resolveCustomTone: (id: string) => ipcRenderer.invoke('resolve-custom-tone', { id }),
            getAssets: (projectPath: string) => ipcRenderer.invoke('get-assets', projectPath),
            deleteFile: (path: string) => ipcRenderer.invoke('delete-file', path),
            moveAssetToTrash: (projectPath: string, absoluteFilePath: string) =>
                ipcRenderer.invoke('move-asset-to-trash', { projectPath, absoluteFilePath }),
            pathToUrl: (p: string) => {
                if (!p || p.startsWith('data:') || p.startsWith('local-file://')) return p
                const encodedPath = encodeURI(p)
                const standardPath = encodedPath.startsWith('/') ? encodedPath : `/${encodedPath}`
                return `local-file://${standardPath}`
            },
            /** manga.json の assets/... 相対パス、またはレガシー絶対パスを実ファイルの絶対パスに解決 */
            resolveAssetPath: (projectRoot: string, stored: string) =>
                resolveAssetPathWithFallback(projectRoot, stored),
            getPathForFile: (file: File) => webUtils.getPathForFile(file),
            log: (level: string, ...args: any[]) => ipcRenderer.send('renderer-log', level, ...args),
            showMessage: (payload: { title?: string; message: string; type?: 'none' | 'info' | 'error' | 'warning' }) => ipcRenderer.invoke('show-message', payload),
            confirmMessage: (payload: { title?: string; message: string }) => ipcRenderer.invoke('confirm-message', payload)
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
        saveProjectSync: (path, data) => ipcRenderer.sendSync('save-project-sync', { path, data }),
        getTemplates: () => ipcRenderer.invoke('get-templates'),
        saveTemplate: (template) => ipcRenderer.invoke('save-template', template),
        deleteTemplate: (templateId) => ipcRenderer.invoke('delete-template', templateId),
        exportPNG: (path, name, data) => ipcRenderer.invoke('export-png', { path, name, data }),
        exportText: (path, data) => ipcRenderer.invoke('export-text', { path, data }),
        saveCompositePng: (projectPath, data) =>
            ipcRenderer.invoke('save-composite-png', { projectPath, data }),
        selectFile: () => ipcRenderer.invoke('select-file'),
        copyFileToProject: (projectPath, sourcePath, assetsSubPath) =>
            ipcRenderer.invoke('copy-file-to-project', { projectPath, sourcePath, assetsSubPath }),
        startDragFile: (absolutePath) => ipcRenderer.send('start-drag-file', absolutePath),
        rembgRemoveBackground: (projectPath, inputRelativePath) =>
            ipcRenderer.invoke('rembg-remove-background', { projectPath, inputRelativePath }),
        saveWandPng: (projectPath, assetsSubPath, baseName, data) =>
            ipcRenderer.invoke('save-wand-png', { projectPath, assetsSubPath, baseName, data }),
        getCustomTones: () => ipcRenderer.invoke('get-custom-tones'),
        addCustomTone: (sourcePath, name) =>
            ipcRenderer.invoke('add-custom-tone', { sourcePath, name }),
        deleteCustomTone: (id) => ipcRenderer.invoke('delete-custom-tone', { id }),
        resolveCustomTone: (id) => ipcRenderer.invoke('resolve-custom-tone', { id }),
        getAssets: (projectPath) => ipcRenderer.invoke('get-assets', projectPath),
        deleteFile: (path) => ipcRenderer.invoke('delete-file', path),
        moveAssetToTrash: (projectPath, absoluteFilePath) =>
            ipcRenderer.invoke('move-asset-to-trash', { projectPath, absoluteFilePath }),
        pathToUrl: (p) => {
            if (!p || p.startsWith('data:') || p.startsWith('local-file://')) return p
            const encodedPath = encodeURI(p)
            const standardPath = encodedPath.startsWith('/') ? encodedPath : `/${encodedPath}`
            return `local-file://${standardPath}`
        },
        resolveAssetPath: (projectRoot: string, stored: string) =>
            resolveAssetPathWithFallback(projectRoot, stored),
        getPathForFile: (file) => webUtils.getPathForFile(file),
        log: (level, ...args) => ipcRenderer.send('renderer-log', level, ...args),
        showMessage: (payload) => ipcRenderer.invoke('show-message', payload),
        confirmMessage: (payload) => ipcRenderer.invoke('confirm-message', payload)
    }
}
