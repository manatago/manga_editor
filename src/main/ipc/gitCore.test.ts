import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { runGit, commitAllIfDirty, restoreWorktreeTo } from './gitCore'

/** 本物の git で一時リポジトリを作って検証する（ネットワーク・LFS サーバは使わない） */
let dir = ''
const git = (...args: string[]) => runGit(dir, args)
const write = (name: string, body: string) => fs.writeFileSync(path.join(dir, name), body)
const read = (name: string) => fs.readFileSync(path.join(dir, name), 'utf8')
const head = async () => (await git('rev-parse', 'HEAD')).stdout.trim()
const subjects = async () => (await git('log', '--format=%s')).stdout.trim().split('\n')

beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manga-git-'))
    await git('init', '-q', '-b', 'main')
    await git('config', 'user.name', 'test')
    await git('config', 'user.email', 'test@example.com')
    await git('config', 'commit.gpgsign', 'false')
    write('manga.json', 'v1')
    await git('add', '-A')
    await git('commit', '-q', '-m', 'v1')
})
afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
})

describe('commitAllIfDirty', () => {
    it('未コミットの変更（新規ファイル含む）をコミットする', async () => {
        write('manga.json', 'v2')
        write('new.png', 'x')
        const r = await commitAllIfDirty(dir, 'save')
        expect(r).toMatchObject({ ok: true, committed: true })
        expect((await git('status', '--porcelain')).stdout).toBe('')
        expect((await subjects())[0]).toBe('save')
    })

    it('変更がなければコミットしない', async () => {
        const before = await head()
        const r = await commitAllIfDirty(dir, 'save')
        expect(r).toMatchObject({ ok: true, committed: false })
        expect(await head()).toBe(before)
    })

    it('コミットできないとき（作者情報なし）は ok=false', async () => {
        // リポジトリ設定で作者を空にし、推測も禁止する（グローバル設定より優先される）
        await git('config', 'user.email', '')
        await git('config', 'user.name', '')
        await git('config', 'user.useConfigOnly', 'true')
        write('manga.json', 'v2')
        const res = await commitAllIfDirty(dir, 'save')
        expect(res.ok).toBe(false)
        expect(read('manga.json')).toBe('v2') // 作業は残っている
    })
})

describe('復元（退避コミット → restoreWorktreeTo）', () => {
    it('復元前の作業は退避コミットに残り、そこへ復元し直せる', async () => {
        const v1 = await head()
        write('manga.json', 'v2')
        await commitAllIfDirty(dir, 'v2')
        write('manga.json', 'v3 未コミットの作業')

        // 復元の手順（git.ts の git-restore-to と同じ）
        const backup = await commitAllIfDirty(dir, 'auto: 復元前の作業を保存')
        expect(backup.committed).toBe(true)
        const backupHash = await head()
        const restored = await restoreWorktreeTo(dir, v1)
        expect(restored).toMatchObject({ ok: true, changed: true })
        expect(read('manga.json')).toBe('v1')
        expect((await subjects()).slice(0, 2)).toEqual([`restore: ${v1.slice(0, 8)} の状態に復元`, 'auto: 復元前の作業を保存'])

        // 退避コミットへ復元し直すと、消えたはずの作業が戻る
        await restoreWorktreeTo(dir, backupHash)
        expect(read('manga.json')).toBe('v3 未コミットの作業')
    })

    it('復元先で消えるファイル・増えるファイルも反映する', async () => {
        const v1 = await head()
        write('later.png', 'x')
        await commitAllIfDirty(dir, 'add later')
        await restoreWorktreeTo(dir, v1)
        expect(fs.existsSync(path.join(dir, 'later.png'))).toBe(false)
    })

    it('すでに同じ状態ならコミットしない', async () => {
        const v1 = await head()
        const r = await restoreWorktreeTo(dir, v1)
        expect(r).toMatchObject({ ok: true, changed: false })
        expect(await head()).toBe(v1)
    })

    it('存在しないコミットは失敗し、作業ツリーを変えない', async () => {
        write('manga.json', 'v2')
        const r = await restoreWorktreeTo(dir, 'deadbeefdeadbeef')
        expect(r.ok).toBe(false)
        expect(read('manga.json')).toBe('v2')
    })
})
