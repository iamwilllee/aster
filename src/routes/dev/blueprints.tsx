import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { getAuthInfo } from '@/server/functions'
import { Logo, Preferences, PageHeading } from '@/components/common'
import { useI18n } from '@/components/providers'
import { StorefrontBlueprint } from '@/components/dev/blueprints/storefront'
import { appearance } from '@/config/appearance'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { getRouteApi } from '@tanstack/react-router'
import { buttonVariants } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ProductBlueprint } from '@/components/dev/blueprints/product'
import { DirectoryBlueprint } from '@/components/dev/blueprints/directory'
import { WorkbenchBlueprint } from '@/components/dev/blueprints/workbench'

export const Route = createFileRoute('/dev/blueprints')({
  validateSearch: (
    search: Record<string, unknown>,
  ): { kind: 'product' | 'directory' | 'workbench' | 'shop' } => ({
    kind:
      search.kind === 'directory' || search.kind === 'workbench' || search.kind === 'shop'
        ? search.kind
        : 'product',
  }),
  loader: async () => {
    if (!(await getAuthInfo()).local) throw notFound()
  },
  component: Blueprints,
})
function Blueprints() {
  const { t } = useI18n()
  const { kind } = Route.useSearch()
  const navigate = Route.useNavigate()
  const rootSearch = getRouteApi('__root__').useSearch()
  const style = rootSearch._style ?? appearance.theme
  return (
    <div className="mx-auto max-w-7xl px-5 pb-16 sm:px-8">
      <header className="flex items-center justify-between gap-4 py-6">
        <Logo />
        <Preferences />
      </header>
      <PageHeading
        eyebrow="ASTER / PAGE BLUEPRINTS"
        title={t('bp_title')}
        description={t('bp_intro')}
        action={
          <Link to="/dev/ui" className={buttonVariants({ variant: 'outline' })}>
            {t('ui_reference_title')}
          </Link>
        }
      />
      <p
        role="note"
        className="mb-6 rounded-xl border border-primary/20 bg-accent p-4 text-sm leading-7 text-accent-foreground"
      >
        {t('bp_demo_notice')}
      </p>
      <div className="mb-6 grid max-w-xs gap-2">
        <Label htmlFor="visual-theme-preview">{t('theme_preview')}</Label>
        <Select
          value={style}
          items={{ sage: t('theme_sage'), catalog: t('theme_catalog') }}
          onValueChange={(value) => {
            if (value === 'sage' || value === 'catalog') {
              const url = new URL(window.location.href)
              url.searchParams.set('_style', value)
              window.location.assign(url.href)
            }
          }}
        >
          <SelectTrigger id="visual-theme-preview">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sage">{t('theme_sage')}</SelectItem>
            <SelectItem value="catalog">{t('theme_catalog')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Tabs
        value={kind}
        onValueChange={(value: unknown) => {
          if (
            value === 'product' ||
            value === 'directory' ||
            value === 'workbench' ||
            value === 'shop'
          )
            void navigate({ search: { kind: value } })
        }}
      >
        <TabsList aria-label={t('bp_choose')}>
          <TabsTrigger value="product">{t('bp_product')}</TabsTrigger>
          <TabsTrigger value="directory">{t('bp_directory')}</TabsTrigger>
          <TabsTrigger value="shop">{t('shop_tab')}</TabsTrigger>
          <TabsTrigger value="workbench">{t('bp_workbench')}</TabsTrigger>
        </TabsList>
        <TabsContent value="product">
          <ProductBlueprint />
        </TabsContent>
        <TabsContent value="directory">
          <DirectoryBlueprint />
        </TabsContent>
        <TabsContent value="shop">
          <StorefrontBlueprint />
        </TabsContent>
        <TabsContent value="workbench">
          <WorkbenchBlueprint />
        </TabsContent>
      </Tabs>
    </div>
  )
}
