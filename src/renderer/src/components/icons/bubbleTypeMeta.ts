import type { BubbleType } from '../../store/useMangaStore'

/** UI 表示順（ストアの型と一致） */
export const BUBBLE_TYPE_ORDER: BubbleType[] = [
    'rounded',
    'jagged',
    'rect',
    'rect-double',
    'flash',
    'shout',
    'square-jagged',
    'megaphone'
]

/** 種類ボタン・ツールチップ用の日本語名 */
export const BUBBLE_TYPE_LABELS: Record<BubbleType, string> = {
    rounded: '普通',
    jagged: 'ギザギザ',
    rect: '矩形',
    'rect-double': '二重矩形',
    flash: 'ウニ',
    shout: '叫び',
    'square-jagged': '角ギザ',
    megaphone: 'メガホン'
}
