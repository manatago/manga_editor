import React, { useEffect, useMemo, useState } from 'react'
import {
    X,
    GitBranch,
    UploadCloud,
    DownloadCloud,
    Settings2,
    Loader2,
    CheckCircle2,
    AlertTriangle,
    RefreshCw
} from 'lucide-react'
import { useMangaStore } from '../../store/useMangaStore'
import { showError } from '../../utils/dialogs'

interface GitSyncModalProps {
    isOpen: boolean
    onClose: () => void
}

function basename(p: string): string {
    return p.split('/').filter(Boolean).pop() ?? p
}

export const GitSyncModal: React.FC<GitSyncModalProps> = ({ isOpen, onClose }) => {
    const currentProjectPath = useMangaStore((s) => s.currentProjectPath)
    const projectName = currentProjectPath ? basename(currentProjectPath) : ''

    const [status, setStatus] = useState<GitRepoStatus | null>(null)
    const [remoteUrl, setRemoteUrl] = useState('')
    const [lfsUrl, setLfsUrl] = useState('')
    const [lfsUser, setLfsUser] = useState('')
    const [lfsPass, setLfsPass] = useState('')
    const [commitMsg, setCommitMsg] = useState('')
    const [busy, setBusy] = useState<string | null>(null)
    const [log, setLog] = useState('')

    const refresh = async () => {
        if (!currentProjectPath || !window.electron) return
        try {
            const [st, defs] = await Promise.all([
                window.electron.gitRepoStatus(currentProjectPath),
                window.electron.gitConnDefaults()
            ])
            setStatus(st)
            // リポジトリの実値 → 直近の接続デフォルト の順で自動プリフィル
            setRemoteUrl((prev) => prev || st.remoteUrl || defs.remoteUrl || '')
            setLfsUrl((prev) => prev || st.lfsUrl || defs.lfsUrl || '')
            setLfsUser((prev) => prev || st.lfsUsername || defs.username || '')
        } catch (e) {
            await showError('状態の取得に失敗しました:\n' + (e instanceof Error ? e.message : String(e)))
        }
    }

    useEffect(() => {
        if (isOpen) {
            setLog('')
            setCommitMsg('')
            void refresh()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, currentProjectPath])

    const canSync = useMemo(() => !!status?.isRepo && !!status?.remoteUrl, [status])

    if (!isOpen) return null

    const guard = (): boolean => !!currentProjectPath && !!window.electron

    const handleSaveConfig = async () => {
        if (!guard()) return
        if (!lfsUrl.trim()) {
            await showError('LFS の URL を入力してください')
            return
        }
        setBusy('config')
        try {
            // 資格情報（入力があれば保存）
            if (lfsUser.trim() || lfsPass) {
                await window.electron.gitSaveLfsCredential(lfsUrl.trim(), lfsUser.trim(), lfsPass)
                setLfsPass('')
            }
            const res = await window.electron.gitInitConfig(
                currentProjectPath!,
                remoteUrl.trim(),
                lfsUrl.trim()
            )
            setStatus(res.status)
            setLog(res.log)
        } catch (e) {
            await showError('初期化/設定に失敗しました:\n' + (e instanceof Error ? e.message : String(e)))
        } finally {
            setBusy(null)
        }
    }

    const handlePush = async () => {
        if (!guard()) return
        setBusy('push')
        try {
            const res = await window.electron.gitPush(currentProjectPath!, commitMsg)
            setStatus(res.status)
            setLog(res.log)
            if (res.ok) setCommitMsg('')
        } catch (e) {
            await showError('プッシュに失敗しました:\n' + (e instanceof Error ? e.message : String(e)))
        } finally {
            setBusy(null)
        }
    }

    const handlePull = async () => {
        if (!guard()) return
        setBusy('pull')
        try {
            const res = await window.electron.gitPull(currentProjectPath!)
            setStatus(res.status)
            setLog(res.log)
        } catch (e) {
            await showError('プルに失敗しました:\n' + (e instanceof Error ? e.message : String(e)))
        } finally {
            setBusy(null)
        }
    }

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl">
                {/* ヘッダ */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
                    <div className="flex items-center gap-2 text-white">
                        <GitBranch size={18} className="text-emerald-400" />
                        <h2 className="text-base font-semibold">同期（Git / LFS）</h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    <p className="text-xs text-zinc-500 leading-relaxed">
                        この作品フォルダ（<code className="text-zinc-300">{projectName || '(未選択)'}</code>）を
                        GitHub＋セルフホスト LFS で同期します。画像の実体は LFS サーバに、GitHub にはポインタだけが載ります。
                        別PCでは clone → 「取り込む（Pull）」で続きができます。
                    </p>

                    {/* 状態 */}
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
                        <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-medium text-zinc-200">状態</div>
                            <button
                                type="button"
                                onClick={() => void refresh()}
                                className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white"
                            >
                                <RefreshCw size={13} /> 更新
                            </button>
                        </div>
                        {status ? (
                            status.isRepo ? (
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
                                    <span>ブランチ: <span className="text-zinc-200">{status.branch || '—'}</span></span>
                                    <span>未コミット: <span className={status.dirty ? 'text-amber-400' : 'text-zinc-200'}>{status.dirty} 件</span></span>
                                    <span>未Push: <span className={status.ahead ? 'text-amber-400' : 'text-zinc-200'}>{status.ahead}</span></span>
                                    <span>未Pull: <span className={status.behind ? 'text-amber-400' : 'text-zinc-200'}>{status.behind}</span></span>
                                    <span>
                                        LFS認証:{' '}
                                        {status.hasCred ? (
                                            <span className="text-emerald-400">保存済み</span>
                                        ) : (
                                            <span className="text-zinc-500">未保存</span>
                                        )}
                                    </span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5 text-xs text-amber-400">
                                    <AlertTriangle size={14} /> まだ Git リポジトリではありません。下で設定して初期化してください。
                                </div>
                            )
                        ) : (
                            <div className="text-xs text-zinc-500">取得中…</div>
                        )}
                    </div>

                    {/* 設定 */}
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 space-y-3">
                        <div className="text-sm font-medium text-zinc-200 flex items-center gap-1.5">
                            <Settings2 size={15} /> 接続設定
                        </div>
                        <div>
                            <label className="block text-xs text-zinc-500 mb-1">GitHub リポジトリ（SSH 推奨）</label>
                            <input
                                type="text"
                                value={remoteUrl}
                                onChange={(e) => setRemoteUrl(e.target.value)}
                                placeholder="git@github.com:manatago/作品名.git"
                                className="w-full px-3 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-600 focus:border-emerald-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-zinc-500 mb-1">LFS サーバ URL</label>
                            <input
                                type="text"
                                value={lfsUrl}
                                onChange={(e) => setLfsUrl(e.target.value)}
                                placeholder="http://49.212.195.249:8080/api/manatago/作品名"
                                className="w-full px-3 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-600 focus:border-emerald-500 outline-none"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-xs text-zinc-500 mb-1">LFS ユーザー名</label>
                                <input
                                    type="text"
                                    value={lfsUser}
                                    onChange={(e) => setLfsUser(e.target.value)}
                                    autoComplete="off"
                                    placeholder="（別PC初回用・任意）"
                                    className="w-full px-3 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-600 focus:border-emerald-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-zinc-500 mb-1">LFS パスワード</label>
                                <input
                                    type="password"
                                    value={lfsPass}
                                    onChange={(e) => setLfsPass(e.target.value)}
                                    autoComplete="new-password"
                                    placeholder={status?.hasCred ? '保存済み（変更時のみ入力）' : '（暗号化保存）'}
                                    className="w-full px-3 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-600 focus:border-emerald-500 outline-none"
                                />
                            </div>
                        </div>
                        <p className="text-[11px] text-zinc-600 leading-relaxed">
                            一度保存すれば、URL・ユーザー名は自動で復元、パスワードは暗号化して端末に保存され再入力不要です。
                            同じLFSサーバの別作品でも認証を使い回します（別PCでは初回のみ入力）。
                        </p>
                        <button
                            type="button"
                            onClick={handleSaveConfig}
                            disabled={!!busy || !currentProjectPath}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {busy === 'config' ? <Loader2 size={15} className="animate-spin" /> : <Settings2 size={15} />}
                            {status?.isRepo ? '設定を保存' : '設定を保存して初期化'}
                        </button>
                    </div>

                    {/* 同期 */}
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 space-y-3">
                        <div className="text-sm font-medium text-zinc-200">同期</div>
                        <input
                            type="text"
                            value={commitMsg}
                            onChange={(e) => setCommitMsg(e.target.value)}
                            placeholder="コミットメッセージ（空なら日時）"
                            className="w-full px-3 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-600 focus:border-emerald-500 outline-none"
                        />
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={handlePush}
                                disabled={!!busy || !canSync}
                                title={!canSync ? 'まず設定を保存して初期化してください' : ''}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {busy === 'push' ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
                                プッシュ（保存して送る）
                            </button>
                            <button
                                type="button"
                                onClick={handlePull}
                                disabled={!!busy || !canSync}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {busy === 'pull' ? <Loader2 size={15} className="animate-spin" /> : <DownloadCloud size={15} />}
                                プル（取り込む）
                            </button>
                        </div>
                        <p className="text-[11px] text-zinc-600 leading-relaxed">
                            プッシュは「保存 → コミット → 送信」を一括で行います。画像が多い初回は時間がかかります。
                            GitHub 側は SSH 鍵、LFS 側は上の認証情報を使います（新PCでは一度だけ入力）。
                        </p>
                    </div>

                    {/* ログ */}
                    {log && (
                        <div className="rounded-lg border border-zinc-800 bg-black/40 p-3">
                            <div className="flex items-center gap-1.5 text-xs text-zinc-400 mb-1">
                                <CheckCircle2 size={13} className="text-emerald-400" /> 実行ログ
                            </div>
                            <pre className="text-[11px] text-zinc-400 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                                {log}
                            </pre>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default GitSyncModal
