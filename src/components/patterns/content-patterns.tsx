import type { ReactNode } from 'react'
import { Disclosure } from '@/components/ui/disclosure'

export function ContentHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description?: string
}) {
  return (
    <div className="max-w-2xl">
      <p className="mb-3 font-mono text-xs tracking-widest text-primary">{eyebrow}</p>
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
      {description && (
        <p className="mt-4 text-base leading-7 text-muted-foreground">{description}</p>
      )}
    </div>
  )
}

export function FeatureRows({
  items,
}: {
  items: { title: string; description: string; icon: ReactNode }[]
}) {
  return (
    <div className="divide-y">
      {items.map((item) => (
        <div key={item.title} className="grid gap-4 py-6 sm:grid-cols-[2rem_1fr_1.3fr]">
          <span className="text-primary">{item.icon}</span>
          <h3 className="font-medium">{item.title}</h3>
          <p className="text-base leading-7 text-muted-foreground">{item.description}</p>
        </div>
      ))}
    </div>
  )
}

export function ProcessSteps({ items }: { items: { title: string; description: string }[] }) {
  return (
    <ol className="grid gap-7 sm:grid-cols-3">
      {items.map((item, index) => (
        <li key={item.title} className="border-t pt-5">
          <span className="font-mono text-xs text-primary">
            {String(index + 1).padStart(2, '0')}
          </span>
          <h3 className="mt-4 font-medium">{item.title}</h3>
          <p className="mt-2 text-base leading-7 text-muted-foreground">{item.description}</p>
        </li>
      ))}
    </ol>
  )
}

export function FaqList({ items }: { items: { question: string; answer: string }[] }) {
  return (
    <div>
      {items.map((item) => (
        <Disclosure key={item.question} title={item.question}>
          <p>{item.answer}</p>
        </Disclosure>
      ))}
    </div>
  )
}
