import React from 'react'
import { FolderOpen, MessageSquare, Plus, Download, Upload, Image as ImageIcon, Settings, Save } from 'lucide-react'
import { useMangaStore } from '../store/useMangaStore'

import PanelSettings from './sidebar/PanelSettings'
import BubbleSettings from './sidebar/BubbleSettings'
import MaterialSettings from './sidebar/MaterialSettings'
import PageSettings from './sidebar/PageSettings'

const SidebarRight: React.FC = () => {
    const { 
        pages, 
        currentPageId, 
        selectedPanelId, 
        selectedBubbleId, 
        selectedMaterialId,
        updatePanel, 
        removePanel,
        reorderPanel,
        updateBubble,
        removeBubble,
        addBubble,
        updateMaterial,
        removeMaterial,
        addMaterial,
        updatePage,
        currentProjectPath
    } = useMangaStore()

    const currentPage = pages.find(p => p.id === currentPageId)
    const selectedPanel = currentPage?.panels.find(p => p.id === selectedPanelId)
    const selectedBubble = currentPage?.bubbles?.find(b => b.id === selectedBubbleId)
    const selectedMaterial = currentPage?.materials?.find(m => m.id === selectedMaterialId)

    if (!currentPageId) return null

    return (
        <div className="w-80 bg-zinc-950/90 backdrop-blur-xl border-l border-zinc-900 flex flex-col h-full shadow-2xl relative z-10">
            <div className="p-4 border-b border-zinc-900/50 bg-black/20 flex-shrink-0 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
                    <Settings size={16} />
                </div>
                <div>
                    <h2 className="text-xs font-bold text-zinc-100">Properties</h2>
                    <p className="text-[10px] text-zinc-500">{
                        selectedBubble ? 'speech bubble options' :
                        selectedMaterial ? 'material options' :
                        selectedPanel ? 'panel options' :
                        'page options'
                    }</p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 manga-scrollbar">
            {selectedPanel ? (
                <PanelSettings
                    panel={selectedPanel}
                    updatePanel={updatePanel}
                    removePanel={removePanel}
                    reorderPanel={reorderPanel}
                    currentProjectPath={currentProjectPath}
                />
            ) : selectedBubble ? (
                <BubbleSettings
                    bubble={selectedBubble}
                    updateBubble={updateBubble}
                    removeBubble={removeBubble}
                    currentPageId={currentPageId}
                />
            ) : selectedMaterial ? (
                <MaterialSettings
                    material={selectedMaterial}
                    updateMaterial={updateMaterial}
                    removeMaterial={removeMaterial}
                    currentPageId={currentPageId}
                    currentProjectPath={currentProjectPath}
                />
            ) : (
                <PageSettings
                    currentPage={currentPage!}
                    currentPageId={currentPageId}
                    updatePage={updatePage}
                    addBubble={addBubble}
                    addMaterial={addMaterial}
                    currentProjectPath={currentProjectPath}
                />
            )}
            </div>
        </div>
    )
}

export default SidebarRight
