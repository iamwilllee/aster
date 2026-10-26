export type VisualTheme = 'sage' | 'catalog'
export const visualThemes: readonly VisualTheme[]
export function parseAppearance(value: unknown): { theme: VisualTheme }
