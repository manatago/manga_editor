import type {
    Bubble,
    FadeDirection,
    Material,
    MosaicRegion,
    NovelAIAspect,
    NovelAIHistoryEntry,
    NovelAIPanelConfig,
    Page,
    Panel,
    PreciseReferenceEntry,
    PreciseRefSource,
    PreciseRefType
} from '../../types'
import { toRelativeAssetPath } from '../../../utils/projectAssets'

const NOVELAI_ASPECTS: readonly NovelAIAspect[] = ['portrait', 'square', 'landscape', 'wide', 'tall']
const PRECISE_REF_TYPES: readonly PreciseRefType[] = ['character', 'style', 'character&style']
const PRECISE_REF_SOURCES: readonly PreciseRefSource[] = ['character-image', 'composite']
const FADE_DIRECTIONS: readonly string[] = [
    'top', 'bottom', 'left', 'right',
    'top-left', 'top-right', 'bottom-left', 'bottom-right'
]

export function sanitizeNovelAIPanelConfig(raw: unknown): NovelAIPanelConfig | undefined {
    if (!raw || typeof raw !== 'object') return undefined
    const r = raw as Record<string, unknown>
    const out: NovelAIPanelConfig = {}
    if (typeof r.situationPrompt === 'string') out.situationPrompt = r.situationPrompt
    if (typeof r.supplementaryPrompt === 'string') out.supplementaryPrompt = r.supplementaryPrompt
    if (typeof r.negativeOverride === 'string') out.negativeOverride = r.negativeOverride
    if (typeof r.aspect === 'string' && (NOVELAI_ASPECTS as readonly string[]).includes(r.aspect)) {
        out.aspect = r.aspect as NovelAIAspect
    }
    if (Array.isArray(r.characterRefIds)) {
        const ids = r.characterRefIds.filter((v): v is string => typeof v === 'string' && !!v).slice(0, 6)
        if (ids.length) out.characterRefIds = ids
    } else if (typeof r.characterRefId === 'string' && r.characterRefId) {
        // 旧形式（単数）→ 配列へ移行
        out.characterRefIds = [r.characterRefId]
    }
    if (Array.isArray(r.preciseRefs)) {
        const refs: PreciseReferenceEntry[] = []
        for (const it of r.preciseRefs) {
            if (!it || typeof it !== 'object') continue
            const e = it as Record<string, unknown>
            if (typeof e.source !== 'string' || !(PRECISE_REF_SOURCES as readonly string[]).includes(e.source)) continue
            if (typeof e.id !== 'string' || !e.id) continue
            const strength = typeof e.strength === 'number' ? Math.max(0, Math.min(1, e.strength)) : 0.7
            const fidelity = typeof e.fidelity === 'number' ? Math.max(0, Math.min(1, e.fidelity)) : 0.7
            const type = typeof e.type === 'string' && (PRECISE_REF_TYPES as readonly string[]).includes(e.type)
                ? (e.type as PreciseRefType) : 'character'
            refs.push({ source: e.source as PreciseRefSource, id: e.id, strength, fidelity, type })
            if (refs.length >= 5) break
        }
        if (refs.length) out.preciseRefs = refs
    }
    if (typeof r.lastSeed === 'number' && Number.isFinite(r.lastSeed)) {
        out.lastSeed = Math.floor(r.lastSeed) >>> 0
    }
    if (Array.isArray(r.history)) {
        const hist: NovelAIHistoryEntry[] = []
        for (const it of r.history) {
            if (!it || typeof it !== 'object') continue
            const e = it as Record<string, unknown>
            if (typeof e.relativePath !== 'string' || !e.relativePath) continue
            if (typeof e.seed !== 'number' || !Number.isFinite(e.seed)) continue
            if (typeof e.createdAt !== 'number' || !Number.isFinite(e.createdAt)) continue
            const entry: NovelAIHistoryEntry = {
                relativePath: e.relativePath,
                seed: Math.floor(e.seed) >>> 0,
                createdAt: Math.floor(e.createdAt)
            }
            if (typeof e.situationPrompt === 'string') entry.situationPrompt = e.situationPrompt
            if (typeof e.supplementaryPrompt === 'string') entry.supplementaryPrompt = e.supplementaryPrompt
            if (typeof e.aspect === 'string' && (NOVELAI_ASPECTS as readonly string[]).includes(e.aspect)) {
                entry.aspect = e.aspect as NovelAIAspect
            }
            if (typeof e.width === 'number' && Number.isFinite(e.width)) entry.width = Math.floor(e.width)
            if (typeof e.height === 'number' && Number.isFinite(e.height)) entry.height = Math.floor(e.height)
            if (e.imported === true) entry.imported = true
            hist.push(entry)
        }
        if (hist.length) out.history = hist
    }
    // すべて空なら undefined を返して manga.json を汚さない
    if (Object.keys(out).length === 0) return undefined
    return out
}

