import type { MangaProjectData, Page, Bubble, Panel } from '../../store/types'
import { mapFontForLocale, type TargetLocale } from '../../data/i18nFonts'

/** 1行＝1吹き出し。id が吹き出しと1:1に対応する安定キー。 */
export interface TranslationSheetLine {
    id: string
    /** 話者（台本モードの scriptSpeaker）。訳し分けの手がかり */
    speaker: string
    /** 宛先（誰/何に向けたセリフか）。台本モードの注釈 */
    addressee: string
    /** ニュアンス注釈（言い回し・含意）。台本モードの注釈 */
    note: string
    /** 原文（変更しない） */
    source: string
    /** 訳文（ここを埋める。空なら未訳扱い） */
    target: string
}

/** 1コマ（パネル）。lines は読み順。連続した行は「同じコマ内のひと続きの発話」の可能性が高い。 */
export interface TranslationSheetPanel {
    /** コマの読み順番号（同ページ内。0 は枠外＝コマ外） */
    panel: number
    lines: TranslationSheetLine[]
}

export interface TranslationSheetPage {
    page: number
    panels: TranslationSheetPanel[]
}

export interface TranslationSheet {
    format: 'manga-i18n-sheet'
    version: 2
    sourceName: string
    locale: TargetLocale
    note: string
    /** ページ→コマ→行 の入れ子。読み順で並ぶ。 */
    pages: TranslationSheetPage[]
}

export const SHEET_FORMAT = 'manga-i18n-sheet'

interface Box {
    x: number
    y: number
    w: number
    h: number
}
const panelBox = (p: Panel): Box => ({ x: p.x, y: p.y, w: p.width, h: p.height })
const bubbleBox = (b: Bubble): Box => ({ x: b.x, y: b.y, w: b.width, h: b.height })

/**
 * 縦書き漫画の読み順で並べる汎用ソート: 上のタイア（行）から順に、行内は右→左。
 * 行の判定は「直前の行の縦範囲と、次要素の縦範囲が過半重なるか」で行う（矩形サイズに依存しない）。
 */
function orderByReadingRows<T>(items: T[], box: (t: T) => Box): T[] {
    if (items.length <= 1) return [...items]
    const sorted = [...items].sort((a, b) => box(a).y - box(b).y)
    const rows: { top: number; bottom: number; items: T[] }[] = []
    for (const it of sorted) {
        const b = box(it)
        const top = b.y
        const bottom = b.y + b.h
        const last = rows[rows.length - 1]
        if (last) {
            const overlap = Math.min(last.bottom, bottom) - Math.max(last.top, top)
            const thr = 0.5 * Math.min(last.bottom - last.top, b.h)
            if (overlap > thr) {
                last.items.push(it)
                last.top = Math.min(last.top, top)
                last.bottom = Math.max(last.bottom, bottom)
                continue
            }
        }
        rows.push({ top, bottom, items: [it] })
    }
    const out: T[] = []
    for (const r of rows) {
        r.items.sort((a, b) => box(b).x + box(b).w / 2 - (box(a).x + box(a).w / 2))
        out.push(...r.items)
    }
    return out
}

/**
 * ページ内のテキスト吹き出しを「コマ読み順 → コマ内読み順（右上→左下）」でグルーピングして返す。
 * コマ所属は panelId 優先、無ければ中心座標の内包で判定、どれにも入らなければ枠外(panel:0)。
 * テキストの無いコマ・吹き出しは含めない。
 */
function collectPanels(page: Page): { panel: number; bubbles: Bubble[] }[] {
    const panels = page.panels ?? []
    const orderedPanels = orderByReadingRows(panels, panelBox)
    const panelNoById = new Map<string, number>()
    orderedPanels.forEach((p, i) => panelNoById.set(p.id, i + 1))

    const textBubbles = (page.bubbles ?? []).filter((b) => (b.text ?? '').trim() !== '')

    const panelNoOf = (b: Bubble): number => {
        if (b.panelId && panelNoById.has(b.panelId)) return panelNoById.get(b.panelId)!
        const cx = b.x + b.width / 2
        const cy = b.y + b.height / 2
        const hit = orderedPanels.find(
            (p) => cx >= p.x && cx <= p.x + p.width && cy >= p.y && cy <= p.y + p.height
        )
        return hit ? panelNoById.get(hit.id)! : 0
    }

    const groups: { panel: number; bubbles: Bubble[] }[] = []
    orderedPanels.forEach((_p, i) => {
        const no = i + 1
        const inPanel = orderByReadingRows(
            textBubbles.filter((b) => panelNoOf(b) === no),
            bubbleBox
        )
        if (inPanel.length) groups.push({ panel: no, bubbles: inPanel })
    })
    const floating = orderByReadingRows(
        textBubbles.filter((b) => panelNoOf(b) === 0),
        bubbleBox
    )
    if (floating.length) groups.push({ panel: 0, bubbles: floating })
    return groups
}

