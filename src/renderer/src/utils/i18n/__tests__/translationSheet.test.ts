import { describe, it, expect } from 'vitest'
import type { Bubble, Page, Panel, MangaProjectData } from '../../../store/types'
import {
    buildTranslationSheet,
    parseTranslationSheet,
    applyTranslationSheet,
    flattenLines
} from '../translationSheet'
import { mapFontForLocale } from '../../../data/i18nFonts'

function bubble(partial: Partial<Bubble> & { id: string }): Bubble {
    return {
        type: 'normal',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        text: '',
        fontSize: 24,
        fontFamily: 'serif',
        lineHeight: 1.2,
        letterSpacing: 0,
        fontColor: '#000',
        fontWeight: 'normal',
        isVertical: true,
        backgroundColor: '#fff',
        backgroundOpacity: 1,
        borderColor: '#000',
        borderWidth: 1,
        opacity: 1,
        textOffsetX: 0,
        textOffsetY: 0,
        deformation: 0,
        ...partial
    } as Bubble
}

function panel(partial: Partial<Panel> & { id: string }): Panel {
    return { type: 'rect', x: 0, y: 0, width: 400, height: 400, rotation: 0, ...partial } as Panel
}

function page(id: string, panels: Panel[], bubbles: Bubble[]): Page {
    return { id, name: id, pageWidth: 840, pageHeight: 1188, panels, bubbles, materials: [] } as Page
}

describe('buildTranslationSheet（入れ子・読み順・注釈）', () => {
    it('コマ順(右上→左)→コマ内順で並べ、話者/宛先/注釈を引き継ぐ', () => {
        // 上段に右パネルP1・左パネルP2、下段に横長パネルP3
        const p1 = panel({ id: 'P1', x: 440, y: 0, width: 400, height: 500 })
        const p2 = panel({ id: 'P2', x: 0, y: 0, width: 400, height: 500 })
        const p3 = panel({ id: 'P3', x: 0, y: 520, width: 840, height: 600 })
        // P1 内は上→下に2つ（ひと続きの発話を分割した想定）
        const b1a = bubble({ id: 'b1a', panelId: 'P1', x: 600, y: 40, text: '前半', scriptSpeaker: '太郎' })
        const b1b = bubble({ id: 'b1b', panelId: 'P1', x: 600, y: 260, text: '後半' })
        const b2 = bubble({
            id: 'b2',
            panelId: 'P2',
            x: 100,
            y: 40,
            text: '左コマ',
            scriptAddressee: '昆虫',
            scriptNote: '独り言'
        })
        const b3 = bubble({ id: 'b3', panelId: 'P3', x: 400, y: 560, text: '下段' })
        const sheet = buildTranslationSheet([page('pg', [p1, p2, p3], [b1a, b1b, b2, b3])], {
            sourceName: '作品',
            locale: 'zh-Hans'
        })

        expect(sheet.pages).toHaveLength(1)
        const panels = sheet.pages[0].panels
        // コマ順: P1(右上)→P2(左上)→P3(下段)
        expect(panels.map((p) => p.panel)).toEqual([1, 2, 3])
        // P1 内は上→下
        expect(panels[0].lines.map((l) => l.id)).toEqual(['b1a', 'b1b'])
        // 注釈の引き継ぎ
        expect(panels[0].lines[0].speaker).toBe('太郎')
        expect(panels[1].lines[0].addressee).toBe('昆虫')
        expect(panels[1].lines[0].note).toBe('独り言')
        // 全体フラット順
        expect(flattenLines(sheet).map((l) => l.id)).toEqual(['b1a', 'b1b', 'b2', 'b3'])
    })

    it('テキストの無い吹き出し・コマは含めない', () => {
        const p1 = panel({ id: 'P1' })
        const sheet = buildTranslationSheet(
            [page('pg', [p1], [bubble({ id: 'x', panelId: 'P1', text: '  ' })])],
            { sourceName: 'a', locale: 'zh-Hans' }
        )
        expect(sheet.pages).toHaveLength(0)
    })
})

