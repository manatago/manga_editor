import { app, ipcMain, nativeImage, net, safeStorage } from 'electron'
import * as fs from 'fs'
import * as pathModule from 'path'
import { unzipSync } from 'fflate'
import { ASSETS_DUST_DIR, ASSETS_IMAGES_DIR } from '../assetsLayoutRoot'
import { sanitizePanelId } from './sanitizers'

const NOVELAI_DEFAULT_NEGATIVE =
    'nsfw, lowres, {bad}, error, fewer, extra, missing, worst quality, jpeg artifacts, ' +
    'bad quality, watermark, unfinished, displeasing, chromatic aberration, signature, ' +
    'extra digits, artistic error, username, scan, [abstract]'
const NOVELAI_QUALITY_PREFIX = 'best quality, amazing quality, very aesthetic, '
const NOVELAI_ASPECT_MAP = {
    portrait: { width: 832, height: 1216 },
    square: { width: 1024, height: 1024 },
    landscape: { width: 1216, height: 832 }
} as const

type NovelAIGeneratePayload = {
    aspect?: 'portrait' | 'square' | 'landscape'
    situationPrompt?: string
    supplementaryPrompt?: string
    characterPrompts?: Array<{ prompt: string; uc?: string }>
    negativeOverride?: string
    seed?: number | null
    preciseRefs?: Array<{
        imageBase64Png: string
        strength: number
        fidelity: number
        type: 'character' | 'style' | 'character&style'
    }>
    /** 保存先のプロジェクトルート（絶対パス） */
    projectPath: string
    /** 保存先のサブディレクトリに使うコマ ID。outputSubPath を指定する場合は不要。 */
    panelId?: string
    /** assets/ 直下からの保存サブパス。指定時はこちらを優先（参照キャラ用などコマ以外の保存に使う）。 */
    outputSubPath?: string
}

type NovelAIInpaintPayload = {
    /** 保存先のプロジェクトルート（絶対パス） */
    projectPath: string
    /** 保存先のサブディレクトリに使うコマ ID（生成と同じ場所に保存する） */
    panelId: string
    /** 再描画元の画像（assets/ からの相対パス。manga.json の history と同じ形式） */
    sourceRelativePath: string
    /** 白=再描画 の PNG マスク（data URL または素の base64。サイズは元画像に一致） */
    maskBase64Png: string
    situationPrompt?: string
    supplementaryPrompt?: string
    /** 塗った範囲に効かせる追加タグ（任意） */
    inpaintPrompt?: string
    characterPrompts?: Array<{ prompt: string; uc?: string }>
    negativeOverride?: string
    seed?: number | null
}

/** NovelAI トークンは safeStorage で暗号化して userData 配下に保存 */
const novelaiTokenFile = (): string => pathModule.join(app.getPath('userData'), 'novelai-token.enc')

function loadStoredNovelAIToken(): string {
    const p = novelaiTokenFile()
    if (!fs.existsSync(p) || !safeStorage.isEncryptionAvailable()) return ''
    try { return safeStorage.decryptString(fs.readFileSync(p)) } catch { return '' }
}

/** NovelAI API の応答 ZIP の中から最初の PNG を取り出す */
function extractFirstPngFromZipBuffer(buf: Buffer): Buffer | null {
    const entries = unzipSync(new Uint8Array(buf))
    for (const name of Object.keys(entries)) {
        if (name.toLowerCase().endsWith('.png')) {
            return Buffer.from(entries[name])
        }
    }
    return null
}

/** data URL（または素の base64 文字列）を Buffer に変換 */
function decodeBase64Image(input: string): Buffer {
    const s = String(input ?? '')
    const comma = s.indexOf(',')
    const b64 = s.startsWith('data:') && comma >= 0 ? s.slice(comma + 1) : s
    return Buffer.from(b64, 'base64')
}

