import { contextBridge, ipcRenderer } from 'electron'

if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld('electron', {
            selectFolder: () => ipcRenderer.invoke('select-folder'),
            createProject: (path: string, name: string) => ipcRenderer.invoke('create-project', { path, name }),
            loadProject: (path: string) => ipcRenderer.invoke('load-project', path),
            saveProject: (path: string, data: any) => ipcRenderer.invoke('save-project', { path, data }),
            getTemplates: () => ipcRenderer.invoke('get-templates'),
            saveTemplate: (template: any) => ipcRenderer.invoke('save-template', template)
        })
    } catch (error) {
        console.error(error)
    }
} else {
    // @ts-ignore (define in dts)
    window.electron = {
        // Add APIs here
    }
}
