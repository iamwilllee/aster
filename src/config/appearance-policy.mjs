export const visualThemes = ['sage', 'catalog']
export function parseAppearance(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length !== 1 ||
    !visualThemes.includes(value.theme)
  )
    throw new Error('Invalid appearance: select theme sage or catalog')
  return { theme: value.theme }
}