function relativizeAsset(projectPath: string | null, value: string | undefined): string | undefined {
    if (!value) return value
    if (!projectPath) return value
    return toRelativeAssetPath(projectPath, value) ?? value
}

function relativizeWithProtocol(
    projectPath: string | null,
    value: string | undefined,
    protocols: readonly string[]
): string | undefined {
    if (!value) return undefined
    if (protocols.some((p) => value.startsWith(p))) return value
    return relativizeAsset(projectPath, value)
}

const VALID_AUTO_FIT_MODES = new Set(['off', 'shrink-font', 'expand-bubble'])

function sanitizeBubble(bubble: Bubble): Bubble {
    return {
        ...bubble,
        fontSize: bubble.fontSize || 22,
        backgroundOpacity: bubble.backgroundOpacity ?? 1,
        lineHeight: bubble.lineHeight ?? 1.0,
        fontWeight: bubble.fontWeight || 'bold',
        spikeCount: bubble.spikeCount || 36,
        narrowRatio: bubble.narrowRatio ?? 0.3,
        flashLength: bubble.flashLength || 1,
        flashFillRadius: bubble.flashFillRadius ?? 0.55,
        tailType: bubble.tailType || 'point',
        rotation: bubble.rotation ?? 0,
        autoFitMode:
            bubble.autoFitMode && VALID_AUTO_FIT_MODES.has(bubble.autoFitMode)
                ? bubble.autoFitMode
                : undefined
    }
}

