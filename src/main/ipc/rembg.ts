import { ipcMain } from 'electron'
import { runRembgToFile, resolveReferenceRembgPaths, toProjectRelativePath } from '../rembgRunner'

export function registerRembgHandlers(): void {
    ipcMain.handle(
        'rembg-remove-background',
        async (_, { projectPath, inputRelativePath }: { projectPath: string; inputRelativePath: string }) => {
            try {
                const root = String(projectPath ?? '').trim()
                const relIn = String(inputRelativePath ?? '').trim()
                const { inputAbs, outputAbs } = resolveReferenceRembgPaths(root, relIn)
                await runRembgToFile(inputAbs, outputAbs)
                return { relativePath: toProjectRelativePath(root, outputAbs) }
            } catch (e) {
                console.error('Main: rembg-remove-background failed', e)
                throw e
            }
        }
    )
}
