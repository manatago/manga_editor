/**
 * rembg CLI（isnet-anime 既定）で背景除去。
 * - パッケージ版: extraResources の同梱 rembg（venv）を最優先（MANGAS_REMBG / MANGAS_SKIP_BUNDLED_REMBG で上書き可）
 * - 開発時: 既定は PATH の rembg。MANGAS_USE_BUNDLED_REMBG=1 で resources/bundled-rembg/<platform>-<arch>/ を試行
 *
 * 環境変数:
 * - MANGAS_REMBG: rembg 実行ファイルの絶対パス（最優先）
 * - MANGAS_SKIP_BUNDLED_REMBG=1: 同梱版を使わない
 * - MANGAS_USE_BUNDLED_REMBG=1: 開発時も同梱ディレクトリを試す
 * - MANGAS_REMBG_MODEL: モデル名（既定 isnet-anime）
 */
import { spawn } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { app } from 'electron'

const DEFAULT_MODEL = 'birefnet-portrait'
const REMBG_TIMEOUT_MS = 10 * 60 * 1000

/**
 * path.resolve 後の candidate が dir 配下に収まるか（トラバーサル対策の多層防御）
 */
export function isResolvedPathInsideDir(dir: string, candidate: string): boolean {
    const base = path.resolve(dir)
    const resolved = path.resolve(candidate)
    if (resolved === base) {
        return true
    }
    const rel = path.relative(base, resolved)
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)
}

function rembgTailArgs(model: string, inputPath: string, outputPath: string): string[] {
    return ['i', '-m', model, inputPath, outputPath]
}

/** electron-builder の extraResources と同じディレクトリ名（${os}-${arch}） */
function devBundledRembgKey(): string {
    if (process.platform === 'darwin') {
        return process.arch === 'arm64' ? 'mac-arm64' : 'mac-x64'
    }
    if (process.platform === 'win32') {
        return `win-${process.arch}`
    }
    return `linux-${process.arch}`
}

/** 開発: cwd 基準。パッケージ: Resources/rembg */
function bundledRembgDir(): string {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, 'rembg')
    }
    return path.join(process.cwd(), 'resources', 'bundled-rembg', devBundledRembgKey())
}

function shouldUseBundledRembg(): boolean {
    if (process.env.MANGAS_SKIP_BUNDLED_REMBG === '1') {
        return false
    }
    return app.isPackaged || process.env.MANGAS_USE_BUNDLED_REMBG === '1'
}

/** bundle-rembg が targetDir にコピー。未実行時は親 bundled-rembg のみにある */
function resolveInvokeRembgScript(bundledDir: string): string | null {
    const beside = path.join(bundledDir, 'invoke-rembg.py')
    if (fs.existsSync(beside)) {
        return beside
    }
    const parent = path.join(path.dirname(bundledDir), 'invoke-rembg.py')
    if (fs.existsSync(parent)) {
        return parent
    }
    return null
}

/**
 * venv/bin/rembg の shebang はビルド機の絶対パスになり .app 移動後に壊れる。
 * 同梱 venv の python にスクリプトパスを渡して実行する（shebang を使わない）。
 */
function bundledRembgCandidates(dir: string, tail: string[]): { command: string; args: string[] }[] {
    const out: { command: string; args: string[] }[] = []
    const invoke = resolveInvokeRembgScript(dir)

    if (process.platform === 'win32') {
        const py = path.join(dir, 'venv', 'Scripts', 'python.exe')
        if (fs.existsSync(py)) {
            if (invoke) {
                out.push({ command: py, args: [invoke, ...tail] })
            }
        }
        const cmd = path.join(dir, 'rembg.cmd')
        if (fs.existsSync(cmd)) {
            out.push({ command: cmd, args: tail })
        }
        const exe = path.join(dir, 'rembg.exe')
        if (fs.existsSync(exe)) {
            out.push({ command: exe, args: tail })
        }
        return out
    }

    let py: string | null = null
    for (const name of ['python3', 'python3.11', 'python'] as const) {
        const candidate = path.join(dir, 'venv', 'bin', name)
        if (fs.existsSync(candidate)) {
            py = candidate
            break
        }
    }
    if (py) {
        if (invoke) {
            out.push({ command: py, args: [invoke, ...tail] })
        }
        const legacyScript = path.join(dir, 'venv', 'bin', 'rembg')
        if (fs.existsSync(legacyScript)) {
            out.push({ command: py, args: [legacyScript, ...tail] })
        }
    }
    const sh = path.join(dir, 'rembg')
    if (fs.existsSync(sh)) {
        out.push({ command: sh, args: tail })
    }
    return out
}

