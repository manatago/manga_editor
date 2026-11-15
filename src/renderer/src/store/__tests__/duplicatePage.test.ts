import { describe, it, expect, beforeEach } from 'vitest'
import { useMangaStore } from '../useMangaStore'
import { clonePageWithNewIds } from '../slices/pageSlice'
import type { Bubble, Material, Page, Panel } from '../types'

const panel = (id: string, extra: Partial<Panel> = {}): Panel => ({
    id, type: 'rect', x: 0, y: 0, width: 10, height: 10,
    slant: 0, offsetB: 0, offsetC: 0, offsetD: 0, strokeWidth: 1, strokeColor: '#000', ...extra
})
const source = (): Page => ({
    id: 'src',
    name: '002',
    backgroundColor: '#eeeeee',
    layoutName: '3段',
    panels: [panel('a', { imagePath: 'assets/images/a.png' }), panel('b')],
    bubbles: [
        { id: 'q1', panelId: 'a', text: 'セリフ1' } as Bubble,
        { id: 'q2', panelId: 'b', text: 'セリフ2' } as Bubble,
        { id: 'q3', text: 'コマ外' } as Bubble
    ],
    materials: [{ id: 'm1', panelId: 'b', imagePath: 'assets/images/m.png' } as Material],
    mosaics: [{ id: 'z1', x: 0, y: 0, width: 5, height: 5, type: 'pixel-12' }]
})

describe('clonePageWithNewIds', () => {
    it('すべての ID を振り直し、元のページと ID が重ならない', () => {
        const src = source()
        const dup = clonePageWithNewIds(src)
        const ids = (p: Page) => [p.id, ...p.panels.map((x) => x.id), ...p.bubbles.map((x) => x.id), ...p.materials.map((x) => x.id), ...(p.mosaics ?? []).map((x) => x.id)]
        const all = [...ids(src), ...ids(dup)]
        expect(new Set(all).size).toBe(all.length)
    })

    it('吹き出し・素材の所属コマを新しいコマ ID に付け替える（コマ外の吹き出しはそのまま）', () => {
        const dup = clonePageWithNewIds(source())
        const [a, b] = dup.panels
        expect(dup.bubbles.map((x) => x.panelId)).toEqual([a.id, b.id, undefined])
        expect(dup.materials[0].panelId).toBe(b.id)
    })

    it('中身（画像パス・セリフ・背景・レイアウト名）はそのまま。元のページは変更しない', () => {
        const src = source()
        const dup = clonePageWithNewIds(src)
        expect(dup.panels[0].imagePath).toBe('assets/images/a.png')
        expect(dup.bubbles.map((x) => x.text)).toEqual(['セリフ1', 'セリフ2', 'コマ外'])
        expect(dup.backgroundColor).toBe('#eeeeee')
        expect(dup.layoutName).toBe('3段')
        expect(src).toEqual(source())
    })

    it('保管日時（archivedAt）は引き継がない', () => {
        const dup = clonePageWithNewIds({ ...source(), archivedAt: 123 })
        expect(dup.archivedAt).toBeUndefined()
    })

    it('漫画化キャッシュ（panelId 固定名で上書き保存される）は引き継がない', () => {
        // 旧 panelId のキャッシュを共有すると、元コマの再焼きで複製側まで差し替わるため OFF で複製する
        const src = source()
        src.panels[0] = panel('a', {
            imagePath: 'assets/images/a.png',
            isManga: true,
            mangaImagePath: 'assets/manga/a_main.png',
            mangaProtrudePath: 'assets/manga/a_people.png',
            mangaLevel: 'mid',
            mangaStamp: 999
        })
        const dup = clonePageWithNewIds(src)
        const p = dup.panels[0]
        expect(p.imagePath).toBe('assets/images/a.png') // 元画像は残す
        expect(p.isManga).toBeUndefined()
        expect(p.mangaImagePath).toBeUndefined()
        expect(p.mangaProtrudePath).toBeUndefined()
        expect(p.mangaLevel).toBeUndefined()
        expect(p.mangaStamp).toBeUndefined()
        // 元ページは壊さない
        expect(src.panels[0].mangaImagePath).toBe('assets/manga/a_main.png')
    })
})

describe('duplicatePage', () => {
    beforeEach(() => {
        useMangaStore.setState({
            pages: [{ ...source(), id: 'p1', name: '001' }, source(), { ...source(), id: 'p3', name: '003' }],
            archivedPages: [],
            currentPageId: 'p1',
            selectedPanelId: 'a',
            past: [],
            future: []
        })
    })

    it('元のページの直後に挿入し、ページ番号を振り直して複製を表示する', () => {
        useMangaStore.getState().duplicatePage('src')
        const s = useMangaStore.getState()
        expect(s.pages.map((p) => p.name)).toEqual(['001', '002', '003', '004'])
        expect(s.pages[1].id).toBe('src')
        expect(s.pages[3].id).toBe('p3')
        expect(s.currentPageId).toBe(s.pages[2].id)
        expect(s.selectedPanelId).toBeNull()
    })

    it('Cmd+Z で複製前に戻る', () => {
        useMangaStore.getState().duplicatePage('src')
        useMangaStore.getState().undo()
        expect(useMangaStore.getState().pages.map((p) => p.id)).toEqual(['p1', 'src', 'p3'])
    })

    it('存在しないページ ID では何もしない', () => {
        const before = useMangaStore.getState().pages
        useMangaStore.getState().duplicatePage('nope')
        expect(useMangaStore.getState().pages).toBe(before)
    })
})
