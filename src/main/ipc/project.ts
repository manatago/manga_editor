import { ipcMain } from 'electron'
import * as fs from 'fs'
import * as pathModule from 'path'
import {
    ASSETS_COMPOSITES_DIR,
    ASSETS_DUST_DIR,
    ASSETS_IMAGES_DIR,
    ASSETS_REFERENCES_DIR
} from '../assetsLayoutRoot'
import { parseSaveProjectPayload, parseSaveProjectSyncPayload } from '../ipcGuards'

/** 旧 `assets/images/composite/` 配下のファイルを `assets/composites/` へ移す（1回限り） */
function migrateLegacyCompositesDir(root: string): void {
    const legacy = pathModule.join(root, 'assets', ASSETS_IMAGES_DIR, 'composite')
    if (!fs.existsSync(legacy)) return
    const target = pathModule.join(root, 'assets', ASSETS_COMPOSITES_DIR)
    try {
        if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true })
        const entries = fs.readdirSync(legacy)
        for (const name of entries) {
            const src = pathModule.join(legacy, name)
            const dst = pathModule.join(target, name)
            if (fs.existsSync(dst)) continue
            fs.renameSync(src, dst)
        }
        const remain = fs.readdirSync(legacy)
        if (remain.length === 0) {
            fs.rmdirSync(legacy)
            console.log('Main: migrated legacy composite directory:', legacy, '→', target)
        }
    } catch (e) {
        console.error('Main: failed to migrate legacy composites dir', e)
    }
}

export function registerProjectHandlers(): void {
    ipcMain.handle('create-project', async (_, { path, name }) => {
        const projectPath = pathModule.join(path.trim(), name.trim())

        try {
            if (!fs.existsSync(projectPath)) {
                fs.mkdirSync(projectPath, { recursive: true })
            }
            // assets 直下は images / dust / references / composites のフォルダのみ（ファイル混在なし）
            const assetsDir = pathModule.join(projectPath, 'assets')
            const imagesDir = pathModule.join(assetsDir, ASSETS_IMAGES_DIR)
            const dustDir = pathModule.join(assetsDir, ASSETS_DUST_DIR)
            const referencesDir = pathModule.join(assetsDir, ASSETS_REFERENCES_DIR)
            const compositesDir = pathModule.join(assetsDir, ASSETS_COMPOSITES_DIR)
            const exportsDir = pathModule.join(projectPath, 'exports')
            if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true })
            if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true })
            if (!fs.existsSync(dustDir)) fs.mkdirSync(dustDir, { recursive: true })
            if (!fs.existsSync(referencesDir)) fs.mkdirSync(referencesDir, { recursive: true })
            if (!fs.existsSync(compositesDir)) fs.mkdirSync(compositesDir, { recursive: true })
            if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir, { recursive: true })

            const configPath = pathModule.join(projectPath, 'manga.json')
            const configData = JSON.stringify({ name, createdAt: new Date().toISOString(), pages: [] }, null, 2)
            fs.writeFileSync(configPath, configData)
            console.log('Main: Created project at:', projectPath)
            return projectPath
        } catch (error) {
            console.error('Main: failed to create project:', error)
            throw error
        }
    })

    ipcMain.handle('load-project', async (_, path) => {
        const trimmedPath = path.trim()
        const configPath = pathModule.join(trimmedPath, 'manga.json')
        console.log('Main: Loading project from:', configPath)

        try {
            if (!fs.existsSync(configPath)) {
                console.error('Main: manga.json not found at:', configPath)
                throw new Error('プロジェクトファイル (manga.json) が見つかりませんでした。')
            }
            migrateLegacyCompositesDir(trimmedPath)
            let data = fs.readFileSync(configPath, 'utf8')
            const rewritten = data.replace(/assets\/images\/composite\//g, `assets/${ASSETS_COMPOSITES_DIR}/`)
            if (rewritten !== data) {
                fs.writeFileSync(configPath, rewritten)
                data = rewritten
                console.log('Main: rewrote legacy composite paths in manga.json')
            }
            const parsedData = JSON.parse(data)
            console.log('Main: Project data loaded successfully from', trimmedPath)
            return parsedData
        } catch (error) {
            console.error('Main: failed to load project:', error)
            throw error
        }
    })

    ipcMain.handle('save-project', async (_, payload: unknown) => {
        const { path: savePath, data } = parseSaveProjectPayload(payload)
        const configPath = pathModule.join(savePath, 'manga.json')

        try {
            fs.writeFileSync(configPath, JSON.stringify(data, null, 2))
            return true
        } catch (error) {
            console.error('Main: failed to save project at:', configPath, error)
            throw error
        }
    })

    // Synchronous save path used only for app close/beforeunload flush.
    ipcMain.on('save-project-sync', (event, payload: unknown) => {
        try {
            const parsed = parseSaveProjectSyncPayload(payload)
            if (!parsed) {
                event.returnValue = false
                return
            }
            const configPath = pathModule.join(parsed.path, 'manga.json')
            fs.writeFileSync(configPath, JSON.stringify(parsed.data, null, 2))
            event.returnValue = true
        } catch (error) {
            console.error('Main: failed to save project synchronously:', error)
            event.returnValue = false
        }
    })
}
