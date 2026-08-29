import { ipcMain, safeStorage, app } from 'electron'
import { execFile } from 'node:child_process'
import { promises as fsp } from 'node:fs'
import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * 作品フォルダ（＝1作品1リポジトリ）を Git / セルフホスト LFS で同期するための IPC。
 * 設定の正はフォルダ内の本物の .git（remote）と .lfsconfig（LFS URL）。
 * GitHub は SSH 前提（鍵はマシン側）。LFS は Basic 認証を safeStorage 経由で非対話注入する。
 */

/** packaged Electron は PATH が最小になりがちなので git/git-lfs の場所を足す */
function gitEnv(extra?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    const extraPaths = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin']
    const current = process.env.PATH ?? ''
    const merged = [...extraPaths, ...current.split(':').filter(Boolean)]
    const seen = new Set<string>()
    const PATH = merged.filter((p) => (seen.has(p) ? false : (seen.add(p), true))).join(':')
    return {
        ...process.env,
        PATH,
        // 対話プロンプトで固まらせず、資格情報が無ければ即エラーにする
        GIT_TERMINAL_PROMPT: '0',
        GCM_INTERACTIVE: 'never',
        ...extra
    }
}

interface RunResult {
    code: number
    stdout: string
    stderr: string
}

/** git を cwd で実行し、失敗しても reject せず結果を返す */
function runGit(cwd: string, args: string[], stdin?: string): Promise<RunResult> {
    return new Promise((resolve) => {
        const child = execFile(
            'git',
            args,
            { cwd, env: gitEnv(), maxBuffer: 64 * 1024 * 1024 },
            (err, stdout, stderr) => {
                const code = err && typeof (err as { code?: unknown }).code === 'number' ? (err as { code: number }).code : err ? 1 : 0
                resolve({ code, stdout: stdout ?? '', stderr: stderr ?? '' })
            }
        )
        if (stdin !== undefined && child.stdin) {
            child.stdin.write(stdin)
            child.stdin.end()
        }
    })
}

function logOf(label: string, r: RunResult): string {
    const parts = [`$ git ${label}`]
    if (r.stdout.trim()) parts.push(r.stdout.trimEnd())
    if (r.stderr.trim()) parts.push(r.stderr.trimEnd())
    return parts.join('\n')
}

/** ログから LFS 認証の失敗を検知し、対処ヒントを返す（無ければ null） */
function authHint(log: string): string | null {
    if (/could not read Username|terminal prompts disabled|\b401\b|Authorization|credentials/i.test(log)) {
        return (
            '⚠ LFS の認証に失敗した可能性があります。\n' +
            '上の「接続設定」で LFS ユーザー名・パスワードを入力して「設定を保存」し、もう一度プッシュしてください。'
        )
    }
    return null
}

// ---- LFS 資格情報（safeStorage 暗号化、host 単位で保持） ------------------

const credFile = (): string => path.join(app.getPath('userData'), 'git-lfs-cred.enc')

type CredMap = Record<string, { username: string; password: string }>

function readCreds(): CredMap {
    try {
        const p = credFile()
        if (!fs.existsSync(p)) return {}
        const buf = fs.readFileSync(p)
        const json = safeStorage.isEncryptionAvailable()
            ? safeStorage.decryptString(buf)
            : buf.toString('utf-8')
        return JSON.parse(json) as CredMap
    } catch {
        return {}
    }
}

function writeCreds(map: CredMap): void {
    const json = JSON.stringify(map)
    const buf = safeStorage.isEncryptionAvailable()
        ? safeStorage.encryptString(json)
        : Buffer.from(json, 'utf-8')
    fs.writeFileSync(credFile(), buf)
}

// ---- 接続デフォルト（非機密: URL とユーザー名のみ、平文JSON） ----------------

const connFile = (): string => path.join(app.getPath('userData'), 'git-lfs-conn.json')

interface ConnDefaults {
    lfsUrl?: string
    remoteUrl?: string
    username?: string
}

function readConn(): ConnDefaults {
    try {
        const p = connFile()
        if (!fs.existsSync(p)) return {}
        return JSON.parse(fs.readFileSync(p, 'utf-8')) as ConnDefaults
    } catch {
        return {}
    }
}

function writeConn(patch: ConnDefaults): void {
    const next = { ...readConn(), ...patch }
    try {
        fs.writeFileSync(connFile(), JSON.stringify(next, null, 2))
    } catch {
        /* noop */
    }
}

/** URL から credential 照合用の {protocol, host(:port含む)} を取り出す */
function credKeyFromUrl(url: string): { protocol: string; host: string } | null {
    try {
        const u = new URL(url)
        return { protocol: u.protocol.replace(':', ''), host: u.host }
    } catch {
        return null
    }
}

/** repo の .lfsconfig から LFS url を読む */
async function readLfsUrl(projectPath: string): Promise<string> {
    try {
        const txt = await fsp.readFile(path.join(projectPath, '.lfsconfig'), 'utf-8')
        const m = txt.match(/url\s*=\s*(.+)/)
        return m ? m[1].trim() : ''
    } catch {
        return ''
    }
}

