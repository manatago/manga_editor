declare global {
    interface Window {
        electron: {
            selectFolder: () => Promise<string | null>
            createProject: (path: string, name: string) => Promise<string>
            loadProject: (path: string) => Promise<any>
            saveProject: (path: string, data: any) => Promise<boolean>
            getTemplates: () => Promise<any[]>
            saveTemplate: (template: { name: string; panels: any[] }) => Promise<any[]>
            deleteTemplate: (id: string) => Promise<any[]>
            exportPNG: (path: string, name: string, data: string) => Promise<string>
            selectFile: () => Promise<string | null>
            copyFileToProject: (projectPath: string, sourcePath: string) => Promise<string>
            getAssets: (projectPath: string) => Promise<string[]>
            deleteFile: (path: string) => Promise<boolean>
            pathToUrl: (path: string) => string
            getPathForFile: (file: File) => string
            log: (level: string, ...args: any[]) => void
        }
    }
}

export { }
