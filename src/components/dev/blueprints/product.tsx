import { useRef, useState, type FormEvent } from 'react'
import { ArrowRight, Check, FileText, Layers, ListChecks, PencilLine } from 'lucide-react'
import { ErrorNotice } from '@/components/common'
import { useI18n } from '@/components/providers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  ContentHeading,
  FeatureRows,
  ProcessSteps,
  FaqList,
} from '@/components/patterns/content-patterns'

export function ProductBlueprint() {
  const { t } = useI18n()
  const [title, setTitle] = useState(''),
    [audience, setAudience] = useState(''),
    [outcome, setOutcome] = useState('')
  const [result, setResult] = useState<{ title: string; audience: string; outcome: string } | null>(
    null,
  )
  const [error, setError] = useState('')
  const firstInput = useRef<HTMLInputElement>(null)
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim() || !audience.trim() || !outcome.trim()) {
      setError(t('bp_required'))
      setResult(null)
      return
    }
    setError('')
    setResult({ title: title.trim(), audience: audience.trim(), outcome: outcome.trim() })
  }
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4 sm:px-10">
        <span className="flex items-center gap-2 font-semibold">
          <PencilLine className="size-5 text-primary" /> Fieldnote{' '}
          <Badge variant="outline">{t('bp_fictional')}</Badge>
        </span>
        <span className="text-xs text-muted-foreground">{t('bp_product_nav')}</span>
      </div>
      <section className="grid gap-10 px-6 py-12 sm:px-10 lg:grid-cols-[1.1fr_1fr] lg:py-20">
        <div>
          <p className="mb-4 font-mono text-xs tracking-widest text-primary">
            {t('bp_product_kicker')}
          </p>
          <h2 className="max-w-xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            {t('bp_product_headline')}
          </h2>
          <p className="mt-6 max-w-lg text-base leading-8 text-muted-foreground">
            {t('bp_product_body')}
          </p>
          <Button size="lg" className="mt-7" onClick={() => firstInput.current?.focus()}>
            {t('bp_try_demo')}
            <ArrowRight />
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">{t('bp_no_account')}</p>
        </div>
        <div className="self-center rounded-xl border bg-background p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between border-b pb-4">
            <span className="flex items-center gap-2 text-sm">
              <FileText className="size-4" />
              {t('bp_preview_label')}
            </span>
            <Badge variant="secondary">{t('bp_fictional')}</Badge>
          </div>
          <p className="text-xl font-semibold">{t('bp_preview_title')}</p>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">{t('bp_preview_body')}</p>
          <ul className="mt-6 space-y-3">
            {(['bp_preview_one', 'bp_preview_two', 'bp_preview_three'] as const).map((key) => (
              <li key={key} className="flex gap-3 text-sm">
                <Check className="size-4 shrink-0 text-primary" />
                {t(key)}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="border-t px-6 py-10 sm:px-10">
        <ContentHeading eyebrow={t('bp_why')} title={t('bp_features_title')} />
        <div className="mt-5">
          <FeatureRows
            items={[
              {
                icon: <PencilLine className="size-5" />,
                title: t('bp_feature_one'),
                description: t('bp_feature_one_body'),
              },
              {
                icon: <Layers className="size-5" />,
                title: t('bp_feature_two'),
                description: t('bp_feature_two_body'),
              },
              {
                icon: <ListChecks className="size-5" />,
                title: t('bp_feature_three'),
                description: t('bp_feature_three_body'),
              },
            ]}
          />
        </div>
      </section>
      <section className="border-t bg-muted/30 px-6 py-10 sm:px-10">
        <ContentHeading eyebrow={t('bp_how')} title={t('bp_steps_title')} />
        <div className="mt-7">
          <ProcessSteps
            items={[
              { title: t('bp_step_one'), description: t('bp_step_one_body') },
              { title: t('bp_step_two'), description: t('bp_step_two_body') },
              { title: t('bp_step_three'), description: t('bp_step_three_body') },
            ]}
          />
        </div>
      </section>
      <section
        className="grid gap-8 border-t px-6 py-10 sm:px-10 lg:grid-cols-[1fr_1.4fr]"
        aria-labelledby="brief-demo-title"
      >
        <div>
          <ContentHeading
            eyebrow={t('bp_try_demo')}
            title={t('bp_form_title')}
            description={t('bp_form_body')}
          />
          <p className="mt-5 text-xs leading-6 text-muted-foreground">{t('bp_no_ai')}</p>
        </div>
        <form onSubmit={submit} className="grid gap-5">
          <h3 id="brief-demo-title" className="sr-only">
            {t('bp_form_title')}
          </h3>
          <div className="grid gap-2">
            <Label htmlFor="brief-title">{t('bp_brief_title')}</Label>
            <Input
              ref={firstInput}
              id="brief-title"
              required
              maxLength={80}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="brief-audience">{t('bp_brief_audience')}</Label>
            <Input
              id="brief-audience"
              required
              maxLength={100}
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="brief-outcome">{t('bp_brief_outcome')}</Label>
            <Textarea
              id="brief-outcome"
              required
              maxLength={500}
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
            />
          </div>
          <Button type="submit" className="justify-self-start">
            {t('bp_build_brief')}
            <ArrowRight />
          </Button>
          {error && <ErrorNotice>{error}</ErrorNotice>}
          {result && (
            <div role="status" className="min-w-0 break-words rounded-xl border bg-accent p-5">
              <p className="text-sm font-medium">{t('bp_brief_ready')}</p>
              <dl className="mt-4 space-y-3 text-sm">
                {[
                  [t('bp_brief_title'), result.title],
                  [t('bp_brief_audience'), result.audience],
                  [t('bp_brief_outcome'), result.outcome],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="mt-1 whitespace-pre-wrap">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </form>
      </section>
      <section className="grid gap-8 border-t px-6 py-10 sm:px-10 lg:grid-cols-[1fr_1.4fr]">
        <ContentHeading eyebrow="FAQ" title={t('bp_faq_title')} />
        <FaqList
          items={[
            { question: t('bp_faq_one'), answer: t('bp_faq_one_body') },
            { question: t('bp_faq_two'), answer: t('bp_faq_two_body') },
            { question: t('bp_faq_three'), answer: t('bp_faq_three_body') },
          ]}
        />
      </section>
      <footer className="flex flex-wrap items-center justify-between gap-4 border-t bg-muted/30 px-6 py-6 sm:px-10">
        <p className="text-sm">{t('bp_footer_cta')}</p>
        <Button variant="outline" onClick={() => firstInput.current?.focus()}>
          {t('bp_try_demo')}
          <ArrowRight />
        </Button>
      </footer>
    </div>
  )
}
