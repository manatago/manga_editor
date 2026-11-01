// 画像を漫画の絵にする核: 濃さの段を減らす・網点にする・輪郭を線として拾う。DOM に触らない。
// gousei(../gousei) の src/core/manga.ts からの移植。実測の経緯はあちらのコメントに残っている。
// 前段のぼかし（線を拾う下ごしらえ）は canvas 側（renderManga.ts）で行う。ここは画素の計算だけ。

/** 網点の角度（漫画のトーンの定番） */
const DOT_ANGLE = Math.PI / 4

/** 輝度（Rec.601） */
export const luma = (r: number, g: number, b: number): number => 0.299 * r + 0.587 * g + 0.114 * b

/** 段のあいだのトーンの濃さ（0〜1）のいちばん薄い・濃い値。漫画のトーンは 10〜50% あたりを使う */
const TONE_LIGHT = 0.12,
    TONE_DARK = 0.5

/**
 * 濃さを `levels` 段にそろえる（0〜255 → 段の明るさ）。いちばん暗い段は黒（ベタ）、いちばん明るい段は白。
 * あいだの段は**明るさを等分しない**: 写真の濃さのまま等分すると、空まで濃い網点になって重かった。
 * 漫画のトーンのように薄め（12〜50%）に割り振る。`levels` が 2 未満なら変えない
 */
export function quantize(v: number, levels: number): number {
    if (levels < 2) return v
    const n = levels - 1
    const k = Math.round((v / 255) * n) // 0 = 黒 … n = 白
    if (k === 0 || k === n) return (k / n) * 255
    const mids = n - 1 // あいだの段の数
    const dark =
        mids === 1 ? (TONE_LIGHT + TONE_DARK) / 2 : TONE_DARK - ((k - 1) / (mids - 1)) * (TONE_DARK - TONE_LIGHT)
    return (1 - dark) * 255
}

/**
 * 網点の山の形 (cos u + cos v) / 2 は −1〜1。濃さ d（0〜1）の網点にするには、山が `DOT_T[d]` より高いところを塗る。
 * 塗れる面積は山の高さに比例しないので、1 マスを細かく見て面積の分かれ目を表にしておく
 */
const DOT_T: Float32Array = (() => {
    const n = 256,
        s: number[] = []
    for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++)
            s.push((Math.cos((2 * Math.PI * (x + 0.5)) / n) + Math.cos((2 * Math.PI * (y + 0.5)) / n)) / 2)
    }
    s.sort((a, b) => b - a)
    const t = new Float32Array(257)
    for (let i = 0; i <= 256; i++) t[i] = i === 0 ? 1.0001 : i === 256 ? -1.0001 : s[Math.round((i / 256) * s.length) - 1]
    return t
})()

/**
 * 網点の 1 画素の黒さ（0〜1）。`dark` は塗りたい濃さ（0 = 白、1 = 黒）、`pitch` は点の間隔（px）。
 * 縁は 1 画素ぶんなめらかにする（ギザギザを出さない）
 */
export function dotInk(x: number, y: number, dark: number, pitch: number): number {
    if (dark <= 0.01) return 0
    if (dark >= 0.99) return 1
    const c = Math.cos(DOT_ANGLE),
        s = Math.sin(DOT_ANGLE)
    const px = x + 0.5,
        py = y + 0.5
    const u = (px * c + py * s) / pitch,
        v = (py * c - px * s) / pitch
    const spot = (Math.cos(2 * Math.PI * u) + Math.cos(2 * Math.PI * v)) / 2
    const t = DOT_T[Math.round(dark * 256)]
    // 山の傾きはおよそ π / pitch（1 画素あたり）。分かれ目の前後 1 画素で 0 → 1
    const k = (spot - t) / (Math.PI / pitch)
    return Math.min(1, Math.max(0, 0.5 + k))
}

/**
 * 線の黒さ（0〜1）。`near` は細かくぼかした輝度、`far` は粗くぼかした輝度（差が輪郭＝DoG）。
 * 周りより暗い細い所ほど黒くなる。`strength` は 0〜100
 */
