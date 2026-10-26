import { useState } from 'react'
import { ArrowLeft, ArrowUpRight, ShoppingBag, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { RevealGroup } from '@/components/ui/reveal'
import { useI18n } from '@/components/providers'
import { ContentHeading, FaqList } from '@/components/patterns/content-patterns'

export function StorefrontBlueprint() {
  const { t } = useI18n(),
    [query, setQuery] = useState(''),
    [selected, setSelected] = useState<string | null>(null),
    [viewed, setViewed] = useState(false)
  const goods = [
    {
      id: 'organizer',
      title: t('shop_organizer'),
      description: t('shop_organizer_body'),
      price: '$24',
      image: '/examples/catalog/organizer.svg',
    },
    {
      id: 'lamp',
      title: t('shop_lamp'),
      description: t('shop_lamp_body'),
      price: '$48',
      image: '/examples/catalog/lamp.svg',
    },
    {
      id: 'bag',
      title: t('shop_bag'),
      description: t('shop_bag_body'),
      price: '$18',
      image: '/examples/catalog/bag.svg',
    },
  ]
  const product = goods.find((item) => item.id === selected)
  return (
    <RevealGroup className="border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b px-6 py-6 sm:px-10">
        <span className="text-lg font-semibold">
          Ordinary Objects <Badge variant="outline">{t('bp_fictional')}</Badge>
        </span>
        <span className="text-xs text-muted-foreground">{t('shop_sample_notice')}</span>
      </header>
      {product ? (
        <div className="px-6 py-8 sm:px-10">
          <Button
            variant="ghost"
            onClick={() => {
              setSelected(null)
              setViewed(false)
            }}
          >
            <ArrowLeft />
            {t('shop_back')}
          </Button>
          <div className="mt-6 grid gap-8 lg:grid-cols-2">
            <img
              src={product.image}
              alt={product.title}
              className="aspect-[4/3] w-full object-cover"
            />
            <div className="self-center">
              <p className="mb-3 text-xs tracking-widest text-muted-foreground">
                {t('shop_series')}
              </p>
              <h2 className="text-3xl font-semibold">{product.title}</h2>
              <p className="mt-4 text-sm leading-8 text-muted-foreground">{product.description}</p>
              <p className="mt-6 text-2xl font-semibold">
                {product.price}
                <span className="ml-3 text-xs font-normal text-muted-foreground">
                  {t('shop_example_price')}
                </span>
              </p>
              <Button className="mt-7" size="lg" onClick={() => setViewed(true)}>
                <ShoppingBag />
                {t('shop_preview_action')}
              </Button>
              {viewed && (
                <p role="status" className="mt-4 text-sm leading-7 text-muted-foreground">
                  {t('shop_no_order')}
                </p>
              )}
            </div>
          </div>
          <div className="mt-10 border-t pt-8">
            <ContentHeading
              eyebrow={t('shop_details')}
              title={t('shop_detail_title')}
              description={t('shop_detail_body')}
            />
          </div>
        </div>
      ) : (
        <>
          <section className="grid gap-8 px-6 py-10 sm:px-10 lg:grid-cols-[1fr_1.2fr]">
            <div className="self-center">
              <p className="mb-4 text-xs tracking-widest text-muted-foreground">
                {t('shop_series')}
              </p>
              <h2
                data-reveal="enter"
                className="max-w-lg text-4xl font-semibold leading-tight tracking-tight sm:text-5xl"
              >
                {t('shop_headline')}
              </h2>
              <p
                data-reveal="enter"
                data-reveal-step="1"
                className="mt-5 max-w-md text-sm leading-8 text-muted-foreground"
              >
                {t('shop_intro')}
              </p>
              <Button
                data-reveal="enter"
                data-reveal-step="2"
                size="lg"
                className="mt-7"
                onClick={() => setSelected('organizer')}
              >
                {t('shop_explore')}
                <ArrowUpRight />
              </Button>
            </div>
            <img
              data-reveal="enter"
              data-reveal-step="3"
              src={goods[0]!.image}
              alt={goods[0]!.title}
              className="aspect-[4/3] w-full object-cover"
            />
          </section>
          <section className="px-6 pb-10 sm:px-10">
            <div className="mb-7 flex flex-wrap items-end justify-between gap-5 border-t pt-8">
              <ContentHeading eyebrow={t('shop_collection')} title={t('shop_collection_title')} />
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  aria-label={t('shop_search')}
                  placeholder={t('shop_search')}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {goods
                .filter((item) =>
                  (item.title + item.description)
                    .toLowerCase()
                    .includes(query.trim().toLowerCase()),
                )
                .map((item) => (
                  <article key={item.id} data-reveal="scroll" className="min-w-0">
                    <img
                      src={item.image}
                      alt={item.title}
                      className="aspect-[4/3] w-full object-cover"
                    />
                    <p className="mt-5 text-xs text-muted-foreground">{t('shop_series')}</p>
                    <h3 className="mt-2 text-lg font-semibold">{item.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">
                      {item.description}
                    </p>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <p className="font-semibold">
                        {item.price}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {t('shop_example_price')}
                        </span>
                      </p>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label={t('shop_open', { name: item.title })}
                        onClick={() => setSelected(item.id)}
                      >
                        <ArrowUpRight />
                      </Button>
                    </div>
                  </article>
                ))}
            </div>
            {!goods.some((item) =>
              (item.title + item.description).toLowerCase().includes(query.trim().toLowerCase()),
            ) && (
              <p role="status" className="py-8 text-sm text-muted-foreground">
                {t('shop_empty')}
              </p>
            )}
          </section>
          <section className="grid gap-8 border-t bg-muted/40 px-6 py-10 sm:px-10 lg:grid-cols-2">
            <ContentHeading
              eyebrow={t('shop_about')}
              title={t('shop_about_title')}
              description={t('shop_about_body')}
            />
            <FaqList items={[{ question: t('shop_faq'), answer: t('shop_faq_body') }]} />
          </section>
        </>
      )}
    </RevealGroup>
  )
}
