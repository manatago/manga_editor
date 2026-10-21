// gousei のシーン（.ora）をコマに読み込む。右の欄のボタンと、コマへのドラッグ＆ドロップで共通に使う。
// 全体の絵をコマの画像に、人物・前面物だけの絵をはみ出し用にする（gousei の切り抜きそのものなので rembg より確実）。

import type { Panel } from '../../store/types'
import { oraImages } from './oraComposite'
import { readOra } from './readOra'

export const isOraPath = (p: string): boolean => /\.ora$/i.test(p)

/**
 * @param reload 読み直し（位置と倍率はそのまま、絵だけ差し替える）
 * @returns 画面に出すひと言
 */
export async function importOraToPanel(
    panel: Panel,
    src: string,
    projectPath: string,
    updatePanel: (id: string, updates: Partial<Panel>, undoable?: boolean) => void,
    reload = false
): Promise<string> {
    const api = window.electron
    if (!api) throw new Error('デスクトップ版でだけ使えます')
    // local-file:// の fetch は CSP（default-src 'self'）で止められるので、main で読む
    const ora = readOra(new Uint8Array(await api.readOraFile(src)))
    const img = await oraImages(ora)
    const base = `ora_${panel.id}`.replace(/[^a-zA-Z0-9_-]/g, '')
    const full = await api.saveWandPng(projectPath, 'ora', base, img.full)
    const fig = img.protrude ? await api.saveWandPng(projectPath, 'ora', `${base}_figures`, img.protrude) : null
    // 初めてならコマを覆う大きさで中央に
    const fit = Math.max(panel.width / img.width, panel.height / img.height)
    updatePanel(panel.id, {
        imagePath: full.relativePath,
        protrudeImagePath: fig?.relativePath,
        imageProtrude: !!fig,
        protrudeOutsideOnly: true,
        oraSourcePath: src,
        ...(reload && panel.imagePath ? {} : { imageX: panel.width / 2, imageY: panel.height / 2, imageScale: fit, imageRotation: 0, imageFlipX: false })
    }, true)
    return fig
        ? `読み込みました（人物・前面物 ${img.figures} 個をはみ出せます）`
        : ora.fromGousei ? '読み込みました（人物・前面物はありません）' : '読み込みました（gousei のシーンでないので、はみ出しは使えません）'
}