function sanitizePanel(panel: Panel, projectPath: string | null): Panel {
    let width = panel.width
    let height = panel.height
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((width === undefined || width === null) && (panel as any).points) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pts = (panel as any).points
        width = pts[2] - pts[0]
        height = pts[5] - pts[1]
    }
    return {
        ...panel,
        type: panel.type || 'rect',
        width: width || 200,
        height: height || 150,
        rotation: panel.rotation ?? 0,
        x: panel.x || 0,
        y: panel.y || 0,
        strokeWidth: panel.strokeWidth ?? 1,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        strokeColor: (panel as any).strokeColor || '#000000',
        slant: panel.slant || 0,
        offsetB: panel.offsetB || 0,
        offsetC: panel.offsetC || 0,
        offsetD: panel.offsetD || 0,
        imageX: panel.imageX || 0,
        imageY: panel.imageY || 0,
        imageScale: panel.imageScale ?? 1,
        imageRotation: panel.imageRotation ?? 0,
        fadeDirection: panel.fadeDirection || 'none',
        fadeDirections: panel.fadeDirections
            ?? (panel.fadeDirection && panel.fadeDirection !== 'none'
                ? [panel.fadeDirection as FadeDirection]
                : []),
        hasFocusLines: panel.hasFocusLines || false,
        focusCenterX: panel.focusCenterX ?? 0.5,
        focusCenterY: panel.focusCenterY ?? 0.5,
        focusDensity: panel.focusDensity ?? 100,
        focusWidth: panel.focusWidth ?? 1,
        focusRadius: panel.focusRadius ?? 50,
        fadeStrength: panel.fadeStrength ?? 0.4,
        isGrayscale: panel.isGrayscale ?? false,
        grayscaleBrightness:
            typeof panel.grayscaleBrightness === 'number' && !Number.isNaN(panel.grayscaleBrightness)
                ? Math.max(-0.5, Math.min(0.5, panel.grayscaleBrightness))
                : 0,
        imageFlipX: panel.imageFlipX ?? false,
        imageProtrude: panel.imageProtrude ?? false,
        blurRadius: panel.blurRadius ?? 0,
        hasRainEffect: panel.hasRainEffect ?? false,
        rainDensity: panel.rainDensity ?? 100,
        rainOpacity: panel.rainOpacity ?? 0.3,
        effectsBehindImage: panel.effectsBehindImage ?? false,
        hasSpeedLines: panel.hasSpeedLines ?? false,
        speedLineDensity: panel.speedLineDensity ?? 120,
        speedLineOpacity: panel.speedLineOpacity ?? 0.85,
        speedLineDirection: panel.speedLineDirection ?? 'horizontal',
        hasBubbleEffect: panel.hasBubbleEffect ?? false,
        bubbleEffectDensity: panel.bubbleEffectDensity ?? 20,
        bubbleEffectOpacity: panel.bubbleEffectOpacity ?? 0.5,
        hasDotCircles: panel.hasDotCircles ?? false,
        dotCircleCount: panel.dotCircleCount ?? 8,
        dotCircleOpacity: panel.dotCircleOpacity ?? 0.85,
        dotCircleSeed: panel.dotCircleSeed ?? 0,
        dotCircleSize: panel.dotCircleSize ?? 0.5,
        hasSandStorm: panel.hasSandStorm ?? false,
        sandStormDensity: panel.sandStormDensity ?? 0.5,
        sandStormOpacity: panel.sandStormOpacity ?? 0.6,
        imagePath: relativizeAsset(projectPath, panel.imagePath),
        protrudeImagePath: relativizeAsset(projectPath, panel.protrudeImagePath),
        protrudeBgOpacity: panel.protrudeBgOpacity ?? 1,
        protrudeBgBlur: panel.protrudeBgBlur ?? 0,
        backgroundImagePath: relativizeWithProtocol(projectPath, panel.backgroundImagePath, ['builtin://', 'custom-tone://']),
        backgroundImageOpacity:
            panel.backgroundImageOpacity != null
                ? Math.max(0, Math.min(1, panel.backgroundImageOpacity))
                : 1,
        backgroundImageFit:
            panel.backgroundImageFit === 'stretch' || panel.backgroundImageFit === 'tile'
                ? panel.backgroundImageFit
                : undefined,
        backgroundImageScale:
            typeof panel.backgroundImageScale === 'number'
                ? Math.max(0.1, Math.min(10, panel.backgroundImageScale))
                : undefined,
        backgroundImageRotation:
            typeof panel.backgroundImageRotation === 'number'
                ? panel.backgroundImageRotation
                : undefined,
        backgroundImageBlur:
            typeof panel.backgroundImageBlur === 'number'
                ? Math.max(0, Math.min(40, panel.backgroundImageBlur))
                : undefined,
        backgroundImageOffsetX:
            typeof panel.backgroundImageOffsetX === 'number'
                ? panel.backgroundImageOffsetX
                : undefined,
        backgroundImageOffsetY:
            typeof panel.backgroundImageOffsetY === 'number'
                ? panel.backgroundImageOffsetY
                : undefined,
        backgroundImageFadeDirections: Array.isArray(panel.backgroundImageFadeDirections)
            ? panel.backgroundImageFadeDirections.filter((d) => FADE_DIRECTIONS.includes(d))
            : [],
        backgroundImageFadeStrength:
            typeof panel.backgroundImageFadeStrength === 'number'
                ? Math.max(0, Math.min(1, panel.backgroundImageFadeStrength))
                : undefined,
        fgTonePath: relativizeWithProtocol(projectPath, panel.fgTonePath, ['builtin://', 'custom-tone://']),
        fgToneOpacity:
            panel.fgToneOpacity != null
                ? Math.max(0, Math.min(1, panel.fgToneOpacity))
                : undefined,
        fgToneScale:
            typeof panel.fgToneScale === 'number'
                ? Math.max(0.1, Math.min(10, panel.fgToneScale))
                : undefined,
        fgToneRotation:
            typeof panel.fgToneRotation === 'number'
                ? panel.fgToneRotation
                : undefined,
        fgToneBlur:
            typeof panel.fgToneBlur === 'number'
                ? Math.max(0, Math.min(40, panel.fgToneBlur))
                : undefined,
        fgToneOffsetX:
            typeof panel.fgToneOffsetX === 'number'
                ? panel.fgToneOffsetX
                : undefined,
        fgToneOffsetY:
            typeof panel.fgToneOffsetY === 'number'
                ? panel.fgToneOffsetY
                : undefined,
        fgToneFadeDirections: Array.isArray(panel.fgToneFadeDirections)
            ? panel.fgToneFadeDirections.filter((d) => FADE_DIRECTIONS.includes(d))
            : [],
        fgToneFadeStrength:
            typeof panel.fgToneFadeStrength === 'number'
                ? Math.max(0, Math.min(1, panel.fgToneFadeStrength))
                : undefined,
        novelai: sanitizeNovelAIPanelConfig(panel.novelai)
    }
}

