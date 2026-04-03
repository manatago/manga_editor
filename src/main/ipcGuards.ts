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

/**
 * 新規テンプレートは id を送らない（メインが付与）。送られてきた場合は型と非空を検証する。
 */
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
    if ('id' in template) {
        const id = template.id
        if (typeof id !== 'string' || !id.trim()) {
            throw new Error('save-template: id が不正です（空でない文字列である必要があります）')
        }
    }
    return template
}

/** メインが id を付与した直後の行に必ず通す（削除 IPC が id に依存するため） */
export function assertTemplateHasPersistableId(row: Record<string, unknown>): void {
    const id = row.id
    if (typeof id !== 'string' || !id) {
        throw new Error('save-template: 保存結果に id がありません（内部エラー）')
    }
}
