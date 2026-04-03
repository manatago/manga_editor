declare global {
    interface Window {
        electron: {
            selectFolder: () => Promise<string | null>
            createProject: (path: string, name: string) => Promise<string>
            loadProject: (path: string) => Promise<any>
            saveProject: (path: string, data: unknown) => Promise<boolean>
            saveProjectSync: (path: string, data: unknown) => boolean
            getTemplates: () => Promise<any[]>
            saveTemplate: (template: { name: string; panels: unknown[] }) => Promise<any[]>
            deleteTemplate: (id: string) => Promise<any[]>
            exportPNG: (path: string, name: string, data: string) => Promise<string>
            /** 合成ツール用: assets/images/composite/ に日時ファイル名で保存 */
            saveCompositePng: (projectPath: string, data: string) => Promise<{ relativePath: string }>
            selectFile: () => Promise<string | null>
            copyFileToProject: (projectPath: string, sourcePath: string, assetsSubPath?: string) => Promise<string>
            startDragFile: (absolutePath: string) => void
            /** rembg（isnet-anime 既定）で背景除去。出力は同フォルダの *_nobg.png */
            rembgRemoveBackground: (
                projectPath: string,
                inputRelativePath: string
            ) => Promise<{ relativePath: string }>
            getAssets: (projectPath: string) => Promise<string[]>
            deleteFile: (path: string) => Promise<boolean>
            /** 未使用整理用: assets 内ファイルを assets/dust/ へ移動（削除しない） */
            moveAssetToTrash: (
                projectPath: string,
                absoluteFilePath: string
            ) => Promise<
                | { moved: true; relativePath: string }
                | { moved: false; reason: 'missing' | 'already-trash' }
            >
            pathToUrl: (path: string) => string
            /** manga.json の相対パス or 絶対パス → 実ファイルの絶対パス */
            resolveAssetPath: (projectRoot: string, stored: string) => string
            getPathForFile: (file: File) => string
            log: (level: string, ...args: any[]) => void
            showMessage: (payload: { title?: string; message: string; type?: 'none' | 'info' | 'error' | 'warning' }) => Promise<boolean>
            confirmMessage: (payload: { title?: string; message: string }) => Promise<boolean>
        }
    }
}

export { }
