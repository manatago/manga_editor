import { describe, it, expect } from 'vitest'
import { toRelativeAssetPath, isAssetTrashRelativePath, physicalFileToRelative } from './projectAssets'

const ROOT = '/Users/me/manga/proj'

describe('toRelativeAssetPath', () => {
    it('プロジェクト内の絶対パスはルートからの相対パスにする', () => {
        expect(toRelativeAssetPath(ROOT, `${ROOT}/assets/a.png`)).toBe('assets/a.png')
        expect(toRelativeAssetPath(ROOT + '/', `${ROOT}/assets/sub/b.png`)).toBe('assets/sub/b.png')
    })

    it('すでに相対パスならそのまま（先頭スラッシュなし）', () => {
        expect(toRelativeAssetPath(ROOT, 'assets/a.png')).toBe('assets/a.png')
    })

    it('別マシンの絶対パスでも /assets/ 以降を取り出す（Git 同期した作品を開くケース）', () => {
        expect(toRelativeAssetPath(ROOT, '/Users/other/work/proj/assets/c.png')).toBe('assets/c.png')
    })

    it('Windows 形式のパスも扱える', () => {
        const winRoot = 'C:\\Users\\me\\proj'
        expect(toRelativeAssetPath(winRoot, 'C:\\Users\\me\\proj\\assets\\d.png')).toBe('assets/d.png')
        expect(toRelativeAssetPath(winRoot, 'D:\\elsewhere\\proj\\assets\\e.png')).toBe('assets/e.png')
    })

    it('空・未指定・local-file:// は undefined', () => {
        expect(toRelativeAssetPath(ROOT, undefined)).toBeUndefined()
        expect(toRelativeAssetPath(ROOT, '')).toBeUndefined()
        expect(toRelativeAssetPath(ROOT, 'local-file:///x/y.png')).toBeUndefined()
    })

    it('assets 外の絶対パスは解決できないので元の値を返す', () => {
        expect(toRelativeAssetPath(ROOT, '/tmp/x.png')).toBe('/tmp/x.png')
    })
})

describe('isAssetTrashRelativePath', () => {
    it('dust と旧ゴミ箱の配下を判定する', () => {
        expect(isAssetTrashRelativePath('assets/dust')).toBe(true)
        expect(isAssetTrashRelativePath('assets/dust/a.png')).toBe(true)
        expect(isAssetTrashRelativePath('assets\\_trash\\a.png')).toBe(true)
        expect(isAssetTrashRelativePath('assets/workspace/_trash/a.png')).toBe(true)
    })
    it('似た名前の通常フォルダは対象外', () => {
        expect(isAssetTrashRelativePath('assets/dusty/a.png')).toBe(false)
        expect(isAssetTrashRelativePath('assets/a.png')).toBe(false)
    })
})

describe('physicalFileToRelative', () => {
    it('ルート配下は相対化、それ以外は /assets/ 以降、どちらでもなければそのまま', () => {
        expect(physicalFileToRelative(ROOT, `${ROOT}/assets/a.png`)).toBe('assets/a.png')
        expect(physicalFileToRelative(ROOT, '/x/y/assets/b.png')).toBe('assets/b.png')
        expect(physicalFileToRelative(ROOT, '/x/y/c.png')).toBe('/x/y/c.png')
    })
})