describe('parseTranslationSheet', () => {
    it('入れ子形式をパースできる', () => {
        const parsed = parseTranslationSheet({
            format: 'manga-i18n-sheet',
            version: 2,
            locale: 'zh-Hant',
            pages: [{ page: 1, panels: [{ panel: 1, lines: [{ id: 'a', source: 'x', target: '你好' }] }] }]
        })
        expect(parsed.locale).toBe('zh-Hant')
        expect(flattenLines(parsed)).toHaveLength(1)
        expect(flattenLines(parsed)[0].target).toBe('你好')
    })

    it('旧フラット形式(items)も後方互換で受け付ける', () => {
        const parsed = parseTranslationSheet({
            format: 'manga-i18n-sheet',
            locale: 'zh-Hans',
            items: [
                { id: 'a', page: 1, panel: 1, source: 'x', target: '甲' },
                { id: 'b', page: 1, panel: 2, source: 'y', target: '乙' }
            ]
        })
        expect(flattenLines(parsed).map((l) => l.id)).toEqual(['a', 'b'])
    })

    it('format 不一致や pages/items 欠如は例外', () => {
        expect(() => parseTranslationSheet({ format: 'other', pages: [] })).toThrow()
        expect(() => parseTranslationSheet(null)).toThrow()
        expect(() => parseTranslationSheet({ format: 'manga-i18n-sheet' })).toThrow()
    })
})

describe('applyTranslationSheet', () => {
    const data: MangaProjectData = {
        pages: [
            page('p1', [panel({ id: 'P1' })], [
                bubble({ id: 'a', panelId: 'P1', text: 'こんにちは', fontFamily: 'serif' }),
                bubble({ id: 'b', panelId: 'P1', text: '未訳のまま', fontFamily: "'Yomogi', cursive" })
            ])
        ],
        archivedPages: [page('arc', [], [bubble({ id: 'z', text: '保管', fontFamily: 'serif' })])],
        lastPageId: 'p1',
        referenceCharacters: [],
        backgroundLibrary: [],
        manuscript: ''
    }

    it('id 照合で訳文を差し替え、全吹き出しのフォントを中文へ写像し、原データは不変', () => {
        const sheet = parseTranslationSheet({
            format: 'manga-i18n-sheet',
            version: 2,
            locale: 'zh-Hans',
            pages: [{ page: 1, panels: [{ panel: 1, lines: [{ id: 'a', source: 'こんにちは', target: '你好' }] }] }]
        })
        const { data: out, stats } = applyTranslationSheet(data, sheet, 'zh-Hans')

        const b = out.pages[0].bubbles
        expect(b.find((x) => x.id === 'a')!.text).toBe('你好')
        expect(b.find((x) => x.id === 'b')!.text).toBe('未訳のまま')
        expect(b.find((x) => x.id === 'a')!.fontFamily).toContain('Songti SC')
        expect(b.find((x) => x.id === 'b')!.fontFamily).toContain('Hannotate SC')

        expect(stats.total).toBe(2)
        expect(stats.translated).toBe(1)
        expect(stats.missing).toBe(1)
        expect(stats.fontsChanged).toBeGreaterThanOrEqual(3)

        expect(data.pages[0].bubbles[0].text).toBe('こんにちは')
        expect(data.pages[0].bubbles[0].fontFamily).toBe('serif')
        expect(out.archivedPages![0].bubbles[0].fontFamily).toContain('Songti SC')
    })
})

describe('mapFontForLocale', () => {
    it('簡体/繁體で SC/TC を出し分ける', () => {
        expect(mapFontForLocale('serif', 'zh-Hans')).toContain('Songti SC')
        expect(mapFontForLocale('serif', 'zh-Hant')).toContain('Songti TC')
        expect(mapFontForLocale("'Yomogi', cursive", 'zh-Hant')).toContain('Hannotate TC')
    })
    it('未知フォントは既定(宋体)へ、既に中文なら冪等', () => {
        expect(mapFontForLocale('Foobar', 'zh-Hans')).toBe("'Songti SC', serif")
        expect(mapFontForLocale("'Songti SC', serif", 'zh-Hans')).toBe("'Songti SC', serif")
        expect(mapFontForLocale('', 'zh-Hans')).toBe('')
    })
})
