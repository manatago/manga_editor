import type { ReferenceCharacter } from '../store/types'

/** 男性の既定フォント（ヒラギノ明朝） */
export const HIRAGINO_MINCHO = "'Hiragino Mincho ProN', 'MS PMincho', serif"
/** 女性の既定フォント（よもぎ・手書き） */
export const YOMOGI = "'Yomogi', cursive"

export interface FontOption {
    label: string
    value: string
    /** optgroup 見出し（無ければトップレベル） */
    group?: string
}

/** 吹き出しフォントの選択肢（BubbleSettings と同一のラインナップ） */
export const FONT_OPTIONS: FontOption[] = [
    { label: 'ゴシック体', value: 'sans-serif' },
    { label: '明朝体', value: 'serif' },
    { label: 'ヒラギノ角ゴ / メイリオ', value: "'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif" },
    { label: 'ヒラギノ明朝 / MS明朝', value: HIRAGINO_MINCHO },
    { label: 'クレー One（柔らか）', value: "'Klee One', cursive", group: '手書き風' },
    { label: '油星マジック（ペン字）', value: "'Yusei Magic', sans-serif", group: '手書き風' },
    { label: 'よもぎ（手書き）', value: YOMOGI, group: '手書き風' },
    { label: '禅 紅粉藤（優しい）', value: "'Zen Kurenaido', sans-serif", group: '手書き風' },
    { label: 'はちまるポップ（丸字）', value: "'Hachi Maru Pop', cursive", group: '手書き風' },
    { label: 'キウイ丸（丸字）', value: "'Kiwi Maru', serif", group: '手書き風' },
    { label: 'もちポップ（太め丸字）', value: "'Mochiy Pop P One', sans-serif", group: '手書き風' },
    { label: 'ロックンロール（元気）', value: "'RocknRoll One', sans-serif", group: '手書き風' },
    { label: 'ランパート（輪郭）', value: "'Rampart One', cursive", group: '手書き風' },
    { label: 'スティック（棒字）', value: "'Stick', sans-serif", group: '手書き風' },
    { label: 'トレイン One（太め輪郭）', value: "'Train One', cursive", group: '手書き風' },
    { label: 'チェリーボム（ポップ爆発）', value: "'Cherry Bomb One', cursive", group: '手書き風' },
    { label: 'スラックサイド（ゆるゆる）', value: "'Slackside One', cursive", group: '手書き風' },
    { label: 'Comic Sans（英語手書き）', value: "'Comic Sans MS', cursive", group: '手書き風' }
]

/**
 * キャラの既定フォントを解決する。
 * 明示設定があればそれ、無ければ性別から（男=ヒラギノ明朝 / 女=よもぎ）。どちらも無ければ undefined。
 */
export function characterFontFor(char: Pick<ReferenceCharacter, 'gender' | 'defaultFontFamily'>): string | undefined {
    if (char.defaultFontFamily) return char.defaultFontFamily
    if (char.gender === 'male') return HIRAGINO_MINCHO
    if (char.gender === 'female') return YOMOGI
    return undefined
}

/** 話者名 → 既定フォント のマップを作る（解決できたキャラのみ） */
export function buildCharacterFontMap(chars: ReferenceCharacter[]): Record<string, string> {
    const map: Record<string, string> = {}
    for (const c of chars) {
        const font = characterFontFor(c)
        const name = c.name?.trim()
        if (font && name) map[name] = font
    }
    return map
}
