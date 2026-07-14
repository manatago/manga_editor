import React, { useMemo } from 'react'
import { useMangaStore } from '../store/useMangaStore'
import { MagicWandEditorModal } from './MagicWandEditorModal'

/**
 * コマ画像のマジックワンド編集モーダル。
 * rembg の自動背景除去で取り切れなかった箇所を、クリックで手動透明化するための入口。
 * PanelItem のツールバー「手動で背景消し（ワンド）」から開かれる（ストア駆動）。
 * Konva ツリー内から DOM モーダルを直接描けないため、App 直下（DOM 階層）で描画する。
 */
export const PanelWandEditor: React.FC = () => {
    const targetPanelId = useMangaStore((s) => s.panelWandTargetId)
    const closePanelWandEditor = useMangaStore((s) => s.closePanelWandEditor)
    const updatePanel = useMangaStore((s) => s.updatePanel)
    const currentProjectPath = useMangaStore((s) => s.currentProjectPath)
    const pages = useMangaStore((s) => s.pages)

    // 対象コマは全ページから探す（通常は現在ページだが安全側に）
    const panel = useMemo(() => {
        if (!targetPanelId) return null
        for (const page of pages) {
            const p = page.panels.find((pp) => pp.id === targetPanelId)
            if (p) return p
        }
        return null
    }, [targetPanelId, pages])

    // はみ出しモードの時は「はみ出し用の切り抜き(protrudeImagePath)」を編集する。
    // こうすると枠内の元画像(imagePath, 背景つき)は無傷のまま、枠外へ出る人物の
    // シルエットだけをワンドで詰められる（rembg の取りこぼしを手動で補正）。
    const editingProtrude = !!panel?.imageProtrude
    const sourcePath = editingProtrude ? panel?.protrudeImagePath || panel?.imagePath : panel?.imagePath

    const imageUrl = useMemo(() => {
        if (!sourcePath) return ''
        if (window.electron?.resolveAssetPath && currentProjectPath) {
            return window.electron.pathToUrl(
                window.electron.resolveAssetPath(currentProjectPath, sourcePath)
            )
        }
        return window.electron ? window.electron.pathToUrl(sourcePath) : sourcePath
    }, [sourcePath, currentProjectPath])

    if (!panel || !sourcePath || !imageUrl) return null

    const handleSave = async (dataUrl: string) => {
        if (!currentProjectPath || !sourcePath || !window.electron) return
        // 編集後 PNG を元画像と同じ assets サブフォルダに「{元名}_wand.png」で保存
        const rel = sourcePath.replace(/\\/g, '/')
        const withoutAssets = rel.startsWith('assets/') ? rel.slice('assets/'.length) : rel
        const lastSlash = withoutAssets.lastIndexOf('/')
        // assets 配下でないパスは images/wand へ退避（sanitize で弾かれないように）
        const sub =
            rel.startsWith('assets/') && lastSlash >= 0 ? withoutAssets.slice(0, lastSlash) : 'images/wand'
        const fileName = withoutAssets.slice(lastSlash + 1)
        const base = fileName.replace(/\.[^.]+$/, '') || 'panel'
        const { relativePath } = await window.electron.saveWandPng(currentProjectPath, sub, base, dataUrl)
        // はみ出し中は切り抜き側を差し替え、通常時は元画像を差し替える
        updatePanel(panel.id, editingProtrude ? { protrudeImagePath: relativePath } : { imagePath: relativePath }, true)
        closePanelWandEditor()
    }

    return (
        <MagicWandEditorModal
            isOpen={true}
            onClose={closePanelWandEditor}
            imageUrl={imageUrl}
            onSave={handleSave}
        />
    )
}
