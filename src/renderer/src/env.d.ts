import type { PageTemplate } from './store/types'

declare global {
    interface GitRepoStatus {
        isRepo: boolean
        branch: string
        dirty: number
        ahead: number
        behind: number
        remoteUrl: string
        lfsUrl: string
        hasCred: boolean
        lfsUsername: string
    }

    interface GitConnDefaults {
        lfsUrl?: string
        remoteUrl?: string
        username?: string
    }

    interface GitCommit {
        hash: string
        short: string
        dateIso: string
        author: string
        subject: string
    }

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
            exportPNG: (path: string, name: string, data: string, format?: 'png' | 'jpeg') => Promise<string>
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
                | {
                      ok: true
                      // 永続トークン（pst-…）は残高を取得できないため null になりうる
                      anlas: number | null
                      fixedAnlas: number | null
                      purchasedAnlas: number | null
                      tier: number | null
                      active: boolean | null
                      /** 残高（Anlas）が取得できなかった（永続トークン等）。接続自体は有効。 */
                      balanceUnavailable?: boolean
                  }
                | { ok: false; error: 'token-missing' | 'token-invalid' | 'network' | `http-${number}`; status?: number; message?: string }
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
                aspect?: 'portrait' | 'square' | 'landscape' | 'wide' | 'tall'
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
                /** 背景（マスク領域）のぼかし強度 0..1。0 で無効。 */
                backgroundBlur?: number
            }) => Promise<
                | { ok: true; relativePath: string; seed: number; width: number; height: number; createdAt: number }
                | { ok: false; error: string; status?: number; message?: string }
            >
            /**
             * 背景マスク自動生成。rembg のアルファから「背景＝白(再描画)」の PNG マスク
             * （data URL）を作って返す。部分再描画(infill)に渡すと背景だけ描き直せる。
             */
            novelaiBackgroundMask: (
                projectPath: string,
                sourceRelativePath: string
            ) => Promise<
                | { ok: true; maskBase64Png: string; width: number; height: number }
                | { ok: false; error: string; message?: string }
            >
            /**
             * 外部画像をこのコマの生成履歴に取り込む。サイズを 64px グリッドへ正規化して
             * novelai/<panelId>/ に PNG 保存し、相対パスと正規化後サイズを返す。
             */
            novelaiImportImage: (
                projectPath: string,
                panelId: string,
                sourcePath: string
            ) => Promise<
                | { ok: true; relativePath: string; width: number; height: number }
                | { ok: false; error: string; message?: string }
            >
            /**
             * 前景（キャラ）切り抜き取得。rembg で背景を透過させた PNG を data URL で返す。
             * これを好きな背景（スクリーントーン等）に重ねて背景差し替え合成できる。
             */
            novelaiForegroundCutout: (
                projectPath: string,
                sourceRelativePath: string
            ) => Promise<
                | { ok: true; dataUrl: string; width: number; height: number }
                | { ok: false; error: string; message?: string }
            >
            /**
             * レンダラで合成した PNG（data URL）をこのコマの生成履歴フォルダに保存する。
             * NovelAI を介さず作った画像（トーン背景合成など）を履歴に載せる用途。
             */
            novelaiSaveImage: (
                projectPath: string,
                panelId: string,
                dataUrl: string
            ) => Promise<
                | { ok: true; relativePath: string; width: number; height: number; createdAt: number }
                | { ok: false; error: string; message?: string }
            >
            /** 生成履歴を 1 件削除（assets/dust/ へ物理移動） */
            novelaiDeleteGeneration: (projectPath: string, relativePath: string) => Promise<
                | { moved: true; relativePath: string }
                | { moved: false; reason: 'missing' | 'invalid' | 'out-of-project' }
            >
            /** 翻訳シート(JSON)を保存ダイアログで書き出す。返り値は保存パス（キャンセル時 null） */
            exportTranslationSheet: (defaultName: string, content: string) => Promise<string | null>
            /** 翻訳シート(JSON)を選択して中身を返す（キャンセル時 null） */
            selectTranslationSheet: () => Promise<{ path: string; content: string } | null>
            /** 翻訳版プロジェクトを元プロジェクトの隣に生成（assets コピー＋翻訳済み manga.json）。返り値は新フォルダの絶対パス */
            createLocalizedProject: (sourcePath: string, folderName: string, data: unknown) => Promise<string>
            /** 作品フォルダの Git/LFS 同期状態を取得 */
            gitRepoStatus: (projectPath: string) => Promise<GitRepoStatus>
            /** git init ＋ .gitattributes/.lfsconfig/.gitignore 配置 ＋ lfs install ＋ remote 設定 ＋ 初回コミット */
            gitInitConfig: (
                projectPath: string,
                remoteUrl: string,
                lfsUrl: string
            ) => Promise<{ ok: boolean; log: string; status: GitRepoStatus }>
            /** add -A → commit（変更あれば）→ push */
            gitPush: (
                projectPath: string,
                message: string
            ) => Promise<{ ok: boolean; log: string; status: GitRepoStatus }>
            /** pull --rebase */
            gitPull: (
                projectPath: string
            ) => Promise<{ ok: boolean; log: string; status: GitRepoStatus }>
            /** LFS Basic 認証を safeStorage に暗号化保存（空で削除） */
            gitSaveLfsCredential: (
                lfsUrl: string,
                username: string,
                password: string
            ) => Promise<{ ok: boolean; host: string }>
            /** 直近に使った接続デフォルト（LFS URL / GitHub URL / ユーザー名。パスワードは含まない） */
            gitConnDefaults: () => Promise<GitConnDefaults>
            /** 現在ブランチのコミット履歴 */
            gitLog: (
                projectPath: string,
                limit?: number
            ) => Promise<{ commits: GitCommit[]; headHash: string }>
            /** 選んだコミットの状態を新しいコミットとして復元（履歴は巻き戻さない） */
            gitRestoreTo: (
                projectPath: string,
                hash: string
            ) => Promise<{ ok: boolean; log: string; status: GitRepoStatus }>
        }
    }
}

export { }