const SHEET_NOTE =
    '構造は pages → panels → lines の入れ子で、すべて読み順（ページ→コマ 右上から左下→コマ内 右上から左下）で並んでいます。' +
    '各 lines[].target に訳文を入れてください。id と source は変更しないこと。改行は \\n（バックスラッシュ+n）。' +
    '同じ panel 内で連続する行は、ひと続きの発話を複数の吹き出し（ナレーション/心の声など）に分けたものであることが多いので、通して自然につながる訳にしてください。' +
    'speaker=話者 / addressee=宛先（誰・何に向けたセリフか）/ note=言い回しやニュアンスの補足 は訳し分けの手がかりです（空のこともあります）。' +
    'panel はコマ番号（0＝コマ外）。行を減らしたり並べ替えても構いません（id で照合します）。'

const lineOf = (b: Bubble): TranslationSheetLine => ({
    id: b.id,
    speaker: b.scriptSpeaker ?? '',
    addressee: b.scriptAddressee ?? '',
    note: b.scriptNote ?? '',
    source: b.text ?? '',
    target: ''
})

/** 表示ページ群から、テキストを持つ吹き出しを読み順の入れ子構造で書き出す。 */
export function buildTranslationSheet(
    pages: Page[],
    opts: { sourceName: string; locale: TargetLocale }
): TranslationSheet {
    const outPages: TranslationSheetPage[] = []
    pages.forEach((p, i) => {
        const groups = collectPanels(p)
        if (!groups.length) return
        outPages.push({
            page: i + 1,
            panels: groups.map((g) => ({ panel: g.panel, lines: g.bubbles.map(lineOf) }))
        })
    })
    return {
        format: SHEET_FORMAT,
        version: 2,
        sourceName: opts.sourceName,
        locale: opts.locale,
        note: SHEET_NOTE,
        pages: outPages
    }
}

/** シート内の全行をフラットに取り出す（適用・集計用） */
export function flattenLines(sheet: TranslationSheet): TranslationSheetLine[] {
    const out: TranslationSheetLine[] = []
    for (const pg of sheet.pages) for (const pn of pg.panels) out.push(...pn.lines)
    return out
}

const asStr = (v: unknown): string => (typeof v === 'string' ? v : '')

function parseLine(raw: unknown): TranslationSheetLine | null {
    if (!raw || typeof raw !== 'object') return null
    const r = raw as Record<string, unknown>
    if (typeof r.id !== 'string' || !r.id) return null
    return {
        id: r.id,
        speaker: asStr(r.speaker),
        addressee: asStr(r.addressee),
        note: asStr(r.note),
        source: asStr(r.source),
        target: asStr(r.target)
    }
}

/**
 * 読み込んだ JSON を検証し、正規化した TranslationSheet を返す。壊れていれば throw。
 * 入れ子(pages) を基本とし、旧フラット形式(items) も後方互換で受け付ける。
 */
