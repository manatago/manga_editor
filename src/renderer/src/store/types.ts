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
}

export interface PageTemplate {
    id: string
    name: string
    panels: Omit<Panel, 'id'>[]
}

export interface MangaProjectData {
    pages: Page[]
    lastPageId: string | null
}
