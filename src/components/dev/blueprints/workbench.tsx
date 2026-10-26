import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, ClipboardList, Plus, RotateCcw } from 'lucide-react'
import { useI18n } from '@/components/providers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table'
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
import { EmptyState, ListSkeleton } from '@/components/patterns/page-patterns'
import { ContentHeading } from '@/components/patterns/content-patterns'
import { ErrorNotice } from '@/components/common'

type Task = { id: string; name: string; notes: string; status: 'open' | 'review' | 'done' }
export function WorkbenchBlueprint() {
  const { t } = useI18n()
  const initial: Task[] = [
    { id: 'brief', name: t('bp_task_one'), notes: t('bp_task_one_notes'), status: 'done' },
    { id: 'content', name: t('bp_task_two'), notes: t('bp_task_two_notes'), status: 'review' },
    { id: 'launch', name: t('bp_task_three'), notes: t('bp_task_three_notes'), status: 'open' },
  ]
  const [tasks, setTasks] = useState<Task[]>(initial),
    [selected, setSelected] = useState('content'),
    [draft, setDraft] = useState(initial[1]!.notes),
    [notice, setNotice] = useState('')
  const [filter, setFilter] = useState('all'),
    [query, setQuery] = useState(''),
    [view, setView] = useState('ready')
  const [open, setOpen] = useState(false),
    [step, setStep] = useState(1),
    [name, setName] = useState(''),
    [notes, setNotes] = useState(''),
    [error, setError] = useState('')
  const statuses = {
    all: t('bp_all'),
    open: t('bp_task_open'),
    review: t('bp_task_review'),
    done: t('bp_task_done'),
  }
  const views = {
    ready: t('bp_view_ready'),
    loading: t('loading'),
    empty: t('bp_view_empty'),
    error: t('bp_view_error'),
  }
  const current = tasks.find((item) => item.id === selected)
  const completed = tasks.filter((item) => item.status === 'done').length
  const records = tasks.filter(
    (item) =>
      (filter === 'all' || item.status === filter) &&
      item.name.toLowerCase().includes(query.trim().toLowerCase()),
  )
  const detailHeading = useRef<HTMLHeadingElement>(null),
    moved = useRef(false)
  useEffect(() => {
    if (moved.current) detailHeading.current?.focus()
    moved.current = true
  }, [selected])
  function choose(task: Task) {
    setSelected(task.id)
    setDraft(task.notes)
    setNotice('')
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim() || (step === 2 && !notes.trim())) {
      setError(t('bp_required'))
      return
    }
    setError('')
    if (step === 1) {
      setStep(2)
      return
    }
    const task: Task = {
      id: crypto.randomUUID(),
      name: name.trim(),
      notes: notes.trim(),
      status: 'open',
    }
    setTasks((items) => [...items, task])
    choose(task)
    setOpen(false)
    setFilter('all')
    setQuery('')
    setNotice(t('bp_task_created'))
  }
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b px-6 py-5">
        <span className="flex items-center gap-2 font-semibold">
          <ClipboardList className="size-5 text-primary" /> Launchpad{' '}
          <Badge variant="outline">{t('bp_fictional')}</Badge>
        </span>
        <Button
          onClick={() => {
            setStep(1)
            setName('')
            setNotes('')
            setError('')
            setOpen(true)
          }}
        >
          <Plus />
          {t('bp_new_task')}
        </Button>
      </header>
      <div className="border-b p-6">
        <div className="grid items-end gap-6 lg:grid-cols-[1.5fr_1fr]">
          <ContentHeading
            eyebrow={t('bp_workbench_kicker')}
            title={t('bp_workbench_headline')}
            description={t('bp_workbench_body')}
          />
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="mb-3 flex justify-between gap-3 text-sm">
              <span>{t('bp_sample_progress')}</span>
              <span className="font-mono">
                {completed} / {tasks.length}
              </span>
            </div>
            <Progress value={completed} max={tasks.length} label={t('bp_sample_progress')} />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3 border-b p-6">
        <div className="grid min-w-0 flex-1 basis-48 gap-2">
          <Label htmlFor="task-search">{t('bp_search_tasks')}</Label>
          <Input id="task-search" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="grid w-full gap-2 sm:w-40">
          <Label htmlFor="task-filter">{t('status')}</Label>
          <Select
            value={filter}
            onValueChange={(value) => setFilter(value ?? 'all')}
            items={statuses}
          >
            <SelectTrigger id="task-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(statuses).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid w-full gap-2 sm:w-44">
          <Label htmlFor="task-view">{t('bp_preview_state')}</Label>
          <Select value={view} onValueChange={(value) => setView(value ?? 'ready')} items={views}>
            <SelectTrigger id="task-view">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(views).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {view === 'loading' ? (
        <div className="p-6">
          <ListSkeleton />
        </div>
      ) : view === 'error' ? (
        <div className="space-y-4 p-6">
          <ErrorNotice>{t('bp_simulated_error')}</ErrorNotice>
          <Button variant="outline" onClick={() => setView('ready')}>
            <RotateCcw />
            {t('retry')}
          </Button>
        </div>
      ) : view === 'empty' || !records.length ? (
        <div className="p-6">
          <EmptyState
            icon={<ClipboardList />}
            title={t('bp_no_tasks')}
            description={t('bp_no_tasks_body')}
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setView('ready')
                  setFilter('all')
                  setQuery('')
                }}
              >
                {t('bp_clear_filters')}
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid min-w-0 lg:grid-cols-[minmax(0,1.3fr)_minmax(16rem,1fr)]">
          <div className="min-w-0 overflow-x-auto p-6">
            <Table>
              <caption className="mb-4 text-left text-xs text-muted-foreground">
                {t('bp_task_table_caption')}
              </caption>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('bp_task_name')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((task) => (
                  <TableRow key={task.id} className={selected === task.id ? 'bg-accent/60' : ''}>
                    <TableCell className="max-w-72">
                      <Button
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => choose(task)}
                        aria-label={t('bp_open_task', { name: task.name })}
                      >
                        <span className="truncate">{task.name}</span>
                        <ArrowRight />
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Badge variant={task.status === 'done' ? 'secondary' : 'outline'}>
                        {statuses[task.status]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {current && (
            <section
              className="min-w-0 border-t bg-muted/20 p-6 lg:border-l lg:border-t-0"
              aria-labelledby="task-detail-title"
            >
              <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">
                {t('bp_task_detail')}
              </p>
              <h3
                ref={detailHeading}
                tabIndex={-1}
                id="task-detail-title"
                className="break-words text-xl font-semibold outline-none"
              >
                {current.name}
              </h3>
              <div className="mt-6 grid gap-5">
                <div className="grid gap-2">
                  <Label htmlFor="task-status">{t('status')}</Label>
                  <Select
                    value={current.status}
                    onValueChange={(value) => {
                      if (value === 'open' || value === 'review' || value === 'done') {
                        setTasks((items) =>
                          items.map((item) =>
                            item.id === current.id ? { ...item, status: value } : item,
                          ),
                        )
                        setNotice(t('bp_changes_preview'))
                      }
                    }}
                    items={statuses}
                  >
                    <SelectTrigger id="task-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(['open', 'review', 'done'] as const).map((value) => (
                        <SelectItem key={value} value={value}>
                          {statuses[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="task-notes">{t('bp_task_notes')}</Label>
                  <Textarea
                    id="task-notes"
                    value={draft}
                    maxLength={600}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  className="justify-self-start"
                  onClick={() => {
                    setTasks((items) =>
                      items.map((item) =>
                        item.id === current.id ? { ...item, notes: draft } : item,
                      ),
                    )
                    setNotice(t('bp_changes_preview'))
                  }}
                >
                  {t('bp_save_notes')}
                </Button>
              </div>
              <p role="status" className="mt-4 text-xs leading-6 text-muted-foreground">
                {notice || t('bp_local_edits')}
              </p>
            </section>
          )}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('bp_new_task')}</DialogTitle>
            <DialogDescription>
              {t('bp_step_count', { step })} · {t('bp_local_edits')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-4">
            {step === 1 ? (
              <div className="grid gap-2">
                <Label htmlFor="new-task-name">{t('bp_task_name')}</Label>
                <Input
                  id="new-task-name"
                  required
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            ) : (
              <div className="grid gap-2">
                <p className="break-words text-sm font-medium">{name}</p>
                <Label htmlFor="new-task-notes">{t('bp_task_notes')}</Label>
                <Textarea
                  id="new-task-notes"
                  required
                  maxLength={600}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            )}
            {error && <ErrorNotice>{error}</ErrorNotice>}
            <DialogFooter>
              {step === 2 && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep(1)
                    setError('')
                  }}
                >
                  <ArrowLeft />
                  {t('bp_back_step')}
                </Button>
              )}
              <Button type="submit">
                {step === 1 ? t('bp_next_step') : t('bp_create_preview')}
                <ArrowRight />
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
