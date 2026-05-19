#!/usr/bin/env node
/**
 * 配布版用の relocatable な Python を取得し、その Python に rembg[cpu] を入れる。
 *
 * 以前は `python3 -m venv --copies` で venv を作っていたが、venv の python はビルド機の
 * /Library/Frameworks/Python.framework/Versions/3.11/Python に絶対パスでリンクされるため、
 * 受け取った他 Mac で dyld エラーになり起動しなかった。
 *
 * 代わりに astral-sh/python-build-standalone の install_only tarball を resources に展開する。
 * これは relocatable な CPython 配布で、libpython・標準ライブラリも含み自己完結。
 *
 * 生成物は .gitignore され、DMG/インストーラ同梱前に 1 回実行する。
 */
import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as https from 'node:https'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

// python-build-standalone のリリースは日付タグ。固定して再現性を確保する。
// 上書きしたければ環境変数で。
const PBS_RELEASE = process.env.PBS_RELEASE || '20260510'
const PBS_PY_VERSION = process.env.PBS_PY_VERSION || '3.11.15'

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

function standaloneTriple() {
    if (process.platform === 'darwin') {
        return process.arch === 'arm64' ? 'aarch64-apple-darwin' : 'x86_64-apple-darwin'
    }
    if (process.platform === 'win32') {
        return process.arch === 'arm64' ? 'aarch64-pc-windows-msvc' : 'x86_64-pc-windows-msvc'
    }
    return process.arch === 'arm64' ? 'aarch64-unknown-linux-gnu' : 'x86_64-unknown-linux-gnu'
}

function standaloneAssetName() {
    return `cpython-${PBS_PY_VERSION}+${PBS_RELEASE}-${standaloneTriple()}-install_only.tar.gz`
}

function standaloneUrl() {
    return `https://github.com/astral-sh/python-build-standalone/releases/download/${PBS_RELEASE}/${standaloneAssetName()}`
}

const platformKey = bundledRembgPlatformKey()
const targetDir = path.join(root, 'resources', 'bundled-rembg', platformKey)
const pythonDir = path.join(targetDir, 'python')

if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true })
}

// 旧 venv 構造が残っていれば削除（古いビルド成果物の取り残し）
const legacyVenv = path.join(targetDir, 'venv')
if (fs.existsSync(legacyVenv)) {
    console.log(`[bundle-rembg] 旧 venv を削除: ${legacyVenv}`)
    fs.rmSync(legacyVenv, { recursive: true, force: true })
}
if (fs.existsSync(pythonDir)) {
    fs.rmSync(pythonDir, { recursive: true, force: true })
}

function run(cmd, args, opts = {}) {
    console.log(`[bundle-rembg] ${cmd} ${args.join(' ')}`)
    execFileSync(cmd, args, { stdio: 'inherit', cwd: root, ...opts })
}

function downloadTo(url, dest, depth = 0) {
    return new Promise((resolve, reject) => {
        if (depth > 5) {
            reject(new Error(`redirect が深すぎます: ${url}`))
            return
        }
        const req = https.get(url, { headers: { 'User-Agent': 'mangas-bundle-rembg' } }, (res) => {
            const status = res.statusCode || 0
            if (status >= 300 && status < 400 && res.headers.location) {
                res.resume()
                const next = new URL(res.headers.location, url).toString()
                downloadTo(next, dest, depth + 1).then(resolve, reject)
                return
            }
            if (status !== 200) {
                reject(new Error(`HTTP ${status} fetching ${url}`))
                res.resume()
                return
            }
            const total = Number(res.headers['content-length'] || 0)
            let received = 0
            let lastLog = 0
            res.on('data', (chunk) => {
                received += chunk.length
                if (total > 0 && Date.now() - lastLog > 1000) {
                    const pct = ((received / total) * 100).toFixed(1)
                    process.stderr.write(`\r[bundle-rembg] download: ${pct}%`)
                    lastLog = Date.now()
                }
            })
            const file = fs.createWriteStream(dest)
            res.pipe(file)
            file.on('finish', () => {
                file.close(() => {
                    process.stderr.write('\n')
                    resolve()
                })
            })
            file.on('error', reject)
        })
        req.on('error', reject)
    })
}

async function main() {
    const url = standaloneUrl()
    const tarballPath = path.join(targetDir, standaloneAssetName())
    if (fs.existsSync(tarballPath)) {
        fs.unlinkSync(tarballPath)
    }
    console.log(`[bundle-rembg] downloading: ${url}`)
    await downloadTo(url, tarballPath)

    // install_only tarball は `python/` ディレクトリをトップに含む
    run('tar', ['-xzf', tarballPath, '-C', targetDir])
    fs.unlinkSync(tarballPath)
    if (!fs.existsSync(pythonDir)) {
        throw new Error(`Python の展開に失敗: ${pythonDir}`)
    }

    const py =
        process.platform === 'win32'
            ? path.join(pythonDir, 'python.exe')
            : path.join(pythonDir, 'bin', 'python3')

    if (!fs.existsSync(py)) {
        throw new Error(`Python 実行ファイルが見つかりません: ${py}`)
    }

    // pip install。同梱 Python の site-packages に rembg と依存を入れる。
    run(py, ['-m', 'pip', 'install', '--upgrade', 'pip', 'wheel'])
    run(py, ['-m', 'pip', 'install', 'rembg[cpu]'])

    const invokeSrc = path.join(root, 'resources', 'bundled-rembg', 'invoke-rembg.py')
    const invokeDst = path.join(targetDir, 'invoke-rembg.py')
    if (!fs.existsSync(invokeSrc)) {
        throw new Error(`見つかりません: ${invokeSrc}`)
    }
    fs.copyFileSync(invokeSrc, invokeDst)

    console.log(`[bundle-rembg] 完了: ${targetDir}/python（isnet-anime 等は初回実行時にキャッシュされます）`)
}

main().catch((e) => {
    console.error(`[bundle-rembg] ${e?.message || e}`)
    process.exit(1)
})