export function parseTranslationSheet(raw: unknown): TranslationSheet {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new Error('翻訳シートの形式が不正です（JSON オブジェクトではありません）')
    }
    const o = raw as Record<string, unknown>
    if (o.format !== SHEET_FORMAT) {
        throw new Error('翻訳シートの format が一致しません（manga-i18n-sheet ではありません）')
    }
    const locale: TargetLocale = o.locale === 'zh-Hant' ? 'zh-Hant' : 'zh-Hans'

    let pages: TranslationSheetPage[]
    if (Array.isArray(o.pages)) {
        pages = (o.pages as unknown[])
            .map((pg): TranslationSheetPage | null => {
                if (!pg || typeof pg !== 'object') return null
                const pr = pg as Record<string, unknown>
                const panelsRaw = Array.isArray(pr.panels) ? (pr.panels as unknown[]) : []
                const panels = panelsRaw
                    .map((pn): TranslationSheetPanel | null => {
                        if (!pn || typeof pn !== 'object') return null
                        const nr = pn as Record<string, unknown>
                        const lines = (Array.isArray(nr.lines) ? nr.lines : [])
                            .map(parseLine)
                            .filter((l): l is TranslationSheetLine => l !== null)
                        return { panel: typeof nr.panel === 'number' ? nr.panel : 0, lines }
                    })
                    .filter((x): x is TranslationSheetPanel => x !== null)
                return { page: typeof pr.page === 'number' ? pr.page : 0, panels }
            })
            .filter((x): x is TranslationSheetPage => x !== null)
    } else if (Array.isArray(o.items)) {
        // 旧フラット形式: page/panel でグルーピングし直す
        const byPage = new Map<number, Map<number, TranslationSheetLine[]>>()
        for (const it of o.items as unknown[]) {
            const line = parseLine(it)
            if (!line) continue
            const r = it as Record<string, unknown>
            const pageNo = typeof r.page === 'number' ? r.page : 0
            const panelNo = typeof r.panel === 'number' ? r.panel : 0
            if (!byPage.has(pageNo)) byPage.set(pageNo, new Map())
            const pm = byPage.get(pageNo)!
            if (!pm.has(panelNo)) pm.set(panelNo, [])
            pm.get(panelNo)!.push(line)
        }
        pages = [...byPage.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([page, pm]) => ({
                page,
                panels: [...pm.entries()].sort((a, b) => a[0] - b[0]).map(([panel, lines]) => ({ panel, lines }))
            }))
    } else {
        throw new Error('翻訳シートに pages（または items）がありません')
    }

    return {
        format: SHEET_FORMAT,
        version: 2,
        sourceName: asStr(o.sourceName),
        locale,
        note: asStr(o.note),
        pages
    }
}

export interface ApplyStats {
    /** 表示ページにあるテキスト吹き出しの総数 */
    total: number
    /** 訳文が入って差し替えた数 */
    translated: number
    /** 訳文が空/未提供で原文のまま残った数 */
    missing: number
    /** フォントを中文へ置換した吹き出し数（表示+保管） */
    fontsChanged: number
}

/**
 * 翻訳シートをプロジェクトデータへ適用し、新しい MangaProjectData を返す（元は破壊しない）。
 * - text: シートに訳文(target)がある吹き出しは差し替え。無ければ原文維持。
 * - fontFamily: 全吹き出しを対象ロケールの中文フォントへ写像。
 * - speaker/addressee/note は翻訳者向けの手がかりで、ここでは書き込まない（無視）。
 * - stats は表示ページ基準（保管ページはフォントのみ静かに置換）。
 */
export function applyTranslationSheet(
    data: MangaProjectData,
    sheet: TranslationSheet,
    locale: TargetLocale,
    options?: { forceHorizontal?: boolean }
): { data: MangaProjectData; stats: ApplyStats } {
    const forceHorizontal = options?.forceHorizontal === true
    const targetById = new Map<string, string>()
    for (const line of flattenLines(sheet)) {
        if (line.target && line.target.trim() !== '') targetById.set(line.id, line.target)
    }
    let total = 0
    let translated = 0
    let missing = 0
    let fontsChanged = 0

    const mapPage = (page: Page, count: boolean): Page => ({
        ...page,
        bubbles: (page.bubbles || []).map((b) => {
            let next: Bubble = b
            const mappedFont = mapFontForLocale(b.fontFamily, locale)
            if (mappedFont !== b.fontFamily) {
                next = { ...next, fontFamily: mappedFont }
                fontsChanged++
            }
            // 横書き化（簡体字/英語など）。縦書きの吹き出しを横書きに強制
            if (forceHorizontal && next.isVertical) {
                next = { ...next, isVertical: false }
            }
            const hasText = (b.text ?? '').trim() !== ''
            const t = targetById.get(b.id)
            if (t !== undefined) {
                next = { ...next, text: t }
                if (count && hasText) translated++
            } else if (count && hasText) {
                missing++
            }
            if (count && hasText) total++
            return next
        })
    })

    const newData: MangaProjectData = {
        ...data,
        pages: (data.pages || []).map((p) => mapPage(p, true)),
        archivedPages: (data.archivedPages || []).map((p) => mapPage(p, false))
    }
    return { data: newData, stats: { total, translated, missing, fontsChanged } }
}
