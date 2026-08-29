import { HIRAGINO_MINCHO } from './fontFamilies'

/** 翻訳版の対象ロケール（簡体字 / 繁體字） */
export type TargetLocale = 'zh-Hans' | 'zh-Hant'

export const TARGET_LOCALES: { value: TargetLocale; label: string; folderSuffix: string }[] = [
    { value: 'zh-Hans', label: '简体字（簡体）', folderSuffix: '简体' },
    { value: 'zh-Hant', label: '繁體字（繁体）', folderSuffix: '繁體' }
]

export function localeMeta(locale: TargetLocale): { label: string; folderSuffix: string } {
    return TARGET_LOCALES.find((l) => l.value === locale) ?? TARGET_LOCALES[0]
}

/**
 * 日本語専用フォント（Yomogi 等の手書き系はグリフに中国語を持たない）を、
 * macOS 標準の中文フォントスタックへ置き換えるマップ。キーは manga.json の
 * fontFamily 文字列（FONT_OPTIONS と同一表記）。ここに無いものは既定へフォールバック。
 *
 * カテゴリ対応の考え方:
 * - 明朝 / serif      → 宋体(Songti)
 * - ゴシック / sans    → 苹方(PingFang) / 黑体(Heiti)
 * - 手書き・ペン字     → 手札体(Hannotate) / 翩翩体(HanziPen) / 楷体(Kaiti)
 * - 丸字・ポップ       → 圆体(Yuanti)
 */
const ZH_HANS: Record<string, string> = {
    serif: "'Songti SC', serif",
    'sans-serif': "'PingFang SC', 'Heiti SC', sans-serif",
    [HIRAGINO_MINCHO]: "'Songti SC', serif",
    "'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif": "'PingFang SC', 'Heiti SC', sans-serif",
    "'Klee One', cursive": "'Kaiti SC', 'STKaiti', cursive",
    "'Yusei Magic', sans-serif": "'Hannotate SC', 'Kaiti SC', sans-serif",
    "'Yomogi', cursive": "'Hannotate SC', 'HanziPen SC', 'Kaiti SC', cursive",
    "'Zen Kurenaido', sans-serif": "'Kaiti SC', 'STKaiti', sans-serif",
    "'Hachi Maru Pop', cursive": "'Yuanti SC', 'PingFang SC', cursive",
    "'Kiwi Maru', serif": "'Yuanti SC', 'Songti SC', serif",
    "'Mochiy Pop P One', sans-serif": "'Yuanti SC', 'PingFang SC', sans-serif",
    "'RocknRoll One', sans-serif": "'Yuanti SC', 'PingFang SC', sans-serif",
    "'Rampart One', cursive": "'Yuanti SC', 'PingFang SC', cursive",
    "'Stick', sans-serif": "'PingFang SC', 'Heiti SC', sans-serif",
    "'Train One', cursive": "'Yuanti SC', 'PingFang SC', cursive",
    "'Cherry Bomb One', cursive": "'Yuanti SC', 'PingFang SC', cursive",
    "'Slackside One', cursive": "'Hannotate SC', 'Kaiti SC', cursive",
    "'Comic Sans MS', cursive": "'Comic Sans MS', 'Yuanti SC', cursive"
}

/** 簡体スタック文字列を繁體(TC)向けへ機械変換（SC→TC、STKaiti→BiauKai） */
function toHant(value: string): string {
    return value.replace(/ SC'/g, " TC'").replace(/'STKaiti'/g, "'BiauKai'")
}

const ZH_HANT: Record<string, string> = Object.fromEntries(
    Object.entries(ZH_HANS).map(([k, v]) => [k, toHant(v)])
)

const DEFAULT_HANS = "'Songti SC', serif"
const DEFAULT_HANT = "'Songti TC', serif"

/** 既に中文フォントスタックなら（再実行時に）二重変換しないための判定 */
const ALREADY_CJK = /(?:SC|TC)'|PingFang|Songti|Kaiti|Yuanti|Hannotate|HanziPen|Heiti|BiauKai/

/**
 * fontFamily を対象ロケールの中文フォントへ写像する。
 * - マップにあればそれ
 * - 既に中文スタックならそのまま（再実行の冪等性）
 * - 未知・空でないものは既定（宋体）へ
 * - 空/未定義はそのまま（アプリ既定に委ねる）
 */
export function mapFontForLocale(font: string | undefined, locale: TargetLocale): string {
    if (!font) return font ?? ''
    const table = locale === 'zh-Hant' ? ZH_HANT : ZH_HANS
    if (Object.prototype.hasOwnProperty.call(table, font)) return table[font]
    if (ALREADY_CJK.test(font)) return font
    return locale === 'zh-Hant' ? DEFAULT_HANT : DEFAULT_HANS
}
