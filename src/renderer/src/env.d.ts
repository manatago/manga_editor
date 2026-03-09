declare global {
    interface Window {
        electron: {
            selectFolder: () => Promise<string | null>
            createProject: (path: string, name: string) => Promise<string>
            loadProject: (path: string) => Promise<any>
            saveProject: (path: string, data: any) => Promise<boolean>
            getTemplates: () => Promise<any[]>
            saveTemplate: (template: { name: string; panels: any[] }) => Promise<any[]>
            exportPNG: (path: string, name: string, data: string) => Promise<string>
            pathToUrl: (path: string) => string
            log: (level: string, ...args: any[]) => void
        }
    }
}

export { }
