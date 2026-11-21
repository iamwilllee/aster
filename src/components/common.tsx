import { Link } from '@tanstack/react-router'
import { Moon, Sun, Languages, LoaderCircle } from 'lucide-react'
import { Alert } from './ui/alert'
import { Button } from './ui/button'
import { useI18n } from './providers'
import type { ComponentProps, ReactNode } from 'react'
import { site } from '@/config/site'
import { brand } from '@/config/brand'

/** The page's main landmark and the target of the skip link. One per page. */
export function Main(props: ComponentProps<'main'>) {
  return <main id="main-content" tabIndex={-1} {...props} />
}
/** The first focusable element: lets keyboard users jump past the header and navigation. */
export function SkipLink() {
  const { t } = useI18n()
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-100 focus:rounded-full focus:border focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:text-foreground focus:shadow-lg"
    >
      {t('skip_to_content')}
    </a>
  )
}
export function Logo({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n()
  return (
    <Link
      to="/"
      className="flex items-center gap-2.5 font-semibold tracking-tight"
      aria-label={t('home_label', { name: site.name })}
    >
      <img
        src={brand.icon}
        alt=""
        width={32}
        height={32}
        className={`size-8 shrink-0${brand.iconDark ? ' dark:hidden' : ''}`}
      />
      {brand.iconDark && (
        <img
          src={brand.iconDark}
          alt=""
          width={32}
          height={32}
          className="hidden size-8 shrink-0 dark:block"
        />
      )}
      {!compact && (
        <span className="text-xl">
          {site.name}
          <span className="ml-1 text-primary">.</span>
        </span>
      )}
    </Link>
  )
}
export function Preferences() {
  const { locale, toggle, t } = useI18n()
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggle}
        aria-label={locale === 'zh' ? 'Switch to English' : '切换中文'}
        title={locale === 'zh' ? 'English' : '中文'}
      >
        <Languages size={17} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t('toggle_theme')}
        onClick={() => {
          const dark = document.documentElement.classList.toggle('dark')
          document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
          try {
            localStorage.setItem('starter-theme', dark ? 'dark' : 'light')
          } catch {
            /* Theme remains usable when storage is unavailable. */
          }
        }}
      >
        <Moon size={17} className="dark:hidden" />
        <Sun size={17} className="hidden dark:block" />
      </Button>
    </div>
  )
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
      <div>
        <p className="mb-3 text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          {eyebrow}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  )
}
export function ErrorNotice({ children }: { children: ReactNode }) {
  return <Alert variant="error">{children}</Alert>
}
export function Loading() {
  const { t } = useI18n()
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground"
    >
      <LoaderCircle className="size-4 animate-spin" />
      {t('loading')}
    </div>
  )
}
