import type { PageTemplate } from './store/types'

declare global {
    interface Window {
        electron: {
            selectFolder: () => Promise<string | null>
            createProject: (path: string, name: string) => Promise<string>
            loadProject: (path: string) => Promise<any>
            saveProject: (path: string, data: unknown) => Promise<boolean>
            saveProjectSync: (path: string, data: unknown) => boolean
            getTemplates: () => Promise<PageTemplate[]>
            saveTemplate: (template: { name: string; panels: unknown[] }) => Promise<PageTemplate[]>
            deleteTemplate: (id: string) => Promise<PageTemplate[]>
            exportPNG: (path: string, name: string, data: string) => Promise<string>
            exportText: (path: string, data: string) => Promise<string>
            /** 合成ツール用: assets/composites/ に日時ファイル名で保存 */
            saveCompositePng: (projectPath: string, data: string) => Promise<{ relativePath: string }>
            selectFile: () => Promise<string | null>
            copyFileToProject: (projectPath: string, sourcePath: string, assetsSubPath?: string) => Promise<string>
            startDragFile: (absolutePath: string) => void
            /** rembg（isnet-anime 既定）で背景除去。出力は同フォルダの *_nobg.png */
            rembgRemoveBackground: (
                projectPath: string,
                inputRelativePath: string
            ) => Promise<{ relativePath: string }>
            /** マジックワンド編集後の PNG を assets/{assetsSubPath}/{baseName}_wand.png に保存 */
            saveWandPng: (
                projectPath: string,
                assetsSubPath: string,
                baseName: string,
                data: string
            ) => Promise<{ relativePath: string }>
            /** アプリ全体のカスタムトーン一覧（userData/custom-tones/） */
            getCustomTones: () => Promise<{ id: string; name: string; absolutePath: string }[]>
            addCustomTone: (sourcePath: string, name: string) => Promise<{ id: string; name: string; absolutePath: string }>
            deleteCustomTone: (id: string) => Promise<void>
            renameCustomTone: (id: string, name: string) => Promise<void>
            resolveCustomTone: (id: string) => Promise<string | null>
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
            /** NovelAI トークンを safeStorage で暗号化保存（空文字列は削除） */
            novelaiSaveToken: (token: string) => Promise<{ saved: boolean }>
            novelaiLoadToken: () => Promise<{ token: string }>
            novelaiClearToken: () => Promise<{ cleared: boolean }>
            /** NovelAI /user/subscription で疎通確認。token 省略時は保存済みを使用 */
            novelaiTestConnection: (token?: string) => Promise<
                | { ok: true; anlas: number; fixedAnlas: number; purchasedAnlas: number; tier: number | null; active: boolean | null }
                | { ok: false; error: 'token-missing' | 'network' | `http-${number}`; status?: number; message?: string }
            >
            /**
             * NovelAI 画像生成。
             * 既定では assets/images/novelai/<panelId>/ に保存。
             * outputSubPath（assets/ 配下のサブパス）を渡すとそちらに保存（参照キャラ用など）。
             */
            novelaiGenerate: (payload: {
                projectPath: string
                panelId?: string
                outputSubPath?: string
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
            }) => Promise<
                | { ok: true; relativePath: string; seed: number; width: number; height: number; createdAt: number }
                | { ok: false; error: string; status?: number; message?: string }
            >
            /**
             * 部分再描画（NovelAI infill）。塗ったマスク領域だけを再生成し、
             * 元コマと同じ assets/images/novelai/<panelId>/ に新しい画像として保存する。
             */
            novelaiInpaint: (payload: {
                projectPath: string
                panelId: string
                sourceRelativePath: string
                /** 白=再描画 の PNG マスク（data URL。サイズは元画像に一致） */
                maskBase64Png: string
                situationPrompt?: string
                supplementaryPrompt?: string
                /** 塗った範囲に効かせる追加タグ（任意） */
                inpaintPrompt?: string
                characterPrompts?: Array<{ prompt: string; uc?: string }>
                negativeOverride?: string
                seed?: number | null
            }) => Promise<
                | { ok: true; relativePath: string; seed: number; width: number; height: number; createdAt: number }
                | { ok: false; error: string; status?: number; message?: string }
            >
            /** 生成履歴を 1 件削除（assets/dust/ へ物理移動） */
            novelaiDeleteGeneration: (projectPath: string, relativePath: string) => Promise<
                | { moved: true; relativePath: string }
                | { moved: false; reason: 'missing' | 'invalid' | 'out-of-project' }
            >
        }
    }
}

export { }