export function lineInk(near: number, far: number, strength: number): number {
    if (strength <= 0) return 0
    const s = strength / 100
    const d = far - near // 周りより暗いと正
    const eps = 1 + (1 - s) * 6
    if (d <= eps) return 0
    return Math.tanh((d - eps) * (0.04 + s * 0.16))
}

export interface MangaParams {
    /** 濃さの段（0 か 1 ならそのまま） */
    levels: number
    /** 網点の間隔（px）。0 なら網点にしない（灰色のまま） */
    dots: number
    /** 線の強さ 0〜100 */
    lines: number
}

/** ぼかし（元の絵の px）がこの量で、線の濃さが半分になる */
const LINE_FADE = 2
/** ぼかし（元の絵の px）がこの量で、白へ半分寄せる */
const HAZE_HALF = 8

/**
 * 漫画の絵では、ぼかしの代わりに**線を減らして白っぽく飛ばす**。`blur` はその画素に掛かるはずだったぼかし（元の絵の px）。
 */
export function distanceFade(blur: number): { line: number; haze: number } {
    if (blur <= 0) return { line: 1, haze: 0 }
    return { line: 1 / (1 + blur / LINE_FADE), haze: (0.5 * blur) / HAZE_HALF / (1 + blur / HAZE_HALF) }
}

/**
 * 画素を漫画の絵にする。`near` / `far` は線を拾うための、ぼかした輝度（`lines` が 0 なら使わない）。
 * `blurAt` は画素ごとのぼかしの量（元の絵の px。`distanceFade` で線を減らし白へ寄せる。無ければ 0）。
 * `clearAt` は人物の周りを飛ばす具合（0〜1。1 で真っ白・線なし）。網点は灰色にせず点を小さくする。
 * 結果は白黒の灰色。α はそのまま。`src` と `out` は同じ配列でもよい
 */
export function mangaPixels(
    src: Uint8ClampedArray,
    out: Uint8ClampedArray,
    w: number,
    p: MangaParams,
    near?: Uint8ClampedArray,
    far?: Uint8ClampedArray,
    blurAt?: Float32Array,
    clearAt?: Float32Array
): void {
    const useLines = p.lines > 0 && !!near && !!far
    for (let i = 0, j = 0; i < src.length; i += 4, j++) {
        const fade = blurAt ? distanceFade(blurAt[j]) : null
        const clear = clearAt ? clearAt[j] : 0
        let v = luma(src[i], src[i + 1], src[i + 2])
        if (fade) v += (255 - v) * fade.haze
        v = quantize(v, p.levels)
        // 飛ばしは段にそろえた後に掛ける（前に掛けると人物の周りに段の縞ができる）
        if (clear > 0) v += (255 - v) * clear
        if (p.dots > 0) v = 255 * (1 - dotInk(j % w, Math.floor(j / w), 1 - v / 255, p.dots))
        if (useLines) v *= 1 - lineInk(near![i], far![i], p.lines) * (fade ? fade.line : 1) * (1 - clear)
        out[i] = out[i + 1] = out[i + 2] = v
        out[i + 3] = src[i + 3]
    }
}

/** コントラストの倍率（gousei core/adjust.ts と同じ式） */
export function contrastFactor(c: number): number {
    return c >= 0 ? 1 + (c / 100) * 3 : 1 + c / 100
}

/**
 * 明るさ・コントラストを画素に掛ける（白黒化前の下ごしらえ）。128 を中心にコントラスト → 明るさ。α はそのまま。
 * `src` と `out` は同じ配列でもよい。彩度・反転・ぼかしは含まない（漫画化では使わない）。
 */
export function adjustBrightnessContrast(
    src: Uint8ClampedArray,
    out: Uint8ClampedArray,
    brightness: number,
    contrast: number
): void {
    const k = contrastFactor(contrast)
    const add = brightness * 2.55
    for (let i = 0; i < src.length; i += 4) {
        out[i] = (src[i] - 128) * k + 128 + add
        out[i + 1] = (src[i + 1] - 128) * k + 128 + add
        out[i + 2] = (src[i + 2] - 128) * k + 128 + add
        out[i + 3] = src[i + 3]
    }
}
