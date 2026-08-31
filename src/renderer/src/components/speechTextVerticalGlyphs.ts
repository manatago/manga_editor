/** 縦書きで回転が必要な文字（長音・各種ダッシュ/横棒・括弧類） */
// 末尾の横棒系: ―(U+2015) —(U+2014, 中文破折号) ─(U+2500) －(U+FF0D) −(U+2212) ‐(U+2010) ‒–(U+2012/2013) ⸺⸻(U+2E3A/2E3B)
export const VERTICAL_ROTATE_CHARS = 'ー〜〜～()（）[]［］{}｛｝「」『』<>〈〉《》【】…―—─－−‐‒–⸺⸻'

/** 縦書きで位置調整が必要な小書き */
export const VERTICAL_SMALL_CHARS = 'っゃゅょぁぃぅぇぉッャュョァィゥェォ'

/** 縦書きで位置調整が必要な句読点。文字ごとに右寄せ量(x)・上寄せ量(y)を fontSize 比で指定 */
export const VERTICAL_PUNCT_OFFSETS: Record<string, { x: number; y: number }> = {
    '。': { x: 0.6, y: -0.42 }, // 句点(日中共通)。右上へ。前の文字と少し隙間
    '、': { x: 0.8, y: -0.42 }, // 日本語 読点
    '，': { x: 0.55, y: -0.42 }, // 中国語 逗号(全角カンマ U+FF0C)。中央から少し右上へ
    '．': { x: 0.6, y: -0.42 } // 全角ピリオド(U+FF0E) 予備
}

/** 位置調整対象の句読点集合（後方互換） */
export const VERTICAL_PUNCT_CHARS = Object.keys(VERTICAL_PUNCT_OFFSETS).join('')

/** 回転させるとインクが下寄り（ベースライン寄り）で列の片側にズレる文字。中央へ補正する */
export const VERTICAL_ROTATE_LOW_CHARS = '…‥'

/** VERTICAL_ROTATE_LOW_CHARS の中央補正量（fontSize 比。回転後に列中央へ寄せる） */
export const VERTICAL_ROTATE_LOW_SHIFT = 0.14
