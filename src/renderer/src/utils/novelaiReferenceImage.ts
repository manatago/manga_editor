/**
 * NovelAI V4.5 Precise Reference 用に参照画像を 1024x1536 へ正規化する。
 * アスペクト比を維持して収まる最大サイズにリサイズ → 黒背景キャンバスに中央配置 → PNG base64。
 * 詳細は PRECISE_REFERENCE_SPEC.md。
 */

const TARGET_W = 1024
const TARGET_H = 1536

async function urlToImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error(`failed to load image: ${url}`))
        img.src = url
    })
}

/**
 * 任意の画像 URL（local-file://... や data:...）を 1024x1536 の黒パディング PNG base64（プレフィクスなし）に変換
 */
export async function normalizeReferenceImageToBase64Png(url: string): Promise<string> {
    const img = await urlToImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = TARGET_W
    canvas.height = TARGET_H
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D context unavailable')
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, TARGET_W, TARGET_H)

    const srcW = img.naturalWidth || img.width
    const srcH = img.naturalHeight || img.height
    if (!srcW || !srcH) throw new Error('source image has zero dimensions')
    const srcRatio = srcW / srcH
    const targetRatio = TARGET_W / TARGET_H
    let drawW: number, drawH: number
    if (srcRatio > targetRatio) {
        drawW = TARGET_W
        drawH = Math.round(TARGET_W / srcRatio)
    } else {
        drawH = TARGET_H
        drawW = Math.round(TARGET_H * srcRatio)
    }
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, Math.floor((TARGET_W - drawW) / 2), Math.floor((TARGET_H - drawH) / 2), drawW, drawH)

    const dataUrl = canvas.toDataURL('image/png')
    const marker = 'base64,'
    const idx = dataUrl.indexOf(marker)
    if (idx < 0) throw new Error('canvas PNG encoding failed')
    return dataUrl.slice(idx + marker.length)
}
