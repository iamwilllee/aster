import { Link } from '@tanstack/react-router'
import { Moon, Sun, Languages, LoaderCircle, AlertCircle } from 'lucide-react'
import { Button } from './ui/button'
import { useI18n } from './providers'
import type { ReactNode } from 'react'
import { site } from '@/config/site'
import { brand } from '@/config/brand'

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
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  )
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
