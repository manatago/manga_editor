import type { StateCreator } from 'zustand'
import type { MangaState } from '../useMangaStore'

export type ThemeMode = 'dark' | 'light'

const THEME_KEY = 'manga-yarou-theme'

function readInitialTheme(): ThemeMode {
    try {
        const v = localStorage.getItem(THEME_KEY)
        if (v === 'light' || v === 'dark') return v
    } catch {
        /* localStorage 不可なら既定へ */
    }
    return 'dark'
}

/** <html data-theme="…"> を更新。CSS 側は :root[data-theme="light"] で配色を差し替える。 */
function applyTheme(t: ThemeMode): void {
    try {
        document.documentElement.setAttribute('data-theme', t)
    } catch {
        /* SSR 等で document が無い場合は無視 */
    }
}

function persistTheme(t: ThemeMode): void {
    try {
        localStorage.setItem(THEME_KEY, t)
    } catch {
        /* ignore */
    }
}

export interface ThemeSlice {
    /** 画面全体の配色。'dark'（既定）/ 'light' */
    theme: ThemeMode
    setTheme: (t: ThemeMode) => void
    toggleTheme: () => void
}

export const createThemeSlice: StateCreator<MangaState, [], [], ThemeSlice> = (set) => {
    // ストア生成時（＝初回描画前）に data-theme を確定させ、チラつきを防ぐ
    const initial = readInitialTheme()
    applyTheme(initial)

    const commit = (t: ThemeMode) => {
        persistTheme(t)
        applyTheme(t)
        set({ theme: t })
    }

    return {
        theme: initial,
        setTheme: (t) => commit(t),
        toggleTheme: () => set((s) => {
            const t: ThemeMode = s.theme === 'dark' ? 'light' : 'dark'
            persistTheme(t)
            applyTheme(t)
            return { theme: t }
        })
    }
}