/** 保存先ディレクトリを決定（outputSubPath 優先、無ければ panelId 配下）。不正なら null */
function resolveOutDir(
    projectRoot: string,
    payload: { outputSubPath?: string; panelId?: string }
): string | null {
    const subPathRaw = String(payload.outputSubPath ?? '').replace(/\\/g, '/').trim()
    if (subPathRaw) {
        const parts = subPathRaw.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean)
        if (parts.length === 0 || parts.some((seg) => seg === '..' || seg === '.')) return null
        const outDir = pathModule.join(projectRoot, 'assets', ...parts)
        const assetsRoot = pathModule.resolve(pathModule.join(projectRoot, 'assets'))
        const rel = pathModule.relative(assetsRoot, pathModule.resolve(outDir))
        if (rel.startsWith('..') || pathModule.isAbsolute(rel)) return null
        return outDir
    }
    const panelKey = sanitizePanelId(payload.panelId ?? '')
    return pathModule.join(projectRoot, 'assets', ASSETS_IMAGES_DIR, 'novelai', panelKey)
}

/** NovelAI の parameters（v4 prompt 構造）を組み立てる。generate / infill 共通 */
function buildNovelAIParameters(opts: {
    width: number
    height: number
    situation: string
    supplementary: string
    chars: Array<{ prompt: string; uc: string }>
    negative: string
    seed: number
    refs?: NovelAIGeneratePayload['preciseRefs']
}): Record<string, unknown> {
    const { width, height, situation, supplementary, chars, negative, seed } = opts
    const baseCaption = `${NOVELAI_QUALITY_PREFIX}${[situation, supplementary].filter(Boolean).join(', ')}`
    const fullInput = chars.length
        ? `${baseCaption}, ${chars.map((c) => c.prompt).join(', ')}`
        : baseCaption
    const charCaptions = chars.map((c) => ({
        char_caption: c.prompt,
        centers: [{ x: 0.5, y: 0.5 }]
    }))
    const characterPromptsArray = chars.map((c) => ({
        prompt: c.prompt,
        uc: c.uc,
        center: { x: 0.5, y: 0.5 },
        enabled: true
    }))

    const parameters: Record<string, unknown> = {
        width,
        height,
        scale: 6.0,
        sampler: 'k_euler_ancestral',
        steps: 28,
        n_samples: 1,
        ucPreset: 0,
        qualityToggle: true,
        dynamic_thresholding: false,
        controlnet_strength: 1.0,
        legacy: false,
        add_original_image: false,
        cfg_rescale: 0,
        noise_schedule: 'karras',
        legacy_v3_extend: false,
        skip_cfg_above_sigma: null,
        params_version: 3,
        seed,
        input: fullInput,
        negative_prompt: negative,
        v4_prompt: {
            caption: {
                base_caption: baseCaption,
                char_captions: charCaptions
            },
            use_coords: false,
            use_order: true
        },
        v4_negative_prompt: {
            caption: {
                base_caption: negative,
                char_captions: chars.map((c) => ({
                    char_caption: c.uc,
                    centers: [{ x: 0.5, y: 0.5 }]
                }))
            },
            use_coords: false,
            use_order: false,
            legacy_uc: false
        },
        characterPrompts: characterPromptsArray,
        deliberate_euler_ancestral_bug: false,
        prefer_brownian: true,
        action: 'generate'
    }

    const refs = (opts.refs ?? []).slice(0, 5)
    if (refs.length > 0) {
        parameters.director_reference_images = refs.map((r) => r.imageBase64Png)
        parameters.director_reference_descriptions = refs.map((r) => ({
            caption: { base_caption: r.type, char_captions: [] },
            legacy_uc: false
        }))
        parameters.director_reference_strength_values = refs.map((r) =>
            Math.round(Math.max(0, Math.min(1, r.strength)) * 100) / 100
        )
        parameters.director_reference_secondary_strength_values = refs.map((r) =>
            Math.round(Math.max(0, Math.min(1, 1 - r.fidelity)) * 100) / 100
        )
        parameters.director_reference_information_extracted = refs.map(() => 1.0)
        parameters.normalize_reference_strength_multiple = false
    }

    return parameters
}

type PostAndSaveResult =
    | { ok: true; relativePath: string; seed: number; width: number; height: number; createdAt: number }
    | { ok: false; error: string; status?: number; message?: string }

