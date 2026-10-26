export type DeviceBrowser = 'edge' | 'opera' | 'chrome' | 'firefox' | 'safari' | 'unknown'
export type DevicePlatform = 'android' | 'ios' | 'windows' | 'macos' | 'linux' | 'unknown'
export interface AccountSession {
  id: string
  current: boolean
  browser: DeviceBrowser
  platform: DevicePlatform
  createdAt: number
  updatedAt: number
  expiresAt: number
}
export interface AccountSecurity {
  canChangePassword: boolean
  sessions: AccountSession[]
  hasMore: boolean
}

// User-controlled UA text is reduced to fixed categories; no raw UA/IP reaches the UI.
export function sessionDevice(agent: string | null): {
  browser: DeviceBrowser
  platform: DevicePlatform
} {
  const text = (agent ?? '').slice(0, 2048)
  const browser: DeviceBrowser = /Edg(?:e|A|iOS)?\//i.test(text)
    ? 'edge'
    : /(?:OPR|Opera)\//i.test(text)
      ? 'opera'
      : /(?:Chrome|Chromium|CriOS)\//i.test(text)
        ? 'chrome'
        : /(?:Firefox|FxiOS)\//i.test(text)
          ? 'firefox'
          : /Version\/.+Safari\//i.test(text)
            ? 'safari'
            : 'unknown'
  const platform: DevicePlatform = /Android/i.test(text)
    ? 'android'
    : /iPhone|iPad|iPod/i.test(text)
      ? 'ios'
      : /Windows/i.test(text)
        ? 'windows'
        : /Macintosh|Mac OS X/i.test(text)
          ? 'macos'
          : /Linux/i.test(text)
            ? 'linux'
            : 'unknown'
  return { browser, platform }
}
