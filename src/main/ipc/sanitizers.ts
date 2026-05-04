import * as pathModule from 'path'

/** assets/ 以下のみ。`..` や不正文字を拒否 */
export function sanitizeAssetsSubPath(input: unknown): string {
    if (input == null || typeof input !== 'string') return ''
    const s = input.replace(/\\/g, '/').replace(/^\/+/g, '').replace(/\/+$/g, '')
    if (!s || s.includes('..')) return ''
    if (!/^[a-zA-Z0-9/_-]+$/.test(s)) return ''
    const parts = s.split('/').filter(Boolean)
    if (parts.length === 0 || parts.length > 16) return ''
    for (const p of parts) {
        if (p.length > 120) return ''
    }
    return parts.join(pathModule.sep)
}

export function sanitizePanelId(v: string): string {
    const s = String(v ?? '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40)
    return s || 'panel'
}
