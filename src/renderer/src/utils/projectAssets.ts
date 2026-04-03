/**
 * 画像パスを manga.json 用に「プロジェクトルートからの相対パス」（例: assets/foo.png）へ揃える。
 * 旧データの絶対パスや、別マシンで assets/ 以降だけ一致する場合も可能な範囲で解決する。
 */
export function toRelativeAssetPath(projectRoot: string, stored: string | undefined): string | undefined {
    if (stored == null || stored === '') return undefined
    const trimmed = stored.trim()
    if (trimmed.startsWith('local-file://')) return undefined

    const root = projectRoot.replace(/[\\/]+$/, '')
    let p = trimmed.replace(/\\/g, '/')
    const normRoot = root.replace(/\\/g, '/')

    if (p.startsWith(normRoot + '/')) {
        return p.slice(normRoot.length + 1)
    }

    if (!p.includes(':') && !p.startsWith('/')) {
        return p.replace(/^\/+/, '')
    }

    if (p.startsWith('assets/')) {
        return p
    }

    const idx = p.indexOf('/assets/')
    if (idx >= 0) {
        return p.slice(idx + 1)
    }

    return stored
}

/** dust および旧ゴミ箱パス（未参照整理の移動先）。この配下は再整理の対象外 */
export function isAssetTrashRelativePath(rel: string): boolean {
    const n = rel.replace(/\\/g, '/')
    return (
        n === 'assets/dust' ||
        n.startsWith('assets/dust/') ||
        n === 'assets/_trash' ||
        n.startsWith('assets/_trash/') ||
        n === 'assets/workspace/_trash' ||
        n.startsWith('assets/workspace/_trash/')
    )
}

/** getAssets が返す絶対パスを、プロジェクトルートからの相対パス表現に揃える（比較用） */
export function physicalFileToRelative(projectRoot: string, fullPath: string): string {
    const root = projectRoot.replace(/\\/g, '/').replace(/\/$/, '')
    const f = fullPath.replace(/\\/g, '/')
    if (f.startsWith(root + '/')) {
        return f.slice(root.length + 1)
    }
    const idx = f.indexOf('/assets/')
    if (idx >= 0) {
        return f.slice(idx + 1)
    }
    return fullPath
}
