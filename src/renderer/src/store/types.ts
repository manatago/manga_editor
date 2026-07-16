export type PanelType = 'rect' | 'slanted' | 'trapezoid-h' | 'trapezoid-v' | 'pentagon' | 'hexagon' | 'circle'

export type MosaicType = 'pixel-12' | 'frosted' | 'white-blur' | 'none'

export interface MosaicRegion {
    id: string
    x: number
    y: number
    width: number
    height: number
    type: MosaicType
}

export type FadeDirection =
    | 'none'
    | 'top'
    | 'bottom'
    | 'left'
    | 'right'
    | 'top-left'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-right'

export type GradientType = 'none' | 'linear' | 'radial'

/** ページ／コマの背景トーン・画像のフィット */
export type PageBackgroundImageFit = 'tile' | 'stretch'

export interface Panel {
    id: string
    type: PanelType
    x: number
    y: number
    width: number
    height: number
    rotation?: number
    strokeWidth: number
    strokeColor: string
    slant: number
    offsetB: number
    offsetC: number
    offsetD: number
    imagePath?: string
    imageX?: number
    imageY?: number
    imageScale?: number
    imageRotation?: number
    fadeDirection?: FadeDirection
    fadeDirections?: FadeDirection[]
    hasFocusLines?: boolean
    focusCenterX?: number
    focusCenterY?: number
    focusDensity?: number
    focusWidth?: number
    isAdjustingFocus?: boolean
    focusRadius?: number
    fadeStrength?: number
    isGrayscale?: boolean
    /** グレースケール時の明るさ調整（Konva Brighten。-0.5 ほど暗く、+0.5 ほど明るく） */
    grayscaleBrightness?: number
    imageFlipX?: boolean
    /** 人物画像をコマ枠の外へはみ出させる（背景は枠内クリップのまま、切り抜き人物だけ枠上に再描画）。 */
    imageProtrude?: boolean
    /** はみ出し用の人物切り抜き（背景透過）。imagePath は元画像のまま枠内に残す。未設定時は imagePath で代用。 */
    protrudeImagePath?: string
    /** はみ出し時、コマ内に残る背景（元画像）の不透明度 0..1（既定 1）。下げると背景が薄くなる。 */
    protrudeBgOpacity?: number
    /** はみ出し時、コマ内に残る背景（元画像）のぼかし半径（既定 0）。 */
    protrudeBgBlur?: number
    backgroundColor?: string
    backgroundOpacity?: number
    bgGradientType?: GradientType
    bgGradientStartColor?: string
    bgGradientEndColor?: string
    bgGradientRotation?: number
    blurRadius?: number
    hasRainEffect?: boolean
    rainDensity?: number
    rainOpacity?: number
    /** 集中線・雨・スピード線・シャボン玉などのエフェクトを、人物画像の背面
        （背景と人物の間）に描画する。人物が切り抜き（背景透過）の時に効果的。 */
    effectsBehindImage?: boolean
    /** スピード線（流線）エフェクト */
    hasSpeedLines?: boolean
    speedLineDensity?: number
    speedLineOpacity?: number
    speedLineDirection?: 'horizontal' | 'vertical'
    /** シャボン玉エフェクト */
    hasBubbleEffect?: boolean
    bubbleEffectDensity?: number
    bubbleEffectOpacity?: number
    /** 点描（砂目）サークル エフェクト */
    hasDotCircles?: boolean
    dotCircleCount?: number
    dotCircleOpacity?: number
    /** 円の大きさ・位置を決める乱数シード（変えると配置が変わる） */
    dotCircleSeed?: number
    /** 円の大きさ倍率（既定 0.5。大きいほど円が大きい） */
    dotCircleSize?: number
    /** 点の密度倍率（既定 1。上げるほど点が細かく多くなり滑らかになる） */
    dotCircleDensity?: number
    /** 点の色（既定 black）。white は濃い背景・トーン上で使う */
    dotCircleColor?: 'black' | 'white'
    /** 砂嵐（ノイズ）エフェクト */
    hasSandStorm?: boolean
    sandStormDensity?: number
    sandStormOpacity?: number
    /** コマ内の人物画像の下に重ねるトーン／画像（ページ背景とは独立） */
    backgroundImagePath?: string
    backgroundImageOpacity?: number
    backgroundImageFit?: PageBackgroundImageFit
    backgroundImageScale?: number
    backgroundImageRotation?: number
    backgroundImageBlur?: number
    backgroundImageOffsetX?: number
    backgroundImageOffsetY?: number
    backgroundImageFadeDirections?: FadeDirection[]
    backgroundImageFadeStrength?: number
    /** コマ内の人物画像の前面に重ねるトーン */
    fgTonePath?: string
    fgToneOpacity?: number
    fgToneScale?: number
    fgToneRotation?: number
    fgToneBlur?: number
    fgToneOffsetX?: number
    fgToneOffsetY?: number
    fgToneFadeDirections?: FadeDirection[]
    fgToneFadeStrength?: number
    /** NovelAI 生成用の入力保存（コマ単位） */
    novelai?: NovelAIPanelConfig
}

export type NovelAIAspect = 'portrait' | 'square' | 'landscape' | 'wide' | 'tall'
export type PreciseRefType = 'character' | 'style' | 'character&style'
export type PreciseRefSource = 'character-image' | 'composite'

export interface PreciseReferenceEntry {
    source: PreciseRefSource
    /** character-image: `${charId}/${imageId}` 形式 / composite: 相対パス（assets/composites/...） */
    id: string
    strength: number
    fidelity: number
    type: PreciseRefType
}