function buildCandidates(model: string, inputPath: string, outputPath: string): { command: string; args: string[] }[] {
    const tail = rembgTailArgs(model, inputPath, outputPath)
    const list: { command: string; args: string[] }[] = []
    const custom = process.env.MANGAS_REMBG?.trim()
    if (custom) {
        list.push({ command: custom, args: tail })
    }
    if (shouldUseBundledRembg()) {
        for (const c of bundledRembgCandidates(bundledRembgDir(), tail)) {
            list.push(c)
        }
    }
    list.push({ command: 'rembg', args: tail })
    list.push({ command: 'python3', args: ['-m', 'rembg', ...tail] })
    list.push({ command: 'python', args: ['-m', 'rembg', ...tail] })
    if (process.platform === 'win32') {
        list.push({ command: 'py', args: ['-3', '-m', 'rembg', ...tail] })
        list.push({ command: 'py', args: ['-m', 'rembg', ...tail] })
    }
    return list
}

function runSpawn(command: string, args: string[]): Promise<{ code: number | null; stderr: string }> {
    const lower = command.toLowerCase()
    const useShell =
        process.platform === 'win32' && (lower.endsWith('.cmd') || lower.endsWith('.bat'))
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env },
            shell: useShell,
            // CWD をシステム一時ディレクトリに固定し、プロジェクトルートの
            // coverage/ ディレクトリ等が Python のモジュール検索パスに混入するのを防ぐ
            cwd: os.tmpdir()
        })
        let stderr = ''
        child.stderr?.on('data', (chunk: Buffer) => {
            stderr += chunk.toString()
        })
        const t = setTimeout(() => {
            child.kill('SIGTERM')
            reject(new Error(`rembg が ${REMBG_TIMEOUT_MS / 1000} 秒以内に終了しませんでした`))
        }, REMBG_TIMEOUT_MS)
        child.on('error', (err: NodeJS.ErrnoException) => {
            clearTimeout(t)
            reject(err)
        })
        child.on('close', (code) => {
            clearTimeout(t)
            resolve({ code, stderr })
        })
    })
}

export async function runRembgToFile(inputPath: string, outputPath: string): Promise<void> {
    const model = process.env.MANGAS_REMBG_MODEL?.trim() || DEFAULT_MODEL
    const inAbs = path.resolve(inputPath)
    const outAbs = path.resolve(outputPath)
    if (!fs.existsSync(inAbs)) {
        throw new Error('入力画像が見つかりません')
    }
    const outDir = path.dirname(outAbs)
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true })
    }
    if (fs.existsSync(outAbs)) {
        fs.unlinkSync(outAbs)
    }

    const candidates = buildCandidates(model, inAbs, outAbs)
    let lastMessage = ''

    for (const { command, args } of candidates) {
        try {
            const { code, stderr } = await runSpawn(command, args)
            if (code === 0 && fs.existsSync(outAbs)) {
                return
            }
            lastMessage = stderr.trim() || `終了コード ${code}`
        } catch (e) {
            const err = e as NodeJS.ErrnoException
            if (err.code === 'ENOENT') {
                lastMessage = `コマンドが見つかりません: ${command}`
                continue
            }
            // EACCES 等も次の候補（別インタプリタ）を試す。最終的にすべて失敗すれば下で throw
            lastMessage = `${command}: ${err.message || String(e)}`
            continue
        }
    }

    throw new Error(
        `rembg の実行に失敗しました。配布版では npm run bundle-rembg 済みか確認してください。開発時は pip install rembg または PATH を確認してください。\n${lastMessage}`
    )
}

/** プロジェクトの assets 以下の入力に対し、同じディレクトリへの _nobg.png 出力パスを決める */
export function resolveReferenceRembgPaths(
    projectRoot: string,
    inputRelativePosix: string
): { inputAbs: string; outputAbs: string } {
    const root = path.resolve(projectRoot.trim())
    const rel = String(inputRelativePosix).replace(/\\/g, '/').replace(/^\/+/, '')
    if (!rel || rel.includes('..') || !rel.startsWith('assets/')) {
        throw new Error('参照画像のパスが不正です')
    }
    const inputAbs = path.resolve(path.join(root, rel.split('/').join(path.sep)))
    const assetsRoot = path.resolve(path.join(root, 'assets'))
    if (!isResolvedPathInsideDir(assetsRoot, inputAbs)) {
        throw new Error('参照画像はプロジェクトの assets 内である必要があります')
    }
    if (!fs.existsSync(inputAbs)) {
        throw new Error('入力画像が見つかりません')
    }
    const dir = path.dirname(inputAbs)
    const base = path.basename(inputAbs, path.extname(inputAbs))
    let outputAbs = path.join(dir, `${base}_nobg.png`)
    if (fs.existsSync(outputAbs)) {
        outputAbs = path.join(dir, `${base}_nobg_${Date.now()}.png`)
    }
    if (!isResolvedPathInsideDir(assetsRoot, outputAbs)) {
        throw new Error('出力パスが assets 外になりました')
    }
    return { inputAbs, outputAbs }
}

export function toProjectRelativePath(projectRoot: string, absolutePath: string): string {
    const root = path.resolve(projectRoot.trim())
    const abs = path.resolve(absolutePath)
    const rel = path.relative(root, abs)
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
        throw new Error('出力パスがプロジェクト外です')
    }
    return rel.split(path.sep).join('/')
}
