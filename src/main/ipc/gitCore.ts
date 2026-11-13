import { execFile } from 'node:child_process'

/**
 * Git 実行の基本部品（Electron に依存しないのでテストから直接使える）。
 * IPC と認証まわりは git.ts。
 */

/** packaged Electron は PATH が最小になりがちなので git/git-lfs の場所を足す */
export function gitEnv(extra?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
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

export interface RunResult {
    code: number
    stdout: string
    stderr: string
}

/** git を cwd で実行し、失敗しても reject せず結果を返す */
export function runGit(cwd: string, args: string[], stdin?: string): Promise<RunResult> {
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

export function logOf(label: string, r: RunResult): string {
    const parts = [`$ git ${label}`]
    if (r.stdout.trim()) parts.push(r.stdout.trimEnd())
    if (r.stderr.trim()) parts.push(r.stderr.trimEnd())
    return parts.join('\n')
}

/**
 * 未コミットの変更があれば、すべてステージしてコミットする。
 * ok=false はコミットが必要なのに失敗したとき（ユーザー名未設定など）。
 */
export async function commitAllIfDirty(
    cwd: string,
    message: string
): Promise<{ ok: boolean; committed: boolean; logs: string[] }> {
    const logs: string[] = []
    const add = await runGit(cwd, ['add', '-A'])
    if (add.stderr.trim()) logs.push(logOf('add -A', add))
    if (add.code !== 0) return { ok: false, committed: false, logs }
    const staged = await runGit(cwd, ['diff', '--cached', '--quiet'])
    if (staged.code === 0) return { ok: true, committed: false, logs }
    const commit = await runGit(cwd, ['commit', '-m', message])
    logs.push(logOf('commit', commit))
    return { ok: commit.code === 0, committed: commit.code === 0, logs }
}

/**
 * 作業ツリーを指定コミットの内容に揃え、その状態を新しいコミットとして記録する（HEAD の履歴は巻き戻さない）。
 * 呼び出し前に commitAllIfDirty で未コミットの作業を退避しておくこと（ここでは作業ツリーを上書きする）。
 */
export async function restoreWorktreeTo(cwd: string, target: string): Promise<{ ok: boolean; changed: boolean; logs: string[] }> {
    const logs: string[] = []
    const read = await runGit(cwd, ['read-tree', '-u', '--reset', target])
    logs.push(logOf(`read-tree -u --reset ${target.slice(0, 8)}`, read))
    if (read.code !== 0) return { ok: false, changed: false, logs }
    // LFS 実体を念のため materialize（ローカルキャッシュ/サーバから）
    const lfsco = await runGit(cwd, ['lfs', 'checkout'])
    if (lfsco.stderr.trim()) logs.push(logOf('lfs checkout', lfsco))
    const staged = await runGit(cwd, ['diff', '--cached', '--quiet'])
    if (staged.code === 0) {
        logs.push('（現在すでにこの状態です。変更はありません）')
        return { ok: true, changed: false, logs }
    }
    const commit = await runGit(cwd, ['commit', '-m', `restore: ${target.slice(0, 8)} の状態に復元`])
    logs.push(logOf('commit', commit))
    return { ok: commit.code === 0, changed: true, logs }
}
