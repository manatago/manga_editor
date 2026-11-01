// 漫画化のつまみを画像自身から決める「おまかせ」。DOM に触らない。
// gousei(../gousei) の src/core/autoManga.ts からの移植（mangas 単体用に、人物の主線ではなく
// 画像自身の線幅から釣り合いを取る形にしてある）。物差しの根拠はあちらのコメントに残っている。

import { contrastFactor, lineInk, luma, quantize } from './mangaCore'

export type AutoLook = 'light' | 'normal' | 'heavy'

/**
 * 線の量（線になる画素の割合）と、段にそろえた後の平均の濃さの目標。
 * gousei の 05合成の実測に合わせた値（標準＝人物の線に合わせたふつうの背景）。
 */
export const AUTO_LOOKS: { key: AutoLook; label: string; lines: number; dark: number; contrast: number }[] = [
    { key: 'light', label: '明るめ', lines: 0.1, dark: 0.1, contrast: -20 },
    { key: 'normal', label: '標準', lines: 0.15, dark: 0.17, contrast: -10 },
    { key: 'heavy', label: '重め', lines: 0.18, dark: 0.27, contrast: -10 }
]

/** 主線とみなす太さの上限（px。これより太い黒はベタ塗り） */
const MAX_LINE = 6

/**
 * 絵の主線の太さ（px）。不透明で暗い画素ごとに、横と縦に続く長さの短い方をとり、`MAX_LINE` 以下の平均。
 * 線が見つからなければ null
 */
export function lineWidthOf(data: Uint8ClampedArray, w: number, h: number): number | null {
    const n = w * h
    const dark = new Uint8Array(n)
    for (let j = 0, i = 0; j < n; j++, i += 4)
        dark[j] = data[i + 3] > 128 && luma(data[i], data[i + 1], data[i + 2]) < 128 ? 1 : 0
    const run = new Uint16Array(n).fill(0xffff)
    // 横に続く長さ
    for (let y = 0; y < h; y++) {
        let x = 0
        while (x < w) {
            if (!dark[y * w + x]) {
                x++
                continue
            }
            let e = x
            while (e < w && dark[y * w + e]) e++
            for (let k = x; k < e; k++) run[y * w + k] = e - x
            x = e
        }
    }
    // 縦に続く長さ（短い方を残す）
    for (let x = 0; x < w; x++) {
        let y = 0
        while (y < h) {
            if (!dark[y * w + x]) {
                y++
                continue
            }
            let e = y
            while (e < h && dark[e * w + x]) e++
            for (let k = y; k < e; k++) run[k * w + x] = Math.min(run[k * w + x], e - y)
            y = e
        }
    }
    let sum = 0,
        cnt = 0
    for (let j = 0; j < n; j++)
        if (dark[j] && run[j] <= MAX_LINE) {
            sum += run[j]
            cnt++
        }
    return cnt ? sum / cnt : null
}

/** 網点の間隔（px）。主線の太さくらい */
export function dotsFor(figureLine: number): number {
    return Math.min(12, Math.max(4, Math.round(figureLine * 2) / 2))
}

/** 線になる画素の割合が `target` になる「線の量」を探す（量が増えるほど割合は増える）。`step` 画素おきに数える */
export function fitLines(near: Uint8ClampedArray, far: Uint8ClampedArray, target: number, step = 3): number {
    const cover = (s: number): number => {
        let hit = 0,
            all = 0
        for (let i = 0; i < near.length; i += 4 * step) {
            all++
            if (lineInk(near[i], far[i], s) > 0.5) hit++
        }
        return all ? hit / all : 0
    }
    let lo = 1,
        hi = 100
    if (cover(hi) <= target) return hi
    if (cover(lo) >= target) return lo
    for (let it = 0; it < 12 && hi - lo > 1; it++) {
        const mid = Math.round((lo + hi) / 2)
        if (cover(mid) < target) lo = mid
        else hi = mid
    }
    return hi
}

/**
 * 段にそろえたあとの平均の濃さ（0 = 白、1 = 黒）が `target` になる明るさ（-100〜100）を探す。
 * `ys` は白黒にした輝度（コントラスト・明るさを掛ける前）
 */
export function fitBrightness(ys: Float32Array, contrast: number, levels: number, target: number): number {
    const kc = contrastFactor(contrast)
    const dark = (b: number): number => {
        let s = 0
        for (const y of ys) s += 1 - quantize(Math.min(255, Math.max(0, (y - 128) * kc + 128 + b * 2.55)), levels) / 255
        return ys.length ? s / ys.length : 0
    }
    let lo = -100,
        hi = 100 // 明るさを上げるほど薄くなる
    if (dark(lo) <= target) return lo
    if (dark(hi) >= target) return hi
    for (let it = 0; it < 14 && hi - lo > 1; it++) {
        const mid = Math.round((lo + hi) / 2)
        if (dark(mid) > target) lo = mid
        else hi = mid
    }
    return hi
}
