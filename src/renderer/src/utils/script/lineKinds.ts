/**
 * 構造化エディタの「種別」= 吹き出しの type/tailType の組み合わせ。
 * 台本行(=吹き出し)の種別選択と、吹き出しからの逆引きに使う。
 */
import type { Bubble, BubbleType } from '../../store/types'

export type LineKind =
    | 'speech'
    | 'thought'
    | 'shout'
    | 'flash'
    | 'rect'
    | 'rect-double'
    | 'jagged'
    | 'square-jagged'
    | 'megaphone'
    | 'narration'

export const LINE_KIND_ORDER: LineKind[] = [
    'speech',
    'thought',
    'shout',
    'flash',
    'rect',
    'rect-double',
    'jagged',
    'square-jagged',
    'megaphone',
    'narration'
]

export const LINE_KIND_LABELS: Record<LineKind, string> = {
    speech: '通常',
    thought: '心の声',
    shout: '叫び',
    flash: 'ウニ',
    rect: '矩形',
    'rect-double': '二重矩形',
    jagged: 'ギザギザ',
    'square-jagged': '角ギザ',
    megaphone: 'メガホン',
    narration: 'ナレーション'
}

export function isNarrationKind(kind: LineKind): boolean {
    return kind === 'narration'
}

/** 種別 → 吹き出しに設定するプロパティ */
export function propsForKind(kind: LineKind): Partial<Bubble> {
    switch (kind) {
        case 'thought':
            return { type: 'rounded', tailType: 'thought' }
        case 'shout':
            return { type: 'shout', tailType: 'point' }
        case 'flash':
            return { type: 'flash', tailType: 'point' }
        case 'rect':
            return { type: 'rect', tailType: 'point' }
        case 'rect-double':
            return { type: 'rect-double', tailType: 'point' }
        case 'jagged':
            return { type: 'jagged', tailType: 'point' }
        case 'square-jagged':
            return { type: 'square-jagged', tailType: 'point' }
        case 'megaphone':
            return { type: 'megaphone', tailType: 'point' }
        case 'narration':
            return { type: 'rect', tailType: 'point', tailWidth: 0 }
        case 'speech':
        default:
            return { type: 'rounded', tailType: 'point' }
    }
}

/** 吹き出し → 現在の種別（表示用） */
export function kindOfBubble(b: Pick<Bubble, 'type' | 'tailType' | 'tailWidth' | 'scriptSpeaker'>): LineKind {
    if (b.tailWidth === 0 && b.type === 'rect' && !b.scriptSpeaker) return 'narration'
    if (b.tailType === 'thought') return 'thought'
    const t = b.type as BubbleType
    if (t === 'shout' || t === 'flash' || t === 'rect' || t === 'rect-double' || t === 'jagged' || t === 'square-jagged' || t === 'megaphone') {
        return t
    }
    return 'speech'
}
