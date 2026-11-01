// 画像を漫画の絵にする（canvas を使う部分）。レンダラで呼ぶ。
// 画素の計算は mangaCore.ts、つまみの自動決めは autoTune.ts。
// gousei(../gousei) の src/renderer/src/bgRender.ts の「漫画の絵にする」経路を、mangas 単体の
// 「1 クリックおまかせ」用にまとめ直したもの。

import { adjustBrightnessContrast, luma, mangaPixels } from './mangaCore'
import { dotsFor, fitBrightness, fitLines, lineWidthOf } from './autoTune'

// 仕上がりの強さ（2026-11-01 ユーザー「度合いがキツすぎる。顔アップだと変化が大きすぎる」→「3段階にして」）。
// 顔のアップで破綻しないよう、段数を多めに（肌をベタ面に潰さない）・線を拾いすぎず・
// 元のなめらかな濃淡を残す。弱=ほぼ写真に軽く線、強=しっかり線＋トーン（それでも従来より控えめ）。
export type MangaLevel = 'weak' | 'mid' | 'strong'

interface MangaProfile {
    /** 段の数（ベタ＋中間トーン＋白）。多いほど階調がなめらか */
    levels: number
    /** 漫画化の強さ 0〜1。下げるほど元のなめらかな濃淡が残る（顔の立体感を保つ） */
    strength: number
    /** おまかせの目標（線になる割合・段そろえ後の平均の濃さ・コントラスト） */
    lines: number
    dark: number
    contrast: number
}

// 全体にひと段やわらげた（2026-11-01 ユーザー「弱でもまだ明るい。今の弱を中くらいに」）。
// 中＝旧・弱、弱＝さらに軽く、強＝旧・中。
const PROFILES: Record<MangaLevel, MangaProfile> = {
    weak: { levels: 7, strength: 0.18, lines: 0.03, dark: 0.09, contrast: -10 },
    mid: { levels: 7, strength: 0.3, lines: 0.05, dark: 0.1, contrast: -10 },
    strong: { levels: 6, strength: 0.5, lines: 0.08, dark: 0.12, contrast: -10 }
}

/** 線幅が測れなかったとき（写真など、はっきりした主線が無い）の既定の太さ(px) */
const FALLBACK_LINE = 3

type Canvas2D = OffscreenCanvas

function makeCanvas(w: number, h: number): Canvas2D {
    return new OffscreenCanvas(w, h)
}

/** 縁の画素を外へ引き伸ばしてからぼかす（そのままぼかすと縁が暗く沈む）。gousei の blurred 移植 */
function blurred(src: Canvas2D, r: number): Canvas2D {
    const w = src.width,
        h = src.height
    const out = makeCanvas(w, h)
    const ctx = out.getContext('2d')!
    if (r <= 0) {
        ctx.drawImage(src, 0, 0)
        return out
    }
    const m = Math.ceil(r * 3)
    const pad = makeCanvas(w + m * 2, h + m * 2)
    const pc = pad.getContext('2d')!
    pc.drawImage(src, m, m)
    pc.drawImage(src, 0, 0, w, 1, m, 0, w, m) // 上
    pc.drawImage(src, 0, h - 1, w, 1, m, h + m, w, m) // 下
    pc.drawImage(pad, m, 0, 1, h + m * 2, 0, 0, m, h + m * 2) // 左（上下の引き伸ばし込み）
    pc.drawImage(pad, m + w - 1, 0, 1, h + m * 2, w + m, 0, m, h + m * 2) // 右
    ctx.filter = `blur(${r}px)`
    ctx.drawImage(pad, -m, -m)
    ctx.filter = 'none'
    return out
}

const pixelsOf = (c: Canvas2D): Uint8ClampedArray =>
    c.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, c.width, c.height).data

/** HTMLImageElement を ImageData にする */
function imageData(img: HTMLImageElement): ImageData {
    const w = img.naturalWidth || img.width,
        h = img.naturalHeight || img.height
    const c = makeCanvas(w, h)
    const ctx = c.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(img, 0, 0)
    return ctx.getImageData(0, 0, w, h)
}

/**
 * 画像を漫画の絵にして PNG の dataURL で返す（白黒の線＋段トーン）。
 * つまみ（段数・網点・線量・明るさ）は画像自身の線幅から自動で決める（gousei の「おまかせ」）。
 * `isCutout` が真なら、透明部は白とみなして線を拾い（シルエットに自然な輪郭が出る）、最後に α を戻す。
 */
