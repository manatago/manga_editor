#!/usr/bin/env node
/**
 * manga.json 内の imagePath をプロジェクトルートからの相対パス（assets/...）に変換する。
 * 使い方: node scripts/convert-manga-json-to-relative-assets.mjs /path/to/project/folder
 * （manga.json はそのフォルダ直下にあること）
 */
import fs from 'fs'
import path from 'path'

const projectRoot = process.argv[2]
if (!projectRoot) {
    console.error('Usage: node convert-manga-json-to-relative-assets.mjs <project-directory>')
    process.exit(1)
}

const jsonPath = path.join(projectRoot.trim(), 'manga.json')
if (!fs.existsSync(jsonPath)) {
    console.error('manga.json not found:', jsonPath)
    process.exit(1)
}

function toRelative(stored) {
    if (!stored) return stored
    const trimmed = String(stored).trim()
    if (trimmed.startsWith('local-file://')) return stored
    const norm = trimmed.replace(/\\/g, '/')
    if (!path.isAbsolute(trimmed)) {
        return norm
    }
    // フォルダ名の Unicode 正規化の違いで path.relative が失敗することがあるため、/assets/ 以降を優先
    const assetsIdx = norm.indexOf('/assets/')
    if (assetsIdx >= 0) {
        return norm.slice(assetsIdx + 1)
    }
    const rel = path.relative(projectRoot, trimmed)
    if (rel.startsWith('..')) {
        console.warn('Skip (outside project):', trimmed)
        return stored
    }
    return rel.split(path.sep).join('/')
}

const raw = fs.readFileSync(jsonPath, 'utf8')
const data = JSON.parse(raw)

for (const page of data.pages || []) {
    for (const panel of page.panels || []) {
        if (panel.imagePath) panel.imagePath = toRelative(panel.imagePath)
    }
    for (const mat of page.materials || []) {
        if (mat.imagePath) mat.imagePath = toRelative(mat.imagePath)
    }
}

fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8')
console.log('Updated:', jsonPath)
