import React, { useState } from 'react'
import { Layout, Table, MessageSquare, Zap, BookTemplate, Trash2 } from 'lucide-react'
import { useMangaStore } from '../store/useMangaStore'

interface TemplateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectTemplate: (templateId: string) => void;
    onCreateNew: () => void;
    onOpenProject: () => void;
    onSaveCurrentAsTemplate: (name: string) => Promise<boolean>;
}

export const TemplateModal: React.FC<TemplateModalProps> = ({
    isOpen,
    onClose,
    onSelectTemplate,
    onCreateNew,
    onOpenProject,
    onSaveCurrentAsTemplate
}) => {
    const { templates, pages, removeTemplate } = useMangaStore()
    const [isSavingTemplate, setIsSavingTemplate] = useState(false)
    const [templateName, setTemplateName] = useState('')

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <BookTemplate className="text-blue-500" />
                            プロジェクト作成 / テンプレート
                        </h2>
                        <p className="text-zinc-500 text-sm mt-1">新しいプロジェクトを開始するか、テンプレートを選択してください</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 transition-colors">&times;</button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 manga-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Quick Start</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={onCreateNew}
                                    className="p-6 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-600/30 rounded-xl transition-all group text-left"
                                >
                                    <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <Layout className="text-blue-500" />
                                    </div>
                                    <div className="font-bold text-white text-sm">新規プロジェクト</div>
                                    <div className="text-zinc-500 text-[10px] mt-1">フォルダを選択して開始</div>
                                </button>
                                <button
                                    onClick={onOpenProject}
                                    className="p-6 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 rounded-xl transition-all group text-left"
                                >
                                    <div className="w-10 h-10 bg-zinc-700 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <BookTemplate className="text-zinc-400" />
                                    </div>
                                    <div className="font-bold text-white text-sm">プロジェクトを開く</div>
                                    <div className="text-zinc-500 text-[10px] mt-1">既存の manga.json を選択</div>
                                </button>
                            </div>

                            {pages.length > 0 && (
                                <div className="mt-8 pt-8 border-t border-zinc-800">
                                    <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Save Current State</h3>
                                    {!isSavingTemplate ? (
                                        <button
                                            onClick={() => setIsSavingTemplate(true)}
                                            className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold transition-all border border-zinc-700 flex items-center justify-center gap-2"
                                        >
                                            <Zap size={14} className="text-yellow-500" />
                                            現在のコマ割りをテンプレートとして保存
                                        </button>
                                    ) : (
                                        <div className="flex gap-2">
                                            <input
                                                autoFocus
                                                type="text"
                                                placeholder="テンプレート名"
                                                value={templateName}
                                                onChange={(e) => setTemplateName(e.target.value)}
                                                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                                            />
                                            <button
                                                onClick={async () => {
                                                    const success = await onSaveCurrentAsTemplate(templateName)
                                                    if (success) {
                                                        setIsSavingTemplate(false)
                                                        setTemplateName('')
                                                    }
                                                }}
                                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all"
                                            >
                                                保存
                                            </button>
                                            <button
                                                onClick={() => setIsSavingTemplate(false)}
                                                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-xl text-xs font-bold transition-all"
                                            >
                                                戻る
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div>
                            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Global Templates</h3>
                            <div className="space-y-3">
                                {templates.map((template) => (
                                    <button
                                        key={template.id}
                                        onClick={() => onSelectTemplate(template.id)}
                                        className="w-full p-4 bg-zinc-800/30 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-xl transition-all flex items-center justify-between group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-zinc-800 rounded flex items-center justify-center text-zinc-500">
                                                <Table size={16} />
                                            </div>
                                            <div className="text-left">
                                                <div className="text-sm font-bold text-zinc-200 group-hover:text-white transition-colors">{template.name}</div>
                                                <div className="text-[10px] text-zinc-600">{template.panels.length} panels</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <MessageSquare size={14} className="text-zinc-700 group-hover:text-zinc-500" />
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeTemplate(template.id);
                                                }}
                                                className="p-2 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                                title="テンプレートを削除"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </button>
                                ))}
                                {templates.length === 0 && (
                                    <div className="py-12 text-center border-2 border-dashed border-zinc-800 rounded-2xl">
                                        <div className="text-zinc-600 text-xs">テンプレートがありません</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
