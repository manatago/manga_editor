/**
 * プロジェクト `assets/` 直下はフォルダのみ（ファイルとフォルダの混在を避ける）。
 * - images … コマ・素材・D&D 取り込み画像
 * - dust … 未使用整理で退避した画像（削除しない）
 * - references … 参照キャラ・背景ライブラリなど
 * - composites … 背景＋人物の合成ツールの出力 PNG（従来は images/composite/ だったが独立ディレクトリへ）
 */
export const ASSETS_IMAGES_DIR = 'images'
export const ASSETS_DUST_DIR = 'dust'
export const ASSETS_REFERENCES_DIR = 'references'
export const ASSETS_COMPOSITES_DIR = 'composites'

/** copyFileToProject で第3引数省略時は assets/images/ へ */
export const COPY_DEFAULT_ASSETS_SUBPATH = ASSETS_IMAGES_DIR

/** 背景ライブラリ: copy のサブパス（assets からの相対 = images|references|… の続き） */
export const BACKGROUND_LIBRARY_ASSETS_SUBPATH = `${ASSETS_REFERENCES_DIR}/backgrounds`

export function referenceCharacterAssetsSubpath(characterId: string): string {
    const safe = characterId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80)
    return `${ASSETS_REFERENCES_DIR}/characters/${safe || 'unknown'}`
}

/** 合成ツールの保存先（manga.json の相対パス接頭辞） */
export const ASSETS_COMPOSITES_PREFIX = `assets/${ASSETS_COMPOSITES_DIR}/`
/** @deprecated 旧パス接頭辞（`assets/images/composite/`）。ロード時に自動移行される */
export const ASSETS_IMAGES_COMPOSITE_PREFIX_LEGACY = `assets/${ASSETS_IMAGES_DIR}/composite/`
