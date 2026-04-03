/**
 * IPC 境界で受け取るペイロードの最小限の型検証（実行はしないが JSON 保存前提の形を確認）
 */

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseSaveProjectPayload(payload: unknown): { path: string; data: unknown } {
    if (!isRecord(payload)) {
        throw new Error('save-project: ペイロードがオブジェクトではありません')
    }
    const p = String(payload.path ?? '').trim()
    if (!p) {
        throw new Error('save-project: path が空です')
    }
    if (!('data' in payload)) {
        throw new Error('save-project: data がありません')
    }
    const { data } = payload
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('save-project: data はオブジェクトである必要があります')
    }
    return { path: p, data }
}

export function parseSaveProjectSyncPayload(payload: unknown): { path: string; data: unknown } | null {
    try {
        return parseSaveProjectPayload(payload)
    } catch (e) {
        console.error('Main: save-project-sync payload invalid', e)
        return null
    }
}

export function assertTemplateForSave(template: unknown): Record<string, unknown> {
    if (!isRecord(template)) {
        throw new Error('save-template: テンプレートがオブジェクトではありません')
    }
    if (typeof template.name !== 'string') {
        throw new Error('save-template: name が文字列ではありません')
    }
    if (!Array.isArray(template.panels)) {
        throw new Error('save-template: panels が配列ではありません')
    }
    return template
}