function sanitizeMosaic(m: MosaicRegion): MosaicRegion {
    return {
        id: m.id,
        x: m.x ?? 0,
        y: m.y ?? 0,
        width: Math.max(1, m.width ?? 0),
        height: Math.max(1, m.height ?? 0),
        type: m.type ?? 'pixel-12'
    }
}

function sanitizeMaterial(mat: Material, projectPath: string | null): Material {
    return {
        ...mat,
        opacity: mat.opacity ?? 1,
        isClipped: mat.isClipped ?? false,
        aboveMosaic: mat.aboveMosaic ?? false,
        isGrayscale: mat.isGrayscale ?? false,
        grayscaleBrightness:
            typeof mat.grayscaleBrightness === 'number' && !Number.isNaN(mat.grayscaleBrightness)
                ? Math.max(-0.5, Math.min(0.5, mat.grayscaleBrightness))
                : 0,
        imagePath: relativizeAsset(projectPath, mat.imagePath) ?? mat.imagePath
    }
}

export function sanitizePage(page: Page, projectPath: string | null): Page {
    return {
        ...page,
        pageWidth: Math.max(400, Math.round(page.pageWidth ?? 840)),
        pageHeight: Math.max(400, Math.round(page.pageHeight ?? 1188)),
        gridEnabled: !!page.gridEnabled,
        gridSize: Math.max(8, Math.min(200, Math.round(page.gridSize ?? 24))),
        backgroundColor: page.backgroundColor || '#ffffff',
        backgroundOpacity: page.backgroundOpacity ?? 1,
        bubbles: (page.bubbles || []).map(sanitizeBubble),
        panels: (page.panels || []).map((p) => sanitizePanel(p, projectPath)),
        mosaics: (page.mosaics || []).map(sanitizeMosaic),
        materials: (page.materials || []).map((m) => sanitizeMaterial(m, projectPath)),
        backgroundImagePath: relativizeWithProtocol(projectPath, page.backgroundImagePath, ['builtin://']),
        backgroundImageOpacity:
            page.backgroundImageOpacity != null
                ? Math.max(0, Math.min(1, page.backgroundImageOpacity))
                : 1,
        backgroundImageFit:
            page.backgroundImageFit === 'stretch' || page.backgroundImageFit === 'tile'
                ? page.backgroundImageFit
                : undefined
    }
}
