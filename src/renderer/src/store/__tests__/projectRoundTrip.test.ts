import { describe, it, expect, beforeEach } from 'vitest'
import { useMangaStore } from '../useMangaStore'
import type { MangaProjectData, Page, Panel } from '../types'

/**
 * 保存（getProjectData）と読み込み（setProjectData）の往復テスト。
 * manga.json に端末固有の絶対パスが混ざると、Git 同期した別マシンで画像が見つからなくなるため、
 * 「保存データに自分のプロジェクトルートが含まれない」ことを不変条件として固定する。
 */

const ROOT = '/Users/me/manga/proj'
const OTHER = '/Users/someone/else/proj' // 別マシンで保存されたデータ

function panel(id: string, base: string, overrides: Partial<Panel> = {}): Panel {
    return {
        id,
        type: 'rect',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        slant: 0,
        offsetB: 0,
        offsetC: 0,
        offsetD: 0,
        strokeWidth: 1,
        strokeColor: '#000000',
        imagePath: `${base}/assets/main.png`,
        protrudeImagePath: `${base}/assets/people.png`,
        mangaImagePath: `${base}/assets/manga.png`,
        mangaProtrudePath: `${base}/assets/manga_people.png`,
        backgroundImagePath: `${base}/assets/bg.png`,
        fgTonePath: `${base}/assets/tone.png`,
        ...overrides
    }
}

function page(id: string, base: string, overrides: Partial<Page> = {}): Page {
    return {
        id,
        name: 'ignored',
        panels: [panel(`${id}-a`, base)],
        bubbles: [],
        materials: [
            {
                id: `${id}-m`,
                imagePath: `${base}/assets/mat.png`,
                x: 0,
                y: 0,
                width: 10,
                height: 10
            } as Page['materials'][number]
        ],
        backgroundImagePath: `${base}/assets/page_bg.png`,
        ...overrides
    }
}

const ASSET_FIELDS = [
    'imagePath',
    'protrudeImagePath',
    'mangaImagePath',
    'mangaProtrudePath',
    'backgroundImagePath',
    'fgTonePath'
] as const

const load = (data: MangaProjectData): void => {
    useMangaStore.getState().setCurrentProject(ROOT)
    useMangaStore.getState().setProjectData(data)
}
const save = (): MangaProjectData => JSON.parse(JSON.stringify(useMangaStore.getState().getProjectData()))

describe('プロジェクトの保存・読み込み', () => {
    beforeEach(() => {
        useMangaStore.setState({ pages: [], archivedPages: [], currentPageId: null, past: [], future: [] })
    })

    it('別マシンの絶対パスで保存されたデータを読むと、すべての画像パスが相対パスになる', () => {
        load({ pages: [page('p1', OTHER)], archivedPages: [page('old', OTHER)] })
        const saved = save()
        for (const p of [...saved.pages, ...(saved.archivedPages ?? [])]) {
            for (const f of ASSET_FIELDS) expect(p.panels[0][f], f).toMatch(/^assets\//)
            expect(p.materials[0].imagePath).toBe('assets/mat.png')
            expect(p.backgroundImagePath).toBe('assets/page_bg.png')
        }
        expect(JSON.stringify(saved)).not.toContain(OTHER)
    })

    it('編集中に絶対パスが入っても、保存データには自分のルートの絶対パスが残らない', () => {
        load({ pages: [page('p1', 'X')] })
        const id = useMangaStore.getState().pages[0].panels[0].id
        useMangaStore.getState().updatePanel(id, panel(id, ROOT))
        const saved = save()
        expect(JSON.stringify(saved)).not.toContain(ROOT)
        for (const f of ASSET_FIELDS) expect(saved.pages[0].panels[0][f], f).toMatch(/^assets\//)
    })

    it('builtin:// と custom-tone:// はそのまま保持する', () => {
        load({
            pages: [
                page('p1', ROOT, {
                    backgroundImagePath: 'builtin://dots',
                    panels: [panel('a', ROOT, { backgroundImagePath: 'custom-tone://t1', fgTonePath: 'builtin://lines' })]
                })
            ]
        })
        const saved = save()
        expect(saved.pages[0].backgroundImagePath).toBe('builtin://dots')
        expect(saved.pages[0].panels[0].backgroundImagePath).toBe('custom-tone://t1')
        expect(saved.pages[0].panels[0].fgTonePath).toBe('builtin://lines')
    })

    it('.ora の元ファイル（プロジェクト外の参照）は絶対パスのまま保持する', () => {
        load({ pages: [page('p1', ROOT, { panels: [panel('a', ROOT, { oraSourcePath: '/Users/me/gousei/scene.ora' })] })] })
        expect(save().pages[0].panels[0].oraSourcePath).toBe('/Users/me/gousei/scene.ora')
    })

    it('保存→読み込み→保存で内容が変わらない（冪等）', () => {
        load({ pages: [page('p1', OTHER), page('p2', OTHER)], archivedPages: [page('old', OTHER)], manuscript: '原稿' })
        const first = save()
        load(first)
        expect(save()).toEqual(first)
    })

    it('ページ名は読み込み時に並び順で 001, 002… に振り直される', () => {
        load({ pages: [page('p1', ROOT, { name: 'x' }), page('p2', ROOT, { name: 'y' })] })
        expect(useMangaStore.getState().pages.map((p) => p.name)).toEqual(['001', '002'])
    })
})

describe('Assets整理（cleanupAssets）', () => {
    it('参照中の画像・合成画像・dust は移動せず、未参照の画像だけを dust へ移す', async () => {
        const electron = (window as unknown as { electron: Record<string, ReturnType<typeof import('vitest').vi.fn>> }).electron
        load({
            pages: [
                page('p1', ROOT, {
                    panels: [
                        panel('a', ROOT, {
                            novelai: { history: [{ relativePath: 'assets/images/novelai/a/1.png', seed: 1, createdAt: 0 }] }
                        })
                    ]
                })
            ]
        })
        const files = [
            'assets/main.png',
            'assets/people.png',
            'assets/manga.png',
            'assets/manga_people.png',
            'assets/tone.png',
            'assets/bg.png',
            'assets/mat.png',
            'assets/page_bg.png',
            'assets/images/novelai/a/1.png',
            'assets/composites/c.png',
            'assets/dust/old.png',
            'assets/images/unused.png'
        ].map((f) => `${ROOT}/${f}`)
        electron.getAssets.mockResolvedValueOnce(files)
        electron.moveAssetToTrash.mockClear()

        await useMangaStore.getState().cleanupAssets()

        const moved = electron.moveAssetToTrash.mock.calls.map((c) => c[1])
        expect(moved).toEqual([`${ROOT}/assets/images/unused.png`])
    })
})
