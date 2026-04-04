export type PanelType = 'rect' | 'slanted' | 'trapezoid-h' | 'trapezoid-v' | 'pentagon' | 'hexagon' | 'circle'

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
    /** コマ内の人物画像の下に重ねるトーン／画像（ページ背景とは独立） */
    backgroundImagePath?: string
    backgroundImageOpacity?: number
    backgroundImageFit?: PageBackgroundImageFit
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
    narrowRatio?: number
    tailType?: 'point' | 'thought'
    isClipped: boolean
    panelId?: string
    rotation: number
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
}