/** 保存済み資格情報を git credential store へ流し込み、LFS が非対話で使えるようにする */
async function seedLfsCredential(projectPath: string): Promise<void> {
    const lfsUrl = await readLfsUrl(projectPath)
    if (!lfsUrl) return
    const key = credKeyFromUrl(lfsUrl)
    if (!key) return
    const cred = readCreds()[key.host]
    if (!cred) return
    const input = `protocol=${key.protocol}\nhost=${key.host}\nusername=${cred.username}\npassword=${cred.password}\n\n`
    await runGit(projectPath, ['credential', 'approve'], input)
}

// ---- .gitattributes / .gitignore テンプレ --------------------------------

const GITATTRIBUTES = `# 画像・動画は Git LFS（セルフホスト）へ。SVG は XML 差分を読めるよう除外。
*.png   filter=lfs diff=lfs merge=lfs -text
*.jpg   filter=lfs diff=lfs merge=lfs -text
*.jpeg  filter=lfs diff=lfs merge=lfs -text
*.gif   filter=lfs diff=lfs merge=lfs -text
*.webp  filter=lfs diff=lfs merge=lfs -text
*.bmp   filter=lfs diff=lfs merge=lfs -text
*.tiff  filter=lfs diff=lfs merge=lfs -text
*.tif   filter=lfs diff=lfs merge=lfs -text
*.psd   filter=lfs diff=lfs merge=lfs -text
*.mp4   filter=lfs diff=lfs merge=lfs -text
*.mov   filter=lfs diff=lfs merge=lfs -text
*.webm  filter=lfs diff=lfs merge=lfs -text
`

const GITIGNORE = `.DS_Store
exports/
PR/
素材/
`

// ---- ステータス取得 -------------------------------------------------------

