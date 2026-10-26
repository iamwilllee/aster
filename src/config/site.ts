export const site = {
  name: 'Aster',
  description: {
    en: 'An open-source product foundation for AI agents, built on TanStack Start and Cloudflare.',
    zh: '给 Agent 一个可靠的起点。基于 TanStack Start 与 Cloudflare 的开源产品底座。',
  },
  version: '0.2.0-beta.1',
} as const

export const plans = {
  free: { name: 'Free', projectLimit: 3 },
  pro: { name: 'Pro', projectLimit: 50 },
} as const
