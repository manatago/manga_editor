/** 縦書きで回転が必要な文字（長音・各種ダッシュ/横棒・括弧類） */
// 末尾の横棒系: ―(U+2015) —(U+2014, 中文破折号) ─(U+2500) －(U+FF0D) −(U+2212) ‐(U+2010) ‒–(U+2012/2013) ⸺⸻(U+2E3A/2E3B)
export const VERTICAL_ROTATE_CHARS = 'ー〜〜～()（）[]［］{}｛｝「」『』<>〈〉《》【】…―—─－−‐‒–⸺⸻'

/** 縦書きで位置調整が必要な小書き */
export const VERTICAL_SMALL_CHARS = 'っゃゅょぁぃぅぇぉッャュョァィゥェォ'

/** 縦書きで位置調整が必要な句読点 */
export const VERTICAL_PUNCT_CHARS = '。、'