export interface GitStatus {
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

async function getStatus(projectPath: string): Promise<GitStatus> {
    const empty: GitStatus = {
        isRepo: false,
        branch: '',
        dirty: 0,
        ahead: 0,
        behind: 0,
        remoteUrl: '',
        lfsUrl: '',
        hasCred: false,
        lfsUsername: ''
    }
    const inside = await runGit(projectPath, ['rev-parse', '--is-inside-work-tree'])
    if (inside.code !== 0 || inside.stdout.trim() !== 'true') {
        // 未初期化: .lfsconfig があれば読み、無ければ接続デフォルトから host 単位の認証を引く
        empty.lfsUrl = await readLfsUrl(projectPath)
        const conn = readConn()
        const refUrl = empty.lfsUrl || conn.lfsUrl || ''
        const key = refUrl ? credKeyFromUrl(refUrl) : null
        const cred = key ? readCreds()[key.host] : undefined
        empty.hasCred = !!cred
        empty.lfsUsername = cred?.username ?? conn.username ?? ''
        return empty
    }
    const branchR = await runGit(projectPath, ['rev-parse', '--abbrev-ref', 'HEAD'])
    const branch = branchR.stdout.trim()
    const porcelain = await runGit(projectPath, ['status', '--porcelain'])
    const dirty = porcelain.stdout.split('\n').filter((l) => l.trim() !== '').length
    const remoteR = await runGit(projectPath, ['remote', 'get-url', 'origin'])
    const remoteUrl = remoteR.code === 0 ? remoteR.stdout.trim() : ''
    let ahead = 0
    let behind = 0
    const counts = await runGit(projectPath, ['rev-list', '--left-right', '--count', '@{u}...HEAD'])
    if (counts.code === 0) {
        const m = counts.stdout.trim().split(/\s+/)
        if (m.length === 2) {
            behind = parseInt(m[0], 10) || 0
            ahead = parseInt(m[1], 10) || 0
        }
    }
    const lfsUrl = await readLfsUrl(projectPath)
    const key = lfsUrl ? credKeyFromUrl(lfsUrl) : null
    const cred = key ? readCreds()[key.host] : undefined
    const hasCred = !!cred
    const lfsUsername = cred?.username ?? ''
    return { isRepo: true, branch, dirty, ahead, behind, remoteUrl, lfsUrl, hasCred, lfsUsername }
}

export function registerGitHandlers(): void {
    ipcMain.handle('git-repo-status', async (_, { projectPath }: { projectPath: string }) => {
        const cwd = String(projectPath ?? '').trim()
        if (!cwd || !fs.existsSync(cwd)) throw new Error('プロジェクトフォルダが見つかりません')
        return getStatus(cwd)
    })

    ipcMain.handle(
        'git-init-config',
        async (
            _,
            { projectPath, remoteUrl, lfsUrl }: { projectPath: string; remoteUrl: string; lfsUrl: string }
        ) => {
            const cwd = String(projectPath ?? '').trim()
            if (!cwd || !fs.existsSync(cwd)) throw new Error('プロジェクトフォルダが見つかりません')
            const remote = String(remoteUrl ?? '').trim()
            const lfs = String(lfsUrl ?? '').trim()
            if (!lfs) throw new Error('LFS の URL を入力してください')

            const logs: string[] = []
            const inside = await runGit(cwd, ['rev-parse', '--is-inside-work-tree'])
            if (inside.code !== 0 || inside.stdout.trim() !== 'true') {
                const init = await runGit(cwd, ['init'])
                logs.push(logOf('init', init))
            }

            // 設定ファイルを配置（既存は上書き）
            await fsp.writeFile(path.join(cwd, '.gitattributes'), GITATTRIBUTES, 'utf-8')
            await fsp.writeFile(path.join(cwd, '.lfsconfig'), `[lfs]\n\turl = ${lfs}\n`, 'utf-8')
            const giPath = path.join(cwd, '.gitignore')
            if (!fs.existsSync(giPath)) await fsp.writeFile(giPath, GITIGNORE, 'utf-8')

            const lfsInstall = await runGit(cwd, ['lfs', 'install', '--local'])
            logs.push(logOf('lfs install --local', lfsInstall))

            if (remote) {
                const hasOrigin = await runGit(cwd, ['remote', 'get-url', 'origin'])
                const setR =
                    hasOrigin.code === 0
                        ? await runGit(cwd, ['remote', 'set-url', 'origin', remote])
                        : await runGit(cwd, ['remote', 'add', 'origin', remote])
                logs.push(logOf('remote', setR))
            }

            // 初回コミット（何かステージできれば）
            const add = await runGit(cwd, ['add', '-A'])
            logs.push(logOf('add -A', add))
            const staged = await runGit(cwd, ['diff', '--cached', '--quiet'])
            if (staged.code !== 0) {
                const commit = await runGit(cwd, ['commit', '-m', 'init: 作品データ'])
                logs.push(logOf('commit', commit))
                await runGit(cwd, ['branch', '-M', 'main'])
            }

            writeConn({ lfsUrl: lfs, ...(remote ? { remoteUrl: remote } : {}) })
            const status = await getStatus(cwd)
            return { ok: true, log: logs.join('\n\n'), status }
        }
    )

    ipcMain.handle('git-conn-defaults', async () => readConn())

    ipcMain.handle(
        'git-push',
        async (_, { projectPath, message }: { projectPath: string; message?: string }) => {
            const cwd = String(projectPath ?? '').trim()
            if (!cwd || !fs.existsSync(cwd)) throw new Error('プロジェクトフォルダが見つかりません')
            const logs: string[] = []
            await seedLfsCredential(cwd)

            const add = await runGit(cwd, ['add', '-A'])
            if (add.stderr.trim()) logs.push(logOf('add -A', add))
            const staged = await runGit(cwd, ['diff', '--cached', '--quiet'])
            if (staged.code !== 0) {
                const msg = (message ?? '').trim() || `update ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`
                const commit = await runGit(cwd, ['commit', '-m', msg])
                logs.push(logOf('commit', commit))
            } else {
                logs.push('（コミットする変更はありません）')
            }

            const branchR = await runGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'])
            const branch = branchR.stdout.trim() || 'main'
            const upstream = await runGit(cwd, ['rev-parse', '--abbrev-ref', '@{u}'])
            const push =
                upstream.code === 0
                    ? await runGit(cwd, ['push'])
                    : await runGit(cwd, ['push', '-u', 'origin', branch])
            logs.push(logOf('push', push))

            const status = await getStatus(cwd)
            let log = logs.join('\n\n')
            if (push.code !== 0) {
                const hint = authHint(log)
                if (hint) log = hint + '\n\n' + log
            }
            return { ok: push.code === 0, log, status }
        }
    )

    ipcMain.handle('git-pull', async (_, { projectPath }: { projectPath: string }) => {
        const cwd = String(projectPath ?? '').trim()
        if (!cwd || !fs.existsSync(cwd)) throw new Error('プロジェクトフォルダが見つかりません')
        await seedLfsCredential(cwd)
        const pull = await runGit(cwd, ['pull', '--rebase'])
        const status = await getStatus(cwd)
        let log = logOf('pull --rebase', pull)
        if (pull.code !== 0) {
            const hint = authHint(log)
            if (hint) log = hint + '\n\n' + log
        }
        return { ok: pull.code === 0, log, status }
    })

    ipcMain.handle(
        'git-save-lfs-cred',
        async (
            _,
            { lfsUrl, username, password }: { lfsUrl: string; username: string; password: string }
        ) => {
            const key = credKeyFromUrl(String(lfsUrl ?? '').trim())
            if (!key) throw new Error('LFS の URL が不正です')
            const map = readCreds()
            const existing = map[key.host]
            const u = String(username ?? '').trim()
            const p = String(password ?? '')
            if (!u && !p) {
                delete map[key.host]
            } else {
                // パスワード欄が空なら既存を維持（ユーザー名/URLだけ更新するケース）
                const pass = p || existing?.password || ''
                map[key.host] = { username: u || existing?.username || '', password: pass }
            }
            writeCreds(map)
            writeConn({ lfsUrl: String(lfsUrl ?? '').trim(), username: u || existing?.username || '' })
            return { ok: true, host: key.host }
        }
    )
}
