/** キャンバスのズーム操作（レンダラーの CanvasViewport が解釈する） */
export type CanvasZoomCommand = 'in' | 'out' | 'fit' | 'actual'

interface KeyInput {
    type: string
    key: string
    meta: boolean
    control: boolean
    alt: boolean
}

/**
 * Cmd(Ctrl) + = / + / - / 0 / 1 をキャンバスのズームに割り当てる。
 * Electron 標準メニューの「拡大・縮小・実際のサイズ」（画面全体のズーム）と同じキーなので、
 * before-input-event で横取りしてメニューより先に処理する。
 */
export function canvasZoomCommandFor(input: KeyInput, platform: NodeJS.Platform = process.platform): CanvasZoomCommand | null {
    if (input.type !== 'keyDown' || input.alt) return null
    const mod = platform === 'darwin' ? input.meta : input.control
    if (!mod) return null
    switch (input.key) {
        case '=':
        case '+':
        case ';': // JIS 配列の「+」は Shift+; のため
            return 'in'
        case '-':
        case '_':
            return 'out'
        case '0':
            return 'fit'
        case '1':
            return 'actual'
        default:
            return null
    }
}
