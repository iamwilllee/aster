import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

// Native disclosure preserves keyboard/SSR behavior without a second accordion dependency.
export function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group border-b last:border-b-0">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-sm py-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      <div className="pb-5 text-sm leading-7 text-muted-foreground">{children}</div>
    </details>
  )
}
