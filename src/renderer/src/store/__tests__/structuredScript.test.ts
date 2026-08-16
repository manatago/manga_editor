import { describe, it, expect, beforeEach } from 'vitest'
import { useMangaStore } from '../useMangaStore'
import type { Page } from '../types'
import { kindOfBubble } from '../../utils/script/lineKinds'

function makePage(id: string): Page {
    return {
        id,
        name: '001',
        pageWidth: 840,
        pageHeight: 1188,
        panels: [],
        bubbles: [],
        materials: []
    }
}

describe('structuredSlice', () => {
    beforeEach(() => {
        useMangaStore.setState({
            pages: [makePage('p1')],
            archivedPages: [],
            currentPageId: 'p1',
            templates: [],
            referenceCharacters: [],
            selectedPanelId: null,
            selectedBubbleId: null,
            past: [],
            future: []
        })
    })

    const page = () => useMangaStore.getState().pages[0]

    it('setPageLayout: レイアウトのコマ数ぶんのパネルを作り座標を設定', () => {
        useMangaStore.getState().setPageLayout('3コマ・3段')
        expect(page().layoutName).toBe('3コマ・3段')
        expect(page().panels).toHaveLength(3)
        // 3段 → y が増えていく
        expect(page().panels[0].y).toBeLessThan(page().panels[1].y)
        expect(page().panels.every((p) => p.width > 0 && p.height > 0)).toBe(true)
    })

    it('addLine: 指定コマに吹き出しを追加（panelId 紐付け・種別反映）', () => {
        useMangaStore.getState().setPageLayout('2コマ・上下')
        const panel0 = page().panels[0]
        useMangaStore.getState().addLine(panel0.id, { speaker: '太郎', text: 'やあ', kind: 'thought' })
        const b = page().bubbles[0]
        expect(b.panelId).toBe(panel0.id)
        expect(b.text).toBe('やあ')
        expect(b.scriptSpeaker).toBe('太郎')
        expect(kindOfBubble(b)).toBe('thought')
    })

    it('updateLine: 本文・話者・種別を更新', () => {
        useMangaStore.getState().setPageLayout('1コマ・全面')
        const panel0 = page().panels[0]
        useMangaStore.getState().addLine(panel0.id, { text: 'a' })
        const id = page().bubbles[0].id
        useMangaStore.getState().updateLine(id, { text: 'b', speaker: '花子', kind: 'shout' })
        const b = page().bubbles.find((x) => x.id === id)!
        expect(b.text).toBe('b')
        expect(b.scriptSpeaker).toBe('花子')
        expect(b.type).toBe('shout')
    })

    it('種別ナレーションにすると話者が外れ、rect＋しっぽ無しになる', () => {
        useMangaStore.getState().setPageLayout('1コマ・全面')
        const panel0 = page().panels[0]
        useMangaStore.getState().addLine(panel0.id, { speaker: '太郎', text: 'x' })
        const id = page().bubbles[0].id
        useMangaStore.getState().updateLine(id, { kind: 'narration' })
        const b = page().bubbles.find((x) => x.id === id)!
        expect(b.scriptSpeaker).toBeUndefined()
        expect(b.type).toBe('rect')
        expect(b.tailWidth).toBe(0)
        expect(kindOfBubble(b)).toBe('narration')
    })

    it('キャラ登録済みなら話者の既定フォントが入る（男=ヒラギノ明朝）', () => {
        useMangaStore.setState({
            referenceCharacters: [
                { id: 'c1', name: '太郎', positivePrompt: '', negativePrompt: '', images: [], gender: 'male' }
            ]
        })
        useMangaStore.getState().setPageLayout('1コマ・全面')
        useMangaStore.getState().addLine(page().panels[0].id, { speaker: '太郎', text: 'x' })
        expect(page().bubbles[0].fontFamily).toContain('Hiragino Mincho')
    })

    it('removeLine / removePanelFromPage', () => {
        useMangaStore.getState().setPageLayout('2コマ・上下')
        const [p0, p1] = page().panels
        useMangaStore.getState().addLine(p0.id, { text: 'a' })
        useMangaStore.getState().addLine(p1.id, { text: 'b' })
        const aId = page().bubbles.find((b) => b.text === 'a')!.id
        useMangaStore.getState().removeLine(aId)
        expect(page().bubbles.map((b) => b.text)).toEqual(['b'])
        useMangaStore.getState().removePanelFromPage(p1.id)
        expect(page().panels).toHaveLength(1)
        expect(page().bubbles).toHaveLength(0) // p1 の吹き出しも消える
    })

    it('moveLineToPanel: 別コマへ移すと panelId が変わり、そのコマ内へ再配置', () => {
        useMangaStore.getState().setPageLayout('2コマ・上下')
        const [p0, p1] = page().panels
        useMangaStore.getState().addLine(p0.id, { text: 'a' })
        const id = page().bubbles[0].id
        useMangaStore.getState().moveLineToPanel(id, p1.id)
        const b = page().bubbles.find((x) => x.id === id)!
        expect(b.panelId).toBe(p1.id)
        // p1（下段）の矩形内に入る
        expect(b.y).toBeGreaterThanOrEqual(p1.y)
    })

    it('setPageLayout で減らすと、余ったコマの吹き出しは残るコマへ引き継ぎ、内容は保持', () => {
        useMangaStore.getState().setPageLayout('3コマ・3段')
        const panels3 = page().panels
        useMangaStore.getState().addLine(panels3[2].id, { text: 'keep' })
        useMangaStore.getState().setPageLayout('2コマ・上下')
        expect(page().panels).toHaveLength(2)
        const kept = page().bubbles.find((b) => b.text === 'keep')
        expect(kept).toBeTruthy()
        expect(kept!.panelId).toBe(page().panels[1].id) // 最後に残ったコマへ
    })
})
