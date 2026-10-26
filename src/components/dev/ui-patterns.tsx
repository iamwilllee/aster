import { useState } from 'react'
import {
  Search,
  FolderOpen,
  SlidersHorizontal,
  MoreHorizontal,
  Eye,
  Check,
  Palette,
  ArrowUpRight,
} from 'lucide-react'
import { MotionExamples } from '@/components/dev/motion-examples'
import { useI18n } from '@/components/providers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import {
  ListToolbar,
  EmptyState,
  SettingsSection,
  DetailList,
  Pagination,
  ListSkeleton,
} from '@/components/patterns/page-patterns'
import { ErrorNotice } from '@/components/common'

export function PrimitiveExamples() {
  const { t } = useI18n()
  const toast = useToast()
  return (
    <section
      className="mt-8 rounded-xl border bg-card p-5 sm:p-6"
      aria-labelledby="interaction-title"
    >
      <h2 id="interaction-title" className="text-lg font-semibold">
        {t('ui_interactions')}
      </h2>
      <p className="mb-6 mt-2 text-sm text-muted-foreground">{t('ui_interactions_description')}</p>
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="grid gap-5">
          <Label className="flex min-h-11 items-center gap-3">
            <Checkbox name="demo-confirm" />
            {t('ui_checkbox_label')}
          </Label>
          <Label className="flex min-h-11 items-center justify-between gap-3">
            {t('ui_switch_label')}
            <Switch name="demo-preview" defaultChecked />
          </Label>
          <Label className="flex min-h-11 items-center gap-3 text-muted-foreground">
            <Checkbox disabled defaultChecked />
            {t('ui_disabled_choice')}
          </Label>
          <Label className="flex min-h-11 items-center justify-between gap-3 text-muted-foreground">
            {t('ui_disabled_switch')}
            <Switch disabled />
          </Label>
        </div>
        <div className="flex flex-wrap content-start items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" />}>
              <MoreHorizontal />
              {t('ui_open_menu')}
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                onClick={() =>
                  toast.add({
                    title: t('ui_demo_action'),
                    description: t('ui_temporary_only'),
                    type: 'success',
                  })
                }
              >
                <Check />
                {t('ui_show_toast')}
              </DropdownMenuItem>
              <DropdownMenuItem disabled>{t('ui_unavailable_action')}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Tooltip>
            <TooltipTrigger
              render={<Button variant="outline" size="icon" aria-label={t('ui_tooltip_trigger')} />}
            >
              <SlidersHorizontal />
            </TooltipTrigger>
            <TooltipContent>{t('ui_tooltip_content')}</TooltipContent>
          </Tooltip>
          <Button
            variant="secondary"
            onClick={() =>
              toast.add({
                title: t('ui_demo_action'),
                description: t('ui_temporary_only'),
                type: 'success',
              })
            }
          >
            {t('ui_show_toast')}
          </Button>
        </div>
      </div>
    </section>
  )
}

