export const fileLimits = {
  maxFileBytes: 5 * 1024 * 1024,
  maxTotalBytes: 50 * 1024 * 1024,
  maxFiles: 20,
} as const
export const imageTypes = ['image/png', 'image/jpeg', 'image/webp'] as const
export type ImageType = (typeof imageTypes)[number]
export interface FileAsset {
  id: string
  name: string
  type: ImageType
  size: number
  state: 'pending' | 'ready' | 'deleting'
  createdAt: number
  contentUrl: string | null
  references: number
}
export function imageType(bytes: Uint8Array): ImageType | null {
  if (
    bytes.length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
  )
    return 'image/png'
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return 'image/jpeg'
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  )
    return 'image/webp'
  return null
}
export const fileContentPath = (id: string) => '/api/files/' + id + '/content'
