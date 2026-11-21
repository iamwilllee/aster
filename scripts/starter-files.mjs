import { basename } from 'node:path'

// Deliberate source roots: arbitrary files at the repository root are not product assets.
export const templateFiles = [
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  '.gitignore',
  '.node-version',
  '.prettierrc.json',
  '.prettierignore',
  'LICENSE',
  'THIRD_PARTY_NOTICES.md',
  'AGENTS.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'CHANGELOG.md',
  'starter-version.json',
  'components.json',
  'tsconfig.json',
  'vite.config.ts',
  'vitest.config.ts',
  'playwright.config.ts',
  'playwright.production.config.ts',
  'eslint.config.js',
  'drizzle.config.ts',
]
export const templateDirectories = [
  'src',
  'public',
  'migrations',
  'scripts',
  'skills',
  'docs',
  'tests',
  '.github',
]
const ignored = new Set([
  '.git',
  '.aws',
  '.ssh',
  '.agents',
  '.codex',
  '.aster',
  'node_modules',
  '.pnpm-store',
  'dist',
  '.wrangler',
  '.tanstack',
  'coverage',
  'test-results',
  'playwright-report',
  '.DS_Store',
  'private',
  '.local',
  'qa',
  // The README's illustrated design (docs/readme) and the archived original README
  // (docs/project-guide.md) describe Aster itself, not a generated product.
  'readme',
  'project-guide.md',
])
export function excludedTemplatePath(path) {
  const name = basename(path)
  return (
    ignored.has(name) ||
    /^\.env(?:\.|$)/.test(name) ||
    name.startsWith('.dev.vars') ||
    /\.(?:log|pem|key|p12|pfx|sqlite|sqlite3|db)(?:-[\w]+)?$/i.test(name)
  )
}