/** NovelAI に POST（429/5xx は最大3回リトライ）→ 応答 PNG を outDir に保存して相対パスを返す */
async function postGenerateAndSave(
    token: string,
    body: unknown,
    projectRoot: string,
    outDir: string,
    seed: number,
    width: number,
    height: number
): Promise<PostAndSaveResult> {
    let lastError: string | null = null
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const resp = await net.fetch('https://image.novelai.net/ai/generate-image', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            })
            if (resp.status === 402) {
                return { ok: false, error: 'anlas-insufficient', status: 402 }
            }
            if (resp.status === 429 || resp.status >= 500) {
                lastError = `HTTP ${resp.status}`
                await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
                continue
            }
            if (!resp.ok) {
                const text = await resp.text().catch(() => '')
                return { ok: false, error: 'http-error', status: resp.status, message: text.slice(0, 500) }
            }
            const buffer = Buffer.from(await resp.arrayBuffer())
            const png = extractFirstPngFromZipBuffer(buffer)
            if (!png) {
                return { ok: false, error: 'zip-missing-png' }
            }
            if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
            const now = new Date()
            const pad = (n: number) => String(n).padStart(2, '0')
            const stampName = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}_${seed}`
            let filePath = pathModule.join(outDir, `${stampName}.png`)
            let suffix = 0
            while (fs.existsSync(filePath)) {
                suffix += 1
                filePath = pathModule.join(outDir, `${stampName}_${suffix}.png`)
            }
            fs.writeFileSync(filePath, png)
            const rel = pathModule.relative(projectRoot, filePath).split(pathModule.sep).join('/')
            return { ok: true, relativePath: rel, seed, width, height, createdAt: now.getTime() }
        } catch (e) {
            lastError = e instanceof Error ? e.message : String(e)
            await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
        }
    }
    return { ok: false, error: 'network', message: lastError ?? 'unknown' }
}

export function registerNovelAIHandlers(): void {
    ipcMain.handle('novelai:save-token', async (_, { token }: { token: string }) => {
        const t = String(token ?? '').trim()
        if (!t) {
            if (fs.existsSync(novelaiTokenFile())) fs.unlinkSync(novelaiTokenFile())
            return { saved: false }
        }
        if (!safeStorage.isEncryptionAvailable()) {
            throw new Error('OS の暗号化ストレージが使用できません')
        }
        const enc = safeStorage.encryptString(t)
        fs.writeFileSync(novelaiTokenFile(), enc)
        return { saved: true }
    })

    ipcMain.handle('novelai:load-token', async () => {
        const p = novelaiTokenFile()
        if (!fs.existsSync(p)) return { token: '' }
        if (!safeStorage.isEncryptionAvailable()) return { token: '' }
        try {
            const buf = fs.readFileSync(p)
            return { token: safeStorage.decryptString(buf) }
        } catch (e) {
            console.error('Main: failed to decrypt NovelAI token', e)
            return { token: '' }
        }
    })

    ipcMain.handle('novelai:clear-token', async () => {
        const p = novelaiTokenFile()
        if (fs.existsSync(p)) fs.unlinkSync(p)
        return { cleared: true }
    })

    ipcMain.handle('novelai:generate', async (_, payload: NovelAIGeneratePayload) => {
        const token = loadStoredNovelAIToken()
        if (!token) return { ok: false, error: 'token-missing' as const }

        const projectRoot = String(payload.projectPath ?? '').trim()
        if (!projectRoot || !fs.existsSync(projectRoot)) {
            return { ok: false, error: 'project-missing' as const }
        }
        // 保存先: outputSubPath が指定されていればそれを使い、無ければ従来どおり panelId 配下。
        const outDir = resolveOutDir(projectRoot, payload)
        if (!outDir) return { ok: false, error: 'invalid-output-path' as const }

        const aspectKey = payload.aspect ?? 'portrait'
        const { width, height } = NOVELAI_ASPECT_MAP[aspectKey]
        const situation = String(payload.situationPrompt ?? '').trim()
        const supplementary = String(payload.supplementaryPrompt ?? '').trim()
        const rawChars = Array.isArray(payload.characterPrompts) ? payload.characterPrompts : []
        const chars = rawChars
            .map((c) => ({ prompt: String(c?.prompt ?? '').trim(), uc: String(c?.uc ?? '').trim() }))
            .filter((c) => !!c.prompt)
            .slice(0, 6)
        const negative = String(payload.negativeOverride ?? '').trim() || NOVELAI_DEFAULT_NEGATIVE
        const seed = Number.isFinite(payload.seed as number)
            ? Math.floor(payload.seed as number) >>> 0
            : Math.floor(Math.random() * 2 ** 31) >>> 0

        const parameters = buildNovelAIParameters({
            width, height, situation, supplementary, chars, negative, seed, refs: payload.preciseRefs
        })
        const body = { model: 'nai-diffusion-4-5-full', parameters }

        // 送信前に「キャラが何人、どの prompt/uc で送られるか」を可視化（DevTools/メインログ用）
        // 実送信は切り詰めなし。ログ表示だけ 240 文字で丸めている
        console.log('[novelai:generate] chars sent to NovelAI:', {
            count: chars.length,
            seed,
            chars: chars.map((c, i) => ({
                idx: i,
                promptLen: c.prompt.length,
                ucLen: c.uc.length,
                prompt: c.prompt.length > 240 ? c.prompt.slice(0, 240) + '…(truncated)' : c.prompt,
                uc: c.uc.length > 240 ? c.uc.slice(0, 240) + '…(truncated)' : c.uc
            }))
        })

        return postGenerateAndSave(token, body, projectRoot, outDir, seed, width, height)
    })

    // 部分再描画（NovelAI infill）。塗ったマスク領域だけを再生成し、元コマと同じ場所に新しい履歴として保存する
    ipcMain.handle('novelai:inpaint', async (_, payload: NovelAIInpaintPayload) => {
        const token = loadStoredNovelAIToken()
        if (!token) return { ok: false, error: 'token-missing' as const }

        const projectRoot = String(payload.projectPath ?? '').trim()
        if (!projectRoot || !fs.existsSync(projectRoot)) {
            return { ok: false, error: 'project-missing' as const }
        }

        // 元画像をプロジェクト内に限定して解決
        const rel = String(payload.sourceRelativePath ?? '').replace(/\\/g, '/').replace(/^\/+/, '')
        if (!rel) return { ok: false, error: 'source-missing' as const }
        const srcAbs = pathModule.resolve(pathModule.join(projectRoot, ...rel.split('/')))
        const assetsRoot = pathModule.resolve(pathModule.join(projectRoot, 'assets'))
        const relFromAssets = pathModule.relative(assetsRoot, srcAbs)
        if (relFromAssets.startsWith('..') || pathModule.isAbsolute(relFromAssets)) {
            return { ok: false, error: 'out-of-project' as const }
        }
        if (!fs.existsSync(srcAbs)) return { ok: false, error: 'source-missing' as const }

        const srcBuf = fs.readFileSync(srcAbs)
        const { width, height } = nativeImage.createFromBuffer(srcBuf).getSize()
        if (!width || !height) return { ok: false, error: 'source-decode' as const }

        const maskBuf = decodeBase64Image(payload.maskBase64Png ?? '')
        if (maskBuf.length === 0) return { ok: false, error: 'mask-missing' as const }

        const outDir = resolveOutDir(projectRoot, { panelId: payload.panelId })
        if (!outDir) return { ok: false, error: 'invalid-output-path' as const }

        const situation = String(payload.situationPrompt ?? '').trim()
        const extra = String(payload.inpaintPrompt ?? '').trim()
        const supplementary = [String(payload.supplementaryPrompt ?? '').trim(), extra]
            .filter(Boolean)
            .join(', ')
        const rawChars = Array.isArray(payload.characterPrompts) ? payload.characterPrompts : []
        const chars = rawChars
            .map((c) => ({ prompt: String(c?.prompt ?? '').trim(), uc: String(c?.uc ?? '').trim() }))
            .filter((c) => !!c.prompt)
            .slice(0, 6)
        const negative = String(payload.negativeOverride ?? '').trim() || NOVELAI_DEFAULT_NEGATIVE
        const seed = Number.isFinite(payload.seed as number)
            ? Math.floor(payload.seed as number) >>> 0
            : Math.floor(Math.random() * 2 ** 31) >>> 0

        const parameters = buildNovelAIParameters({
            width, height, situation, supplementary, chars, negative, seed
        })
        // infill 専用パラメータ：塗っていない領域は元画像から合成して維持する
        parameters.action = 'infill'
        parameters.add_original_image = true
        parameters.image = srcBuf.toString('base64')
        parameters.mask = maskBuf.toString('base64')

        const body = { model: 'nai-diffusion-4-5-full-inpainting', action: 'infill', parameters }
        console.log('[novelai:inpaint] infill', { width, height, seed, chars: chars.length, extra })
        return postGenerateAndSave(token, body, projectRoot, outDir, seed, width, height)
    })

    /** 生成履歴から 1 件削除。assets/dust/ へ物理移動する */
    ipcMain.handle('novelai:delete-generation', async (_, { projectPath, relativePath }: { projectPath: string; relativePath: string }) => {
        const root = pathModule.resolve(String(projectPath ?? '').trim())
        const rel = String(relativePath ?? '').replace(/\\/g, '/').replace(/^\/+/, '')
        if (!root || !rel) return { moved: false as const, reason: 'invalid' as const }
        const src = pathModule.resolve(pathModule.join(root, ...rel.split('/')))
        const assetsRoot = pathModule.resolve(pathModule.join(root, 'assets'))
        const relFromAssets = pathModule.relative(assetsRoot, src)
        if (relFromAssets.startsWith('..') || pathModule.isAbsolute(relFromAssets)) {
            return { moved: false as const, reason: 'out-of-project' as const }
        }
        if (!fs.existsSync(src)) {
            return { moved: false as const, reason: 'missing' as const }
        }
        const dustDir = pathModule.join(assetsRoot, ASSETS_DUST_DIR)
        if (!fs.existsSync(dustDir)) fs.mkdirSync(dustDir, { recursive: true })
        const base = pathModule.basename(src)
        const ext = pathModule.extname(base)
        const stem = pathModule.basename(base, ext)
        let dest = pathModule.join(dustDir, `${Date.now()}_${stem}${ext}`)
        let n = 0
        while (fs.existsSync(dest)) {
            n += 1
            dest = pathModule.join(dustDir, `${Date.now()}_${n}_${stem}${ext}`)
        }
        try {
            fs.renameSync(src, dest)
        } catch {
            fs.copyFileSync(src, dest)
            fs.unlinkSync(src)
        }
        const relOut = pathModule.relative(root, dest).split(pathModule.sep).join('/')
        return { moved: true as const, relativePath: relOut }
    })

    ipcMain.handle('novelai:test-connection', async (_, { token }: { token?: string } = {}) => {
        let useToken = String(token ?? '').trim()
        if (!useToken) {
            const p = novelaiTokenFile()
            if (fs.existsSync(p) && safeStorage.isEncryptionAvailable()) {
                try { useToken = safeStorage.decryptString(fs.readFileSync(p)) } catch { useToken = '' }
            }
        }
        if (!useToken) return { ok: false, error: 'token-missing' as const }
        try {
            const resp = await net.fetch('https://api.novelai.net/user/subscription', {
                method: 'GET',
                headers: { Authorization: `Bearer ${useToken}` }
            })
            if (!resp.ok) {
                return { ok: false, status: resp.status, error: `http-${resp.status}` as const }
            }
            const json = await resp.json() as {
                trainingStepsLeft?: {
                    fixedTrainingStepsLeft?: number
                    purchasedTrainingSteps?: number
                }
                tier?: number
                active?: boolean
            }
            const fixed = json.trainingStepsLeft?.fixedTrainingStepsLeft ?? 0
            const purchased = json.trainingStepsLeft?.purchasedTrainingSteps ?? 0
            return {
                ok: true,
                anlas: fixed + purchased,
                fixedAnlas: fixed,
                purchasedAnlas: purchased,
                tier: json.tier ?? null,
                active: json.active ?? null
            }
        } catch (e) {
            console.error('Main: novelai test-connection failed', e)
            return { ok: false, error: 'network' as const, message: e instanceof Error ? e.message : String(e) }
        }
    })
}
