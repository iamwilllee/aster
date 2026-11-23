import { readFileSync, realpathSync, statSync } from 'node:fs'
import { extname, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const imageTypes = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
}

// File-reference checks only. Design, actual image decoding and rendering need separate review.
export function checkBrand(root) {
  const config = JSON.parse(readFileSync(resolve(root, 'src/config/brand.json'), 'utf8'))
  const publicRoot = realpathSync(resolve(root, 'public'))
  const errors = []
  const files = []
  function asset(label, value, optional = false) {
    if (value === null && optional) return
    if (
      typeof value !== 'string' ||
      !/^\/(?!\/)[^?#\\%\s]+$/.test(value) ||
      value
        .split('/')
        .slice(1)
        .some((part) => !part || part === '.' || part === '..')
    ) {
      errors.push(`${label}: expected a local public path${optional ? ' or null' : ''}`)
      return
    }
    const type = imageTypes[extname(value).toLowerCase()]
    if (!type || (label === 'appleTouchIcon' && type !== 'image/png')) {
      errors.push(`${label}: unsupported format`)
      return
    }
    try {
      const file = realpathSync(resolve(publicRoot, value.slice(1)))
      const path = relative(publicRoot, file)
      if (path === '..' || path.startsWith(`..${sep}`) || resolve(publicRoot, path) !== file)
        throw new Error('outside public')
      if (!statSync(file).isFile() || statSync(file).size === 0) throw new Error('empty file')
      files.push(value)
    } catch {
      errors.push(`${label}: missing, empty or outside public`)
    }
    return type
  }
  asset('icon', config.icon)
  asset('iconDark', config.iconDark, true)
  const faviconType = asset('favicon', config.favicon?.href)
  if (faviconType && config.favicon?.type !== faviconType)
    errors.push('favicon: MIME type must match the file extension')
  asset('appleTouchIcon', config.appleTouchIcon, true)
  return { errors, files: [...new Set(files)] }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = checkBrand(process.cwd())
    if (result.errors.length) {
      console.error(result.errors.join('\n'))
      process.exitCode = 1
    } else
      console.log(
        `Brand file references passed (${result.files.length}); visual review is separate.`,
      )
  } catch {
    console.error('Cannot read brand config/public assets; review src/config/brand.json.')
    process.exitCode = 1
  }
}
