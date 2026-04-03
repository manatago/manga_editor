#!/usr/bin/env node
/**
 * assets を「images / dust / references」の3フォルダ構成に揃え、manga.json のパスを書き換える。
 * - 旧 assets/workspace/ … 中身を分割して移動
 * - assets 直下の画像ファイル … images へ
 *
 * 使い方: node scripts/migrate-assets-layout.mjs "/path/to/project"
 */
import fs from 'node:fs'
import path from 'node:path'

const projectRoot = process.argv[2]
if (!projectRoot) {
    console.error('Usage: node scripts/migrate-assets-layout.mjs <projectRoot>')
    process.exit(1)
}

const root = path.resolve(projectRoot.trim())
const mangaPath = path.join(root, 'manga.json')
const assetsDir = path.join(root, 'assets')
const imagesDir = path.join(assetsDir, 'images')
const dustDir = path.join(assetsDir, 'dust')
const referencesDir = path.join(assetsDir, 'references')
const workspaceDir = path.join(assetsDir, 'workspace')

if (!fs.existsSync(mangaPath)) {
    console.error('manga.json が見つかりません:', mangaPath)
    process.exit(1)
}

function ensureDir(d) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true })
}

function moveDirContents(srcDir, destParent) {
    if (!fs.existsSync(srcDir)) return
    ensureDir(destParent)
    for (const name of fs.readdirSync(srcDir)) {
        const from = path.join(srcDir, name)
        const to = path.join(destParent, name)
        if (fs.existsSync(to)) {
            console.error('移動先が既に存在するため中止:', to)
            process.exit(1)
        }
        fs.renameSync(from, to)
    }
    fs.rmSync(srcDir, { recursive: true, force: true })
}

if (fs.existsSync(assetsDir)) {
    ensureDir(imagesDir)
    ensureDir(dustDir)
    ensureDir(referencesDir)

    if (fs.existsSync(workspaceDir)) {
        const compositeSrc = path.join(workspaceDir, 'composite')
        const compositeDest = path.join(imagesDir, 'composite')
        moveDirContents(compositeSrc, compositeDest)

        const trashSrc = path.join(workspaceDir, '_trash')
        moveDirContents(trashSrc, dustDir)

        const refSrc = path.join(workspaceDir, 'reference')
        moveDirContents(refSrc, referencesDir)

        for (const name of fs.readdirSync(workspaceDir)) {
            const from = path.join(workspaceDir, name)
            const to = path.join(imagesDir, name)
            if (fs.existsSync(to)) {
                console.error('移動先が既に存在するため中止:', to)
                process.exit(1)
            }
            fs.renameSync(from, to)
            console.log('移動:', 'workspace/' + name, '→ images/' + name)
        }
        fs.rmSync(workspaceDir, { recursive: true, force: true })
        console.log('assets/workspace を解消しました')
    }

    const reserved = new Set(['images', 'dust', 'references', 'workspace'])
    for (const name of fs.readdirSync(assetsDir)) {
        if (reserved.has(name)) continue
        const p = path.join(assetsDir, name)
        const st = fs.statSync(p)
        if (st.isFile() && /\.(png|jpe?g|gif|webp)$/i.test(name)) {
            const to = path.join(imagesDir, name)
            if (fs.existsSync(to)) {
                console.error('移動先が既に存在するため中止:', to)
                process.exit(1)
            }
            fs.renameSync(p, to)
            console.log('移動:', name, '→ images/' + name)
        }
    }
}

function rewritePathString(s) {
    if (typeof s !== 'string') return s
    const n = s.replace(/\\/g, '/')
    if (!n.startsWith('assets/')) return s
    if (n.startsWith('builtin://') || n.startsWith('data:') || n.startsWith('local-file://')) return s

    const rules = [
        ['assets/workspace/reference/', 'assets/references/'],
        ['assets/workspace/_trash/', 'assets/dust/'],
        ['assets/workspace/composite/', 'assets/images/composite/'],
        ['assets/workspace/', 'assets/images/'],
        ['assets/reference/', 'assets/references/']
    ]
    for (const [from, to] of rules) {
        if (n.startsWith(from)) {
            return to + n.slice(from.length)
        }
    }
    return s
}

function rewriteJsonValue(v) {
    if (typeof v === 'string') return rewritePathString(v)
    if (Array.isArray(v)) return v.map(rewriteJsonValue)
    if (v && typeof v === 'object') {
        const out = {}
        for (const [k, val] of Object.entries(v)) {
            out[k] = rewriteJsonValue(val)
        }
        return out
    }
    return v
}

const raw = fs.readFileSync(mangaPath, 'utf8')
const data = JSON.parse(raw)
const next = rewriteJsonValue(data)
fs.writeFileSync(mangaPath, JSON.stringify(next, null, 2), 'utf8')
console.log('manga.json を images/dust/references 前提のパスに更新しました:', mangaPath)
