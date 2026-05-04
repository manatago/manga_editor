import { app, ipcMain } from 'electron'
import * as fs from 'fs'
import * as pathModule from 'path'
import { assertTemplateForSave, assertTemplateHasPersistableId } from '../ipcGuards'

export function registerTemplateHandlers(): void {
    ipcMain.handle('get-templates', async () => {
        const templatePath = pathModule.join(app.getPath('userData'), 'templates.json')

        try {
            if (!fs.existsSync(templatePath)) return []
            const data = fs.readFileSync(templatePath, 'utf8')
            return JSON.parse(data)
        } catch (error) {
            console.error('Main: failed to get templates:', error)
            return []
        }
    })

    ipcMain.handle('save-template', async (_, templateRaw: unknown) => {
        const userDataPath = app.getPath('userData')
        const templatePath = pathModule.join(userDataPath, 'templates.json')

        console.log('Main: saving template to', templatePath)

        try {
            const template = assertTemplateForSave(templateRaw)
            let templates = []
            if (fs.existsSync(templatePath)) {
                const existingData = fs.readFileSync(templatePath, 'utf8')
                console.log('Main: existing templates found', existingData)
                templates = JSON.parse(existingData)
            }

            const newTemplate = { ...template, id: Math.random().toString(36).substr(2, 9) }
            assertTemplateHasPersistableId(newTemplate)
            templates.push(newTemplate)

            fs.writeFileSync(templatePath, JSON.stringify(templates, null, 2))
            console.log('Main: template saved successfully. Total templates:', templates.length)
            return templates
        } catch (error) {
            console.error('Main: failed to save template:', error)
            throw error
        }
    })

    ipcMain.handle('delete-template', async (_, templateId) => {
        const userDataPath = app.getPath('userData')
        const templatePath = pathModule.join(userDataPath, 'templates.json')

        try {
            if (!fs.existsSync(templatePath)) return []
            const data = fs.readFileSync(templatePath, 'utf8')
            let templates = JSON.parse(data)
            templates = templates.filter((t: any) => t.id !== templateId)
            fs.writeFileSync(templatePath, JSON.stringify(templates, null, 2))
            return templates
        } catch (error) {
            console.error('Main: failed to delete template:', error)
            throw error
        }
    })
}