export function mangaifyImage(img: HTMLImageElement, opts?: { isCutout?: boolean; level?: MangaLevel }): string {
    const isCutout = !!opts?.isCutout
    const prof = PROFILES[opts?.level ?? 'mid']
    const LEVELS = prof.levels
    const STRENGTH = prof.strength
    const LOOK = { lines: prof.lines, dark: prof.dark, contrast: prof.contrast }
    const base = imageData(img)
    const w = base.width,
        h = base.height
    const d = base.data

    // 透明部の α を控えておき、RGB は白に（透明の黒い崖で偽の輪郭が出ないように）
    const alpha = isCutout ? new Uint8ClampedArray(w * h) : null
    if (alpha) {
        for (let j = 0, i = 0; j < w * h; j++, i += 4) {
            alpha[j] = d[i + 3]
            if (d[i + 3] < 8) {
                d[i] = d[i + 1] = d[i + 2] = 255
            }
        }
    }

    // 調整前の輝度（おまかせの明るさ合わせ用。間引いて速く）
    const ys: number[] = []
    for (let i = 0; i < d.length; i += 4 * 3) ys.push(luma(d[i], d[i + 1], d[i + 2]))

    const figureLine = lineWidthOf(d, w, h) ?? FALLBACK_LINE
    const dots = dotsFor(figureLine)
    // 主線（＝ふちどり）くらいの太さで DoG を取ると、毛穴や髪 1 本までは拾わず、顔のアップでも破綻しにくい
    const lineWidth = Math.max(1, Math.round(Math.min(w, h) / 600))
    const brightness = fitBrightness(Float32Array.from(ys), LOOK.contrast, LEVELS, LOOK.dark)
    // 明るさ・コントラストの補正は強さに比例させる（弱ほど元の明るさに近い）。
    // これをしないと、弱でも「薄めの平均濃度」に合わせて全体が明るくなりすぎる（2026-11-01 ユーザー指摘）
    const bAdj = brightness * STRENGTH
    const cAdj = LOOK.contrast * STRENGTH

    // 明るさ・コントラストを掛けて白黒化した絵（DoG と最終描画に使う）
    const gray = new Uint8ClampedArray(d.length)
    adjustBrightnessContrast(d, gray, bAdj, cAdj)
    for (let i = 0; i < gray.length; i += 4) {
        const y = luma(gray[i], gray[i + 1], gray[i + 2])
        gray[i] = gray[i + 1] = gray[i + 2] = y
    }
    const gc = makeCanvas(w, h)
    gc.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(gray), w, h), 0, 0)
    const near = pixelsOf(blurred(gc, lineWidth * 0.5))
    const far = pixelsOf(blurred(gc, lineWidth * 1.6))
    const lines = fitLines(near, far, LOOK.lines)

    const out = new Uint8ClampedArray(d.length)
    mangaPixels(gray, out, w, { levels: LEVELS, dots, lines }, near, far)

    // 強さ分だけ漫画化し、残りは白黒化した元の濃淡を残す（顔アップで変化が大きすぎないように）
    if (STRENGTH < 1) {
        for (let i = 0; i < out.length; i += 4) {
            const v = gray[i] + (out[i] - gray[i]) * STRENGTH
            out[i] = out[i + 1] = out[i + 2] = v
        }
    }

    // 切り抜きは元の α を戻す（白くした透明部を消す）
    if (alpha) {
        for (let j = 0, i = 0; j < w * h; j++, i += 4) out[i + 3] = alpha[j]
    }

    const result = makeCanvas(w, h)
    result.getContext('2d')!.putImageData(new ImageData(out, w, h), 0, 0)
    return canvasToDataUrl(result)
}

/** merged 背景（元画像）の上に、漫画化した人物の切り抜きを重ねて 1 枚にする（.ora 用） */
export async function compositeOver(baseImg: HTMLImageElement, overlayDataUrl: string): Promise<string> {
    const overlay = await loadImage(overlayDataUrl)
    const w = baseImg.naturalWidth || baseImg.width,
        h = baseImg.naturalHeight || baseImg.height
    const c = makeCanvas(w, h)
    const ctx = c.getContext('2d')!
    ctx.drawImage(baseImg, 0, 0, w, h)
    ctx.drawImage(overlay, 0, 0, w, h)
    return canvasToDataUrl(c)
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = src
    })
}

function canvasToDataUrl(c: Canvas2D): string {
    // OffscreenCanvas には toDataURL が無いので、表示用の canvas に写してから出す
    const el = document.createElement('canvas')
    el.width = c.width
    el.height = c.height
    el.getContext('2d')!.drawImage(c, 0, 0)
    return el.toDataURL('image/png')
}

export { loadImage }
