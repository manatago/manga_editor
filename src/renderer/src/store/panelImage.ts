import type { Panel } from './types'

/**
 * コマの主画像（imagePath）から作った派生データ。主画像を外す・差し替えるときは必ず一緒に外す。
 * 残すと描画がこちらを優先するため（漫画化 ON なら mangaImagePath、はみ出しなら protrudeImagePath）、
 * 新しい画像を入れても古い絵が出たままになる。
 */
export const DERIVED_IMAGE_RESET: Partial<Panel> = {
    isManga: undefined,
    mangaImagePath: undefined,
    mangaProtrudePath: undefined,
    mangaStamp: undefined,
    mangaLevel: undefined,
    imageProtrude: undefined,
    protrudeImagePath: undefined,
    protrudeOutsideOnly: undefined,
    oraSourcePath: undefined
}

/** コマの主画像を外す（Delete キーなど） */
export const clearPanelImage = (): Partial<Panel> => ({
    ...DERIVED_IMAGE_RESET,
    imagePath: undefined,
    imageX: undefined,
    imageY: undefined,
    imageScale: undefined,
    imageRotation: undefined,
    imageFlipX: undefined,
    isGrayscale: false,
    grayscaleBrightness: 0
})

/** コマの主画像を新しい画像にする（中央・等倍・回転なし） */
export const setPanelImage = (
    panel: Pick<Panel, 'width' | 'height'>,
    imagePath: string,
    over: Partial<Panel> = {}
): Partial<Panel> => ({
    ...DERIVED_IMAGE_RESET,
    imagePath,
    imageX: panel.width / 2,
    imageY: panel.height / 2,
    imageScale: 1,
    imageRotation: 0,
    imageFlipX: false,
    ...over
})
