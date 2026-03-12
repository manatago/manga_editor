import React from 'react'

interface ExportOverlayProps {
    isExporting: boolean;
}

export const ExportOverlay: React.FC<ExportOverlayProps> = ({ isExporting }) => {
    if (!isExporting) return null

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[10000] flex items-center justify-center">
            <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                <div className="text-white font-bold text-lg">画像を書き出し中...</div>
                <div className="text-zinc-500 text-sm">しばらくお待ちください</div>
            </div>
        </div>
    )
}
