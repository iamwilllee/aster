import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { FilePicker } from './file-library'
import { ErrorNotice } from './common'
import { useI18n } from './providers'
import { api } from '@/lib/api'
export function AvatarSettings({ userId, image }: { userId: string; image: string | null }) {
  const router = useRouter(),
    cache = useQueryClient(),
    { t } = useI18n()
  const id = /^\/api\/files\/([a-f0-9-]{36})\/content$/.exec(image ?? '')?.[1] ?? null
  const save = useMutation({
    mutationFn: (assetId: string | null) =>
      api('/api/files/avatar', { method: 'POST', data: { assetId } }),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ['files', userId] })
      await router.invalidate()
    },
  })
  return (
    <div className="space-y-3">
      <FilePicker
        userId={userId}
        value={id}
        disabled={save.isPending}
        onChange={(assetId) => save.mutate(assetId)}
      />
      {save.error && <ErrorNotice>{save.error.message}</ErrorNotice>}
      {save.isSuccess && (
        <p role="status" className="text-xs text-primary">
          {t('files_avatar_saved')}
        </p>
      )}
    </div>
  )
}
