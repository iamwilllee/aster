import en from './en.json'
import zh from './zh.json'

export type Locale = 'en' | 'zh'
export type MessageKey = keyof typeof en
const messages: Record<Locale, Record<MessageKey, string>> = { en, zh }
export const isMessageKey = (value: string): value is MessageKey => Object.hasOwn(en, value)
export function translate(
  locale: Locale,
  key: MessageKey,
  values: Record<string, string | number> = {},
) {
  return messages[locale][key].replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    String(values[name] ?? placeholder),
  )
}
export function localeFromPath(path: string): Locale {
  return /^\/zh(?:\/|$)/.test(path) ? 'zh' : 'en'
}
export function stripLocale(path: string) {
  return path.replace(/^\/zh(?=\/|$)/, '') || '/'
}
export function localizePath(path: string, locale: Locale) {
  const plain = stripLocale(path)
  return locale === 'zh' ? `/zh${plain === '/' ? '' : plain}` : plain
}
export function requestLocale(request: Request): Locale {
  return request.headers.get('x-starter-locale') === 'zh' ||
    localeFromPath(new URL(request.url).pathname) === 'zh'
    ? 'zh'
    : 'en'
}
export function browserLocale(): Locale {
  return typeof document !== 'undefined' && document.documentElement.lang.startsWith('zh')
    ? 'zh'
    : 'en'
}
export function localizedError(message: string, locale: Locale) {
  const key = (Object.keys(zh) as MessageKey[]).find((entry) => zh[entry] === message)
  if (key) return translate(locale, key)
  const quota = /^当前套餐最多创建 (\d+) 个项目$/.exec(message)
  if (quota) return translate(locale, 'error_project_limit', { count: quota[1]! })
  return translate(locale, 'error_request_failed')
}
