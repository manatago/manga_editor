#!/usr/bin/env node
/**
 * 現在の OS・アーキテクチャ用に resources/bundled-rembg/<platform>-<arch>/venv を作成し pip install rembg する。
 * 生成物は .gitignore され、DMG/インストーラ同梱前に 1 回実行する。
 */
import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

/** electron-builder の extraResources と同じキー（${os}-${arch}） */
function bundledRembgPlatformKey() {
    if (process.platform === 'darwin') {
        return process.arch === 'arm64' ? 'mac-arm64' : 'mac-x64'
    }
    if (process.platform === 'win32') {
        return `win-${process.arch}`
    }
    return `linux-${process.arch}`
}

const platformKey = bundledRembgPlatformKey()
const targetDir = path.join(root, 'resources', 'bundled-rembg', platformKey)

const wrapper =
    process.platform === 'win32'
        ? path.join(targetDir, 'rembg.cmd')
        : path.join(targetDir, 'rembg')

if (!fs.existsSync(wrapper)) {
    console.error(`[bundle-rembg] ラッパーが見つかりません: ${wrapper}`)
    console.error(`[bundle-rembg] 未対応の組み合わせかもしれません: ${platformKey}`)
    process.exit(1)
}

const venv = path.join(targetDir, 'venv')
if (fs.existsSync(venv)) {
    fs.rmSync(venv, { recursive: true, force: true })
}

function run(cmd, args, opts = {}) {
    console.log(`[bundle-rembg] ${cmd} ${args.join(' ')}`)
    execFileSync(cmd, args, { stdio: 'inherit', cwd: root, ...opts })
}

// macOS: 既定 venv は python3.11 → /Library/Frameworks/... への symlink になり、
// electron-builder 後の codesign --verify --strict が「bundle 外への symlink」で失敗する。
// --copies で実行ファイルを venv 内に複製する（DMG 同梱・署名用）。
if (process.platform === 'win32') {
    run('py', ['-3', '-m', 'venv', '--copies', venv])
    const pip = path.join(venv, 'Scripts', 'pip.exe')
    run(pip, ['install', '-U', 'pip', 'wheel'])
    run(pip, ['install', 'rembg[cpu]'])
} else {
    run('python3', ['-m', 'venv', '--copies', venv])
    const pip = path.join(venv, 'bin', 'pip')
    run(pip, ['install', '-U', 'pip', 'wheel'])
    run(pip, ['install', 'rembg[cpu]'])
}

const invokeSrc = path.join(root, 'resources', 'bundled-rembg', 'invoke-rembg.py')
const invokeDst = path.join(targetDir, 'invoke-rembg.py')
if (!fs.existsSync(invokeSrc)) {
    console.error(`[bundle-rembg] 見つかりません: ${invokeSrc}`)
    process.exit(1)
}
fs.copyFileSync(invokeSrc, invokeDst)

console.log(`[bundle-rembg] 完了: ${targetDir}/venv（isnet-anime 等は初回実行時にキャッシュされます）`)
