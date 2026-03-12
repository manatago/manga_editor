import { useMangaStore } from '../store/useMangaStore'

export const useProjectActions = () => {
    const {
        currentProjectPath,
        setCurrentProject,
        setProjectData,
        pages,
        loadTemplates
    } = useMangaStore()

    const handleCreateNew = async () => {
        if (!window.electron) return
        try {
            const folderPath = await window.electron.selectFolder()
            if (!folderPath) return null
            const projectName = `manga_${new Date().getTime()}`
            const projectPath = await window.electron.createProject(folderPath, projectName)
            setCurrentProject(projectPath)
            const projectData = await window.electron.loadProject(projectPath)
            setProjectData(projectData)
            return projectPath
        } catch (error) {
            console.error('useProjectActions: handleCreateNew error:', error)
            alert('プロジェクトの作成に失敗しました')
            return null
        }
    }

    const handleOpenProject = async () => {
        if (!window.electron) return
        try {
            const folderPath = await window.electron.selectFolder()
            if (!folderPath) return null
            const projectData = await window.electron.loadProject(folderPath)
            setCurrentProject(folderPath)
            setProjectData(projectData)
            return folderPath
        } catch (error) {
            console.error('useProjectActions: handleOpenProject error:', error)
            alert('プロジェクトの読み込みに失敗しました')
            return null
        }
    }

    const handleUseTemplate = async (templateId: string) => {
        if (!currentProjectPath || !window.electron) return
        const { templates } = useMangaStore.getState()
        const template = templates.find(t => t.id === templateId)
        if (template) {
            const { addPage } = useMangaStore.getState()
            addPage(template.panels)
            return true
        }
        return false
    }

    const handleSaveAsTemplate = async (name: string): Promise<boolean> => {
        if (!name.trim()) return false
        const { saveAsTemplate } = useMangaStore.getState()
        try {
            await saveAsTemplate(name)
            return true
        } catch (error) {
            console.error('useProjectActions: saveAsTemplate error:', error)
            return false
        }
    }

    return {
        handleCreateNew,
        handleOpenProject,
        handleUseTemplate,
        handleSaveAsTemplate
    }
}