export interface NovelAIPanelConfig {
    situationPrompt?: string
    supplementaryPrompt?: string
    negativeOverride?: string
    aspect?: NovelAIAspect
    /** 参照キャラクター ID（最大 6、order-based で左→右に並ぶ） */
    characterRefIds?: string[]
    /** 精密参照（最大 2 件） */
    preciseRefs?: PreciseReferenceEntry[]
    /** 直近使用したシード（再現用。空なら毎回ランダム） */
    lastSeed?: number
    /** このコマで生成した画像の履歴（新しいものが末尾） */
    history?: NovelAIHistoryEntry[]
}

/** コマごとの NovelAI 生成履歴エントリ。実ファイルは assets/images/novelai/<panelId>/ に保存される */
export interface NovelAIHistoryEntry {
    /** assets/images/novelai/<panelId>/<timestamp>_<seed>.png */
    relativePath: string
    seed: number
    /** 生成時の UNIX ms */
    createdAt: number
    /** 生成時のプロンプト（後追い確認用） */
    situationPrompt?: string
    supplementaryPrompt?: string
    aspect?: NovelAIAspect
    width?: number
    height?: number
    /** 外部から取り込んだ画像（NovelAI 生成ではない）。seed は持たない。 */
    imported?: boolean
}

/** アプリ全体（userData）に登録したカスタムスクリーントーン。custom-tone://{id} で参照 */
export interface CustomToneEntry {
    id: string
    name: string
}

export type BubbleType = 'rounded' | 'jagged' | 'rect' | 'flash' | 'shout' | 'square-jagged' | 'megaphone' | 'rect-double'

export interface Bubble {
    id: string
    type: BubbleType
    x: number
    y: number
    width: number
    height: number
    text: string
    fontSize: number
    fontFamily: string
    lineHeight: number
    letterSpacing: number
    textStrokeColor?: string
    textStrokeWidth?: number
    textWeightLevel?: 0 | 1 | 2
    textRoughness?: number
    fontColor: string
    fontWeight: string
    isVertical: boolean
    backgroundColor: string
    backgroundOpacity: number
    borderColor: string
    borderWidth: number
    opacity: number
    textOffsetX: number
    textOffsetY: number
    deformation: number
    tailX?: number
    tailY?: number
    tailControlX?: number
    tailControlY?: number
    tailWidth?: number
    spikeCount?: number
    flashLength?: number
    /** flash（ウニ）背景の不透明で塗る半径（endRadius に対する 0..1）。ここから外へ透明にフェード。既定 0.55 */
    flashFillRadius?: number
    narrowRatio?: number
    tailType?: 'point' | 'thought'
    isClipped: boolean
    panelId?: string
    rotation: number
    /** undefined / 'off' は従来通り手動。'shrink-font' は枠を保ったまま文字を縮める。
     *  'expand-bubble' は文字サイズを保ったまま枠を広げる。MVP は横書き矩形系のみ対応 */
    autoFitMode?: 'off' | 'shrink-font' | 'expand-bubble'
}

export interface Material {
    id: string
    imagePath: string
    x: number
    y: number
    width: number
    height: number
    rotation: number
    opacity: number
    isClipped: boolean
    panelId?: string
    isGrayscale?: boolean
    /** グレースケール時の明るさ調整（Konva Brighten。-0.5 ほど暗く、+0.5 ほど明るく） */
    grayscaleBrightness?: number
    whiteAlphaThreshold?: number
    /** モザイクより前面（上）に描画する。D&D で追加した素材は既定で true。 */
    aboveMosaic?: boolean
}

export interface Page {
    id: string
    name: string
    pageWidth?: number
    pageHeight?: number
    gridEnabled?: boolean
    gridSize?: number
    panels: Panel[]
    bubbles: Bubble[]
    materials: Material[]
    mosaics?: MosaicRegion[]
    backgroundColor?: string
    backgroundOpacity?: number
    bgGradientType?: GradientType
    bgGradientStartColor?: string
    bgGradientEndColor?: string
    bgGradientRotation?: number
    /** スクリーントーン or ライブラリ画像。`builtin://` で内蔵 */
    backgroundImagePath?: string
    /** トーン・画像を重ねる不透明度（0〜1） */
    backgroundImageOpacity?: number
    /** 未指定時: 内蔵は tile、assets は stretch */
    backgroundImageFit?: PageBackgroundImageFit
}

export interface PageTemplate {
    id: string
    name: string
    panels: Omit<Panel, 'id'>[]
}

/** 参照用キャラクターに紐づく画像（プロジェクト内相対パス） */
export interface ReferenceCharacterImage {
    id: string
    /** 例: assets/reference/characters/{characterId}/xxx.png */
    relativePath: string
    addedAt: string
}

/** AI 参照・整理用のキャラクター単位メタデータ */
export interface ReferenceCharacter {
    id: string
    name: string
    positivePrompt: string
    negativePrompt: string
    images: ReferenceCharacterImage[]
}

/** 背景ライブラリに登録した自作画像 */
export interface BackgroundLibraryImage {
    id: string
    name: string
    /** assets/reference/backgrounds/... */
    relativePath: string
    addedAt: string
}

export interface MangaProjectData {
    pages: Page[]
    lastPageId: string | null
    /** 漫画ページ以外の参照キャラ管理（manga.json に保存） */
    referenceCharacters?: ReferenceCharacter[]
    /** 背景用に登録した自作画像一覧 */
    backgroundLibrary?: BackgroundLibraryImage[]
    /** 作品全体の原稿メモ */
    manuscript?: string
}
