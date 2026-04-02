type GridPage = { gridEnabled?: boolean; gridSize?: number } | null | undefined

export const snapToGrid = (value: number, page: GridPage): number => {
    if (!page?.gridEnabled) return value
    const g = Math.max(8, Number(page.gridSize ?? 24))
    return Math.round(value / g) * g
}
