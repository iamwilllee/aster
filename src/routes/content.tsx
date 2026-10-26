import { createFileRoute, Outlet, notFound, Link } from '@tanstack/react-router'
import { features } from '@/config/features'
import { Logo, Preferences } from '@/components/common'
import { useI18n } from '@/components/providers'
export const Route = createFileRoute('/content')({
  beforeLoad: () => {
    if (!features.content) throw notFound()
  },
  headers: () => ({ 'Cache-Control': 'no-store, max-age=0' }),
  component: Shell,
})
function Shell() {
  const { t } = useI18n()
  return (
    <div className="mx-auto max-w-6xl px-5 pb-20 sm:px-8">
      <header className="flex items-center justify-between gap-4 py-6">
        <Logo />
        <div className="flex items-center gap-4">
          <Link to="/content" className="text-sm hover:underline">
            {t('content_title')}
          </Link>
          <Preferences />
        </div>
      </header>
      <Outlet />
    </div>
  )
}
