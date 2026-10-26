import { fileLimits } from '@/modules/files/policy'
import { browserLocale, translate } from '@/i18n/core'
export async function uploadImage(file: File, path = '/api/files') {
  if (file.size > fileLimits.maxFileBytes)
    throw new Error(translate(browserLocale(), 'files_too_large'))
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'content-type': file.type,
      'x-file-name': encodeURIComponent(file.name),
      'x-starter-locale': browserLocale(),
    },
    body: file,
  })
  const value: unknown = await response.json()
  if (!response.ok)
    throw new Error(
      typeof value === 'object' && value !== null && 'error' in value
        ? String(value.error)
        : translate(browserLocale(), 'error_request_failed'),
    )
  return value
}
