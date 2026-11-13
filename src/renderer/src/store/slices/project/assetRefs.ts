import type { BackgroundLibraryImage, Page, ReferenceCharacter } from '../../types'
import { toRelativeAssetPath } from '../../../utils/projectAssets'

const PROTOCOL_RE = /^[a-z-]+:\/\//i

/**
 * 漫画データから参照されている assets 内ファイルを、プロジェクトルートからの相対パスで集める。
 * 「Assets整理」はここに含まれないファイルを dust へ移すため、参照を持つ項目を追加したら必ずここにも足すこと。
 */
export function collectReferencedAssetPaths(
    projectRoot: string,
    data: {
        pages: Page[]
        archivedPages?: Page[]
        referenceCharacters?: ReferenceCharacter[]
        backgroundLibrary?: BackgroundLibraryImage[]
    }
): Set<string> {
    const refs = new Set<string>()
    const add = (p: string | undefined | null): void => {
        if (!p || PROTOCOL_RE.test(p)) return // builtin:// custom-tone:// など
        refs.add(toRelativeAssetPath(projectRoot, p) ?? p)
    }

    // 保管ページ（アーカイブ）の画像も「使用中」として保護する
    for (const page of [...data.pages, ...(data.archivedPages ?? [])]) {
        add(page.backgroundImagePath)
        for (const panel of page.panels) {
            add(panel.imagePath)
            add(panel.protrudeImagePath)
            add(panel.mangaImagePath)
            add(panel.mangaProtrudePath)
            add(panel.backgroundImagePath)
            add(panel.fgTonePath)
            for (const h of panel.novelai?.history ?? []) add(h.relativePath)
            for (const r of panel.novelai?.preciseRefs ?? []) {
                if (r.source === 'composite') add(r.id)
            }
        }
        for (const m of page.materials ?? []) add(m.imagePath)
    }
    for (const ch of data.referenceCharacters ?? []) {
        for (const im of ch.images) add(im.relativePath)
    }
    for (const bg of data.backgroundLibrary ?? []) add(bg.relativePath)
    return refs
}

/**
 * データからの参照に関係なく整理対象外にするフォルダ。
 * 合成画像はギャラリーがフォルダの中身を一覧表示する作りのため、コマ未使用でも消してはいけない。
 */
export function isProtectedAssetDir(rel: string): boolean {
    const n = rel.replace(/\\/g, '/')
    return n.startsWith('assets/composites/')
}
