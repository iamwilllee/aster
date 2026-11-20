// Flatpack names the three control sizes sm / md / lg (32 / 40 / 48px). Aster's public
// API keeps `default`, which is Flatpack's md.
export type ControlSize = 'sm' | 'default' | 'lg'
export const controlSize = (size: ControlSize) => (size === 'default' ? 'md' : size)
