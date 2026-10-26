import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { ArrowUpRight, LoaderCircle, Plus } from 'lucide-react'
import { getAuthInfo } from '@/server/functions'
import { Logo, Preferences, PageHeading, ErrorNotice } from '@/components/common'
import { useI18n } from '@/components/providers'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { PrimitiveExamples, PatternExamples, DesignExamples } from '@/components/dev/ui-patterns'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

export const Route = createFileRoute('/dev/ui')({
  loader: async () => {
    if (!(await getAuthInfo()).local) throw notFound()
  },
  component: UiReference,
})

function UiReference() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [disabled, setDisabled] = useState(false)
  const choices = { idea: t('idea'), building: t('building'), live: t('live') }
  function options() {
    return Object.entries(choices).map(([value, label]) => (
      <SelectItem key={value} value={value}>
        {label}
      </SelectItem>
    ))
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setOpen(false)
    setSaved(true)
  }
  return (
    <div className="mx-auto max-w-6xl px-5 pb-16 sm:px-8">
      <header className="mb-10 flex items-center justify-between py-6">
        <Logo />
        <Preferences />
      </header>
      <PageHeading
        eyebrow="ASTER UI"
        title={t('ui_reference_title')}
        description={t('ui_reference_description')}
        action={
          <Link
            to="/dev/blueprints"
            search={{ kind: 'product' }}
            className={buttonVariants({ variant: 'outline' })}
          >
            {t('bp_title')}
            <ArrowUpRight />
          </Link>
        }
      />
      <p className="mb-8 rounded-lg border bg-accent px-4 py-3 text-sm text-accent-foreground">
        {t('ui_local_only')}
      </p>
      <Tabs defaultValue="components">
        <TabsList aria-label={t('ui_reference_sections')}>
          <TabsTrigger value="components">{t('ui_components_tab')}</TabsTrigger>
          <TabsTrigger value="patterns">{t('ui_patterns_tab')}</TabsTrigger>
          <TabsTrigger value="design">{t('ui_design_tab')}</TabsTrigger>
        </TabsList>
        <TabsContent value="components">
          <section
            className="mb-8 space-y-5 rounded-xl border bg-card p-5 sm:p-6"
            aria-labelledby="sizes-title"
          >
            <h2 id="sizes-title" className="text-lg font-semibold">
              {t('ui_sizes')}
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">{t('ui_sizes_description')}</p>
            {(
              [
                { size: 'sm', height: 32 },
                { size: 'default', height: 36 },
                { size: 'lg', height: 44 },
              ] as const
            ).map(({ size, height }) => (
              <div
                key={size}
                data-ui-row={size}
                className="grid items-end gap-3 sm:grid-cols-[8rem_1fr_1fr_auto]"
              >
                <p className="self-center whitespace-nowrap font-mono text-sm">
                  {size} · {height}px
                </p>
                <div className="grid gap-2">
                  <Label htmlFor={`ui-name-${size}`}>{t('project_name')}</Label>
                  <Input
                    id={`ui-name-${size}`}
                    size={size}
                    placeholder={t('ui_name_placeholder')}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`ui-status-${size}`}>{t('status')}</Label>
                  <Select defaultValue="idea" items={choices}>
                    <SelectTrigger id={`ui-status-${size}`} size={size}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>{options()}</SelectContent>
                  </Select>
                </div>
                <Button
                  size={size}
                  onClick={() => {
                    setSaved(false)
                    setOpen(true)
                  }}
                >
                  <Plus />
                  {t('ui_open_dialog')}
                </Button>
              </div>
            ))}
          </section>
          <div className="grid gap-8 lg:grid-cols-2">
            <section
              className="space-y-5 rounded-xl border bg-card p-5 sm:p-6"
              aria-labelledby="states-title"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="states-title" className="text-lg font-semibold">
                  {t('ui_states')}
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDisabled(!disabled)}
                  aria-pressed={disabled}
                >
                  {t('ui_toggle_disabled')}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button disabled={disabled}>{t('ui_primary')}</Button>
                <Button variant="outline" disabled={disabled}>
                  {t('ui_secondary')}
                </Button>
                <Button variant="destructive" disabled={disabled}>
                  {t('delete')}
                </Button>
                <Button size="icon" aria-label={t('new_project')} disabled={disabled}>
                  <Plus />
                </Button>
              </div>
              <Button disabled>
                <LoaderCircle className="animate-spin" />
                {t('saving')}
              </Button>
              <div className="grid gap-2">
                <Label htmlFor="ui-disabled-input">{t('ui_disabled_field')}</Label>
                <Input id="ui-disabled-input" defaultValue={t('ui_name_placeholder')} disabled />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ui-disabled-select">{t('ui_disabled_select')}</Label>
                <Select defaultValue="idea" items={choices} disabled>
                  <SelectTrigger id="ui-disabled-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>{options()}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ui-error-input">{t('ui_invalid_field')}</Label>
                <Input
                  id="ui-error-input"
                  aria-invalid="true"
                  aria-describedby="ui-field-error"
                  disabled={disabled}
                />
                <p id="ui-field-error" className="text-sm text-destructive">
                  {t('ui_field_error')}
                </p>
              </div>
              <ErrorNotice>{t('ui_error_example')}</ErrorNotice>
            </section>
            <section
              className="space-y-5 rounded-xl border bg-card p-5 sm:p-6"
              aria-labelledby="details-title"
            >
              <h2 id="details-title" className="text-lg font-semibold">
                {t('ui_multiline')}
              </h2>
              <div className="grid gap-2">
                <Label htmlFor="ui-description">{t('a_short_description')}</Label>
                <Textarea
                  id="ui-description"
                  placeholder={t('what_would_you_like_to_build')}
                  disabled={disabled}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge>{t('idea')}</Badge>
                <Badge variant="secondary">{t('building')}</Badge>
                <Badge variant="outline">{t('live')}</Badge>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">{t('ui_keyboard_help')}</p>
              <p className="text-sm leading-6 text-muted-foreground">{t('ui_reference_docs')}</p>
              <p role="status" className="text-sm text-primary">
                {saved ? t('ui_demo_submitted') : t('ui_demo_idle')}
              </p>
            </section>
          </div>
          <PrimitiveExamples />
        </TabsContent>
        <TabsContent value="patterns">
          <PatternExamples />
        </TabsContent>
        <TabsContent value="design">
          <DesignExamples />
        </TabsContent>
      </Tabs>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('ui_dialog_title')}</DialogTitle>
            <DialogDescription>{t('ui_dialog_description')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-5">
            <div className="grid gap-2">
              <Label htmlFor="ui-dialog-name">{t('project_name')}</Label>
              <Input
                id="ui-dialog-name"
                name="name"
                required
                maxLength={80}
                placeholder={t('ui_name_placeholder')}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ui-dialog-status">{t('status')}</Label>
              <Select name="status" defaultValue="idea" items={choices}>
                <SelectTrigger id="ui-dialog-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>{options()}</SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t('cancel')}
              </Button>
              <Button type="submit">
                {t('ui_demo_submit')}
                <ArrowUpRight />
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
