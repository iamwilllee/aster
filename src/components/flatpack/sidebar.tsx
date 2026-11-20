import * as React from 'react'

export function Sidebar(props: React.HTMLAttributes<HTMLElement>) {
  return <aside data-slot="sidebar" {...props} />
}
export function SidebarSection({ label, children, ...props }: Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> & { label: string; children: React.ReactNode }) {
  return <div data-slot="sidebar-section" {...props}><div className="fp-label" style={{ padding: 'var(--fp-space-1) var(--fp-space-3) var(--fp-space-2)' }}>{label}</div>{children}</div>
}
/** A navigation button. Use `render` to make it a router link: <SidebarItem render={<Link to="/x" />}>. */
export function SidebarItem({ children, active = false, icon, render, ...props }: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & { children: React.ReactNode; active?: boolean; icon?: React.ReactNode; render?: React.ReactElement<Record<string, unknown>> }) {
  const shared = { 'data-slot': 'sidebar-item', 'data-active': active, 'aria-current': active ? ('page' as const) : undefined, title: typeof children === 'string' ? children : undefined, ...props }
  const content = <>{icon}<span data-slot="sidebar-item-text">{children}</span></>
  return render ? React.cloneElement(render, shared, content) : <button type="button" {...shared}>{content}</button>
}
