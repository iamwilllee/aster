import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useI18n } from '@/components/providers'
import { Button, buttonVariants } from '@/components/ui/button'
import { RevealGroup } from '@/components/ui/reveal'

export function MotionExamples() {
  const { t } = useI18n()
  const [revision, setRevision] = useState(0)
  return (
    <section aria-labelledby="motion-title" className="rounded-xl border bg-card p-6 sm:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <h3 id="motion-title" className="text-lg font-semibold">
            {t('ui_motion_title')}
          </h3>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            {t('ui_motion_description')}
          </p>
        </div>
        <Button variant="outline" onClick={() => setRevision(revision + 1)}>
          <RotateCcw />
          {t('ui_motion_replay')}
        </Button>
      </div>
      <RevealGroup
        key={revision}
        className="grid gap-4 sm:grid-cols-3"
        aria-label={t('ui_motion_title')}
      >
        {(
          [
            'get_the_foundations_right',
            'start_small_grow_deliberately',
            'make_it_your_own',
          ] as const
        ).map((key, index) => (
          <div
            key={key}
            data-reveal="enter"
            data-reveal-step={index}
            className="motion-hover rounded-lg border bg-background p-5"
          >
            <p className="mb-6 font-mono text-xs text-primary">0{index + 1}</p>
            <p className="text-base font-medium">{t(key)}</p>
          </div>
        ))}
      </RevealGroup>
      <RevealGroup className="mt-6">
        <div data-reveal="scroll" className="rounded-lg border bg-muted/40 p-5">
          <p className="mb-4 text-sm leading-7 text-muted-foreground">{t('ui_motion_scroll')}</p>
          <Link to="/" className={buttonVariants({ variant: 'outline' })}>
            {t('back_home')}
          </Link>
        </div>
      </RevealGroup>
    </section>
  )
}
