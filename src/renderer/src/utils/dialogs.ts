type DialogType = 'none' | 'info' | 'error' | 'warning'

export async function showMessage(
    message: string,
    options?: { title?: string; type?: DialogType }
): Promise<void> {
    const title = options?.title ?? 'お知らせ'
    const type = options?.type ?? 'info'
    try {
        if (window.electron?.showMessage) {
            await window.electron.showMessage({ title, message, type })
            return
        }
    } catch (error) {
        console.error('dialogs: showMessage failed', error)
    }
    window.alert(message)
}

export async function showError(message: string, title = 'エラー'): Promise<void> {
    await showMessage(message, { title, type: 'error' })
}

export async function showInfo(message: string, title = 'お知らせ'): Promise<void> {
    await showMessage(message, { title, type: 'info' })
}

export async function confirmMessage(
    message: string,
    options?: { title?: string }
): Promise<boolean> {
    const title = options?.title ?? '確認'
    try {
        if (window.electron?.confirmMessage) {
            return await window.electron.confirmMessage({ title, message })
        }
    } catch (error) {
        console.error('dialogs: confirmMessage failed', error)
    }
    return window.confirm(message)
}
