import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Image, RefreshCw, Trash2, Upload, Check } from 'lucide-react'
import { api } from '@/lib/api'
import { uploadImage } from '@/lib/file-upload'
import { type FileAsset, fileContentPath, fileLimits } from '@/modules/files/policy'
import { useI18n } from '@/components/providers'
import { ErrorNotice, Loading } from '@/components/common'
import { EmptyState } from '@/components/patterns/page-patterns'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

export function AssetPreview({ id, alt }: { id: string; alt: string }) {
  const { t } = useI18n(),
    [failed, setFailed] = useState(false)
  return failed ? (
    <p role="status" className="p-4 text-xs text-muted-foreground">
      {t('files_preview_unavailable')}
    </p>
  ) : (
    <img
      src={fileContentPath(id)}
      alt={alt}
      className="h-full w-full object-cover"
      onError={() => setFailed(true)}
    />
  )
}
export function FileLibrary({
  userId,
  onSelect,
  selected,
}: {
  userId: string
  onSelect?: (id: string) => void
  selected?: string | null
}) {
  const { t } = useI18n(),
    cache = useQueryClient(),
    input = useRef<HTMLInputElement>(null)
  const [deleting, setDeleting] = useState<FileAsset | null>(null)
  const files = useQuery({
    queryKey: ['files', userId],
    queryFn: () =>
      api<{ configured: boolean; files: FileAsset[]; limits: typeof fileLimits }>('/api/files'),
  })
  const refresh = () => cache.invalidateQueries({ queryKey: ['files', userId] })
  const upload = useMutation({
    mutationFn: (file: File) => uploadImage(file),
    onSettled: () => {
      if (input.current) input.current.value = ''
      void refresh()
    },
  })
  const action = useMutation({
    mutationFn: ({ id, remove }: { id: string; remove: boolean }) =>
      api('/api/files/' + id + (remove ? '' : '/reconcile'), {
        method: remove ? 'DELETE' : 'POST',
      }),
    onSuccess: () => {
      setDeleting(null)
      void refresh()
    },
    onError: () => {
      void refresh()
    },
  })
  const total = files.data?.files.reduce((sum, file) => sum + file.size, 0) ?? 0
  return (
    <div className="min-w-0 space-y-5">
      <p className="text-sm leading-7 text-muted-foreground">{t('files_private_notice')}</p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid min-w-0 flex-1 gap-2">
          <Label htmlFor={onSelect ? 'picker-upload' : 'library-upload'}>{t('files_upload')}</Label>
          <Input
            ref={input}
            id={onSelect ? 'picker-upload' : 'library-upload'}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={!files.data?.configured || upload.isPending}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) {
                action.reset()
                upload.mutate(file)
              }
            }}
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          aria-label={t('refresh')}
          disabled={files.isFetching}
          onClick={() => {
            void files.refetch()
          }}
        >
          <RefreshCw />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {t('files_limits', {
          count: files.data?.files.length ?? 0,
          max: fileLimits.maxFiles,
          used: (total / 1024 / 1024).toFixed(1),
        })}
      </p>
      {upload.isPending && (
        <p role="status" className="flex items-center gap-2 text-sm">
          <Upload className="size-4" />
          {t('files_uploading')}
        </p>
      )}
      {upload.error && <ErrorNotice>{upload.error.message}</ErrorNotice>}
      {action.error && <ErrorNotice>{action.error.message}</ErrorNotice>}
      {files.isPending ? (
        <Loading />
      ) : files.error ? (
        <ErrorNotice>{files.error.message}</ErrorNotice>
      ) : (
        <>
          {!files.data.configured && <ErrorNotice>{t('files_unavailable')}</ErrorNotice>}
          {files.data.files.length ? (
            <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {files.data.files.map((file) => (
                <article
                  key={file.id}
                  className="min-w-0 overflow-hidden rounded-xl border bg-card"
                >
                  <div className="flex aspect-[4/3] items-center justify-center overflow-hidden border-b bg-muted/40">
                    {file.state === 'ready' ? (
                      <AssetPreview id={file.id} alt={file.name} />
                    ) : (
                      <Image className="size-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="space-y-3 p-4">
                    <p className="break-words text-sm font-medium">{file.name}</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">
                        {file.type.replace('image/', '').toUpperCase()}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {Math.ceil(file.size / 1024)} KB
                      </span>
                      {file.references > 0 && (
                        <Badge variant="secondary">{t('files_in_use')}</Badge>
                      )}
                    </div>
                    {file.state !== 'ready' && (
                      <p className="text-xs leading-6 text-muted-foreground">
                        {file.state === 'pending' ? t('files_pending') : t('files_deleting')}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {file.state === 'ready' && (
                        <a
                          href={fileContentPath(file.id)}
                          download={file.name}
                          className={buttonVariants({ variant: 'outline' })}
                        >
                          {t('files_download')}
                        </a>
                      )}
                      {onSelect && file.state === 'ready' && (
                        <Button
                          variant={selected === file.id ? 'secondary' : 'default'}
                          disabled={action.isPending || upload.isPending}
                          onClick={() => onSelect(file.id)}
                        >
                          <Check />
                          {t('files_choose')}
                        </Button>
                      )}
                      {file.state === 'pending' ? (
                        <Button
                          variant="outline"
                          disabled={action.isPending || !files.data.configured}
                          onClick={() => action.mutate({ id: file.id, remove: false })}
                        >
                          <RefreshCw />
                          {t('files_reconcile')}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          disabled={
                            file.references > 0 || action.isPending || !files.data.configured
                          }
                          aria-label={t('files_delete_named', { name: file.name })}
                          onClick={() => {
                            action.reset()
                            setDeleting(file)
                          }}
                        >
                          <Trash2 />
                          {t('files_delete')}
                        </Button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Image />}
              title={t('files_empty')}
              description={t('files_empty_body')}
            />
          )}
        </>
      )}
      <Dialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!action.isPending && !open) setDeleting(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('files_delete_confirm')}</DialogTitle>
            <DialogDescription>{t('files_delete_body')}</DialogDescription>
          </DialogHeader>
          <p className="break-words text-sm">{deleting?.name}</p>
          {action.error && <ErrorNotice>{action.error.message}</ErrorNotice>}
          <DialogFooter>
            <Button variant="outline" disabled={action.isPending} onClick={() => setDeleting(null)}>
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={action.isPending}
              onClick={() => {
                if (deleting) action.mutate({ id: deleting.id, remove: true })
              }}
            >
              {t('files_confirm_delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export function FilePicker({
  userId,
  value,
  onChange,
  disabled = false,
}: {
  userId: string
  value: string | null
  onChange: (id: string | null) => void
  disabled?: boolean
}) {
  const { t } = useI18n(),
    [open, setOpen] = useState(false)
  return (
    <div className="grid gap-3">
      {value && (
        <div className="aspect-[4/3] w-40 overflow-hidden rounded-lg border bg-muted">
          <AssetPreview key={value} id={value} alt={t('files_selected')} />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={disabled} onClick={() => setOpen(true)}>
          <Image />
          {t('files_pick')}
        </Button>
        {value && (
          <Button variant="ghost" disabled={disabled} onClick={() => onChange(null)}>
            {t('files_detach')}
          </Button>
        )}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{t('files_pick')}</DialogTitle>
            <DialogDescription>{t('files_picker_notice')}</DialogDescription>
          </DialogHeader>
          <FileLibrary
            userId={userId}
            selected={value}
            onSelect={(id) => {
              onChange(id)
              setOpen(false)
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
