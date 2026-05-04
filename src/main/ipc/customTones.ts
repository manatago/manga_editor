import { app, ipcMain } from 'electron'
import * as fs from 'fs'
import * as pathModule from 'path'

/** カスタムトーン（app-wide）: userData/custom-tones/ に PNG を保存 */
const customTonesDir = (): string => pathModule.join(app.getPath('userData'), 'custom-tones')
const customTonesCatalog = (): string => pathModule.join(customTonesDir(), 'catalog.json')

function readCustomTonesCatalog(): { id: string; name: string }[] {
    const p = customTonesCatalog()
    if (!fs.existsSync(p)) return []
    try { return JSON.parse(fs.readFileSync(p, 'utf-8')) } catch { return [] }
}

function writeCustomTonesCatalog(catalog: { id: string; name: string }[]): void {
    fs.writeFileSync(customTonesCatalog(), JSON.stringify(catalog))
}

export function registerCustomToneHandlers(): void {
    ipcMain.handle('get-custom-tones', async () => {
        return readCustomTonesCatalog().map((e) => ({
            ...e,
            absolutePath: pathModule.join(customTonesDir(), `${e.id}.png`)
        }))
    })

    ipcMain.handle('add-custom-tone', async (_, { sourcePath, name }: { sourcePath: string; name: string }) => {
        const dir = customTonesDir()
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
        const src = pathModule.resolve(String(sourcePath ?? '').trim())
        if (!fs.existsSync(src)) throw new Error('ソースファイルが見つかりません')
        const id = `ct_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
        const dest = pathModule.join(dir, `${id}.png`)
        fs.copyFileSync(src, dest)
        const entry = { id, name: String(name || 'トーン').trim().slice(0, 80) }
        writeCustomTonesCatalog([...readCustomTonesCatalog(), entry])
        return { ...entry, absolutePath: dest }
    })

    ipcMain.handle('delete-custom-tone', async (_, { id }: { id: string }) => {
        const png = pathModule.join(customTonesDir(), `${id}.png`)
        if (fs.existsSync(png)) fs.unlinkSync(png)
        writeCustomTonesCatalog(readCustomTonesCatalog().filter((e) => e.id !== id))
    })

    ipcMain.handle('rename-custom-tone', async (_, { id, name }: { id: string; name: string }) => {
        const catalog = readCustomTonesCatalog().map((e) =>
            e.id === id ? { ...e, name: String(name || 'トーン').trim().slice(0, 80) } : e
        )
        writeCustomTonesCatalog(catalog)
    })

    ipcMain.handle('resolve-custom-tone', async (_, { id }: { id: string }) => {
        const p = pathModule.join(customTonesDir(), `${id}.png`)
        return fs.existsSync(p) ? p : null
    })
}