export function PatternExamples() {
  const { t } = useI18n()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<number | null>(null)
  const [state, setState] = useState('ready')
  const records = Array.from({ length: 7 }, (_, i) => ({
    id: i + 1,
    name: `${t('ui_sample_record')} ${String(i + 1).padStart(2, '0')}`,
  })).filter((item) => item.name.toLowerCase().includes(q.toLowerCase()))
  const pages = Math.max(1, Math.ceil(records.length / 3))
  const current = Math.min(page, pages)
  return (
    <div className="space-y-8">
      <section aria-labelledby="list-pattern-title">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mb-2 font-mono text-xs text-primary">01 / COLLECTION</p>
            <h2 id="list-pattern-title" className="text-xl font-semibold">
              {t('ui_list_pattern')}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{t('ui_list_pattern_description')}</p>
          </div>
          <Badge variant="outline">{t('ui_demo_badge')}</Badge>
        </div>
        <ListToolbar
          search={
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="bg-card pl-9"
                aria-label={t('ui_search_records')}
                placeholder={t('ui_search_records')}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value)
                  setPage(1)
                }}
              />
            </div>
          }
          filters={<span className="text-xs text-muted-foreground">{t('ui_seven_records')}</span>}
        />
        {records.length ? (
          <>
            <div className="overflow-hidden rounded-xl border bg-card">
              <Table>
                <caption className="sr-only">{t('ui_list_pattern')}</caption>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('project_name')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead>{t('view_details')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.slice((current - 1) * 3, current * 3).map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <p className="min-w-40 font-medium">{record.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t('ui_temporary_only')}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{t('idea')}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t('details_for', { name: record.name })}
                          onClick={() => setDetail(record.id)}
                        >
                          <Eye />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination
              page={current}
              pageCount={pages}
              total={records.length}
              onPageChange={setPage}
            />
          </>
        ) : (
          <EmptyState
            icon={<FolderOpen className="size-6" />}
            title={t('no_matching_projects')}
            description={t('try_a_different_search_or_filter')}
            action={
              <Button variant="outline" onClick={() => setQ('')}>
                {t('ui_clear_search')}
              </Button>
            }
          />
        )}
      </section>
      <section
        className="rounded-xl border bg-card p-5 sm:p-6"
        aria-labelledby="state-pattern-title"
      >
        <p className="mb-2 font-mono text-xs text-primary">02 / FEEDBACK</p>
        <h2 id="state-pattern-title" className="mb-5 text-xl font-semibold">
          {t('ui_state_pattern')}
        </h2>
        <Tabs value={state} onValueChange={(value) => setState(String(value))}>
          <TabsList aria-label={t('ui_state_pattern')}>
            <TabsTrigger value="ready">{t('ui_state_ready')}</TabsTrigger>
            <TabsTrigger value="loading">{t('ui_state_loading')}</TabsTrigger>
            <TabsTrigger value="empty">{t('ui_state_empty')}</TabsTrigger>
            <TabsTrigger value="error">{t('ui_state_error')}</TabsTrigger>
          </TabsList>
          <TabsContent value="ready">
            <DetailList
              items={[
                { label: t('status'), value: t('ui_temporary_only') },
                {
                  label: t('ui_component_source'),
                  value: <code>src/components/patterns/page-patterns.tsx</code>,
                },
              ]}
            />
          </TabsContent>
          <TabsContent value="loading">
            <ListSkeleton />
          </TabsContent>
          <TabsContent value="empty">
            <EmptyState
              icon={<FolderOpen className="size-6" />}
              title={t('your_first_project_starts_here')}
              description={t('a_name_and_an_idea_are_a_good_place_to_begin')}
            />
          </TabsContent>
          <TabsContent value="error">
            <div className="space-y-4">
              <ErrorNotice>{t('ui_simulated_error')}</ErrorNotice>
              <Button variant="outline" onClick={() => setState('ready')}>
                {t('retry')}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </section>
      <section aria-labelledby="settings-pattern-title">
        <p className="mb-2 font-mono text-xs text-primary">03 / PREFERENCES</p>
        <h2 id="settings-pattern-title" className="mb-6 text-xl font-semibold">
          {t('ui_settings_pattern')}
        </h2>
        <SettingsSection
          id="preview-settings-title"
          title={t('ui_preview_options')}
          description={t('ui_temporary_only')}
        >
          <div className="grid gap-5">
            <Label className="flex min-h-11 items-center justify-between gap-4">
              <span>
                {t('ui_switch_label')}
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  {t('ui_temporary_only')}
                </span>
              </span>
              <Switch defaultChecked />
            </Label>
            <Label className="flex min-h-11 items-center gap-3">
              <Checkbox />
              {t('ui_checkbox_label')}
            </Label>
          </div>
        </SettingsSection>
      </section>
      <Dialog
        open={detail !== null}
        onOpenChange={(open) => {
          if (!open) setDetail(null)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t('ui_sample_record')} {String(detail).padStart(2, '0')}
            </DialogTitle>
            <DialogDescription>{t('ui_temporary_only')}</DialogDescription>
          </DialogHeader>
          <DetailList
            items={[
              { label: t('status'), value: <Badge>{t('idea')}</Badge> },
              { label: t('a_short_description'), value: t('ui_detail_description') },
            ]}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function DesignExamples() {
  const { t } = useI18n()
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">{t('ui_design_title')}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
          {t('ui_design_description')}
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-6 sm:p-8">
          <p className="mb-10 flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <SlidersHorizontal className="size-4" />
            {t('ui_workspace_direction')}
          </p>
          <h3 className="text-2xl font-semibold tracking-tight">{t('ui_workspace_headline')}</h3>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">{t('ui_workspace_copy')}</p>
          <div className="mt-8 divide-y border-y">
            {['ui_list_pattern', 'ui_settings_pattern', 'ui_state_pattern'].map((key, i) => (
              <div key={key} className="flex items-center justify-between gap-4 py-4">
                <span className="text-sm">{t(key as 'ui_list_pattern')}</span>
                <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
              </div>
            ))}
          </div>
          <p className="mt-5 text-xs text-muted-foreground">{t('ui_direction_note')}</p>
        </section>
        <section className="relative overflow-hidden rounded-xl border bg-secondary/40 p-6 sm:p-8">
          <Palette
            className="absolute -right-6 -top-6 size-40 rotate-12 text-primary/5"
            strokeWidth={1}
          />
          <p className="relative mb-10 text-xs font-medium tracking-widest text-primary">
            {t('ui_editorial_direction')}
          </p>
          <h3 className="relative max-w-xs font-serif text-4xl leading-tight tracking-tight sm:text-5xl">
            {t('ui_editorial_headline')}
          </h3>
          <p className="relative mt-6 max-w-xs text-sm leading-7 text-muted-foreground">
            {t('ui_editorial_copy')}
          </p>
          <div className="relative mt-10 flex items-center gap-3 border-t pt-5 text-sm font-medium">
            {t('ui_shared_foundation')}
            <ArrowUpRight className="size-4" />
          </div>
          <p className="mt-3 text-xs leading-6 text-muted-foreground">{t('ui_direction_note')}</p>
        </section>
      </div>
      <section className="grid gap-6 rounded-xl border bg-card p-6 sm:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold">{t('ui_semantic_colors')}</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {t('ui_semantic_description')}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {['primary', 'accent', 'muted', 'destructive'].map((name) => (
              <div key={name} className="text-center">
                <div
                  className={`mb-2 size-10 rounded-lg border ${name === 'primary' ? 'bg-primary' : name === 'accent' ? 'bg-accent' : name === 'muted' ? 'bg-muted' : 'bg-destructive'}`}
                />
                <code className="text-[10px] text-muted-foreground">{name}</code>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold">{t('ui_design_handoff')}</h3>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            {t('ui_design_handoff_description')}
          </p>
          <p className="mt-4 break-words font-mono text-xs text-primary">
            PROJECT.md → docs/FRONTEND.md → src/components/patterns/
          </p>
        </div>
      </section>
      <MotionExamples />
    </div>
  )
}
