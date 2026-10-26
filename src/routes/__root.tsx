import {
  HeadContent,
  Scripts,
  Outlet,
  createRootRoute,
  Link,
  retainSearchParams,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'
import css from '../styles.css?url'
import { Providers, useI18n } from '@/components/providers'
import { appearance } from '@/config/appearance'
import type { VisualTheme } from '@/config/appearance-policy.mjs'
import { site } from '@/config/site'
import { translate, localizePath, type Locale } from '@/i18n/core'
import { getPublicConfig } from '@/server/functions'
import { Button } from '@/components/ui/button'

export const Route = createRootRoute({
  validateSearch: (
    search: Record<string, unknown>,
  ): { _locale?: Locale; _style?: VisualTheme } => ({
    _locale: search._locale === 'zh' ? 'zh' : 'en',
    ...(search._style === 'sage' || search._style === 'catalog' ? { _style: search._style } : {}),
  }),
  search: { middlewares: [retainSearchParams(['_locale', '_style'])] },
  loader: () => getPublicConfig(),
  head: ({ match, matches, loaderData }) => {
    const locale = match.search._locale ?? 'en'
    const path = matches.at(-1)?.pathname ?? '/'
    const publicPage = ['/', '/pricing', '/content'].includes(path) || path.startsWith('/content/')
    const origin = loaderData?.origin ?? ''
    return {
      meta: [
        { charSet: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { title: `${site.name} · ${translate(locale, 'page_title')}` },
        { name: 'description', content: site.description[locale] },
        { name: 'referrer', content: 'no-referrer' },
        {
          name: 'robots',
          content: loaderData?.indexable && publicPage ? 'index,follow' : 'noindex,nofollow',
        },
      ],
      links: [
        { rel: 'stylesheet', href: css },
        { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
        ...(publicPage && origin
          ? [
              { rel: 'canonical', href: origin + localizePath(path, locale) },
              ...(['en', 'zh'] as const).map((lang) => ({
                rel: 'alternate',
                hrefLang: lang === 'zh' ? 'zh-CN' : 'en',
                href: origin + localizePath(path, lang),
              })),
              { rel: 'alternate', hrefLang: 'x-default', href: origin + localizePath(path, 'en') },
            ]
          : []),
      ],
    }
  },
  component: Root,
  notFoundComponent: NotFound,
  errorComponent: ({ reset }) => <Failure reset={reset} />,
})
function NotFound() {
  const { t } = useI18n()
  return (
    <main className="grid min-h-screen place-content-center gap-4 p-8 text-center">
      <p className="text-sm text-muted-foreground">404 · PAGE NOT FOUND</p>
      <h1 className="text-2xl font-semibold">{t('not_found')}</h1>
      <Link to="/" className="text-primary underline">
        {t('back_home')}
      </Link>
    </main>
  )
}
function Failure({ reset }: { reset: () => void }) {
  const { t } = useI18n()
  return (
    <main className="grid min-h-screen place-content-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">{t('page_unavailable')}</h1>
      <p>{t('check_service')}</p>
      <Button onClick={reset} variant="link">
        {t('reload_page')}
      </Button>
    </main>
  )
}
function Document({
  children,
  locale,
  theme,
}: {
  children: ReactNode
  locale: Locale
  theme: VisualTheme
}) {
  return (
    <html
      data-visual-theme={theme}
      lang={locale === 'zh' ? 'zh-CN' : 'en'}
      suppressHydrationWarning
    >
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('starter-theme')==='dark'||(!localStorage.getItem('starter-theme')&&matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark')}catch{}`,
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
function Root() {
  const search = Route.useSearch()
  const locale = search._locale ?? 'en'
  const config = Route.useLoaderData()
  const theme = config.local ? (search._style ?? appearance.theme) : appearance.theme
  return (
    <Document locale={locale} theme={theme}>
      <Providers locale={locale}>
        <Outlet />
      </Providers>
    </Document>
  )
}
