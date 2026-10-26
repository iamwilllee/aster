import { features } from '@/config/features'
import { AvatarSettings } from '@/components/avatar-settings'
import { formText } from '@/lib/forms'
import { createFileRoute, getRouteApi, useRouter } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import type { FormEvent } from 'react'
import { CheckCircle2, ShieldCheck } from 'lucide-react'
import { AccountSecuritySettings } from '@/components/account-security'
import { AccountLifecycleSettings } from '@/components/account-lifecycle'
import { PageHeading, ErrorNotice } from '@/components/common'
import { useI18n } from '@/components/providers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { SettingsSection } from '@/components/patterns/page-patterns'

export const Route = createFileRoute('/app/settings')({ component: Settings })
function Settings() {
  const viewer = getRouteApi('/app').useLoaderData()
  const { t } = useI18n()
  const router = useRouter()
  const save = useMutation({
    mutationFn: (name: string) => api('/api/profile', { method: 'PATCH', data: { name } }),
    onSuccess: async () => {
      await router.invalidate()
    },
  })
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    save.mutate(formText(new FormData(event.currentTarget), 'name'))
  }
  return (
    <>
      <PageHeading
        eyebrow="ACCOUNT SETTINGS"
        title={t('account_settings')}
        description={t('manage_your_profile_and_account_security')}
      />
      <SettingsSection
        id="profile-settings"
        title={t('profile')}
        description={t('these_details_belong_to_your_workspace')}
      >
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-2">
            <Label htmlFor="profile-name">{t('your_name')}</Label>
            <Input
              id="profile-name"
              name="name"
              defaultValue={viewer.user.name}
              maxLength={60}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-email">{t('email_address')}</Label>
            <Input id="profile-email" value={viewer.user.email} readOnly disabled />
            <p className="flex items-center gap-1.5 text-[11px] text-primary">
              <ShieldCheck size={13} />
              {t('verified_email_changes_are_not_available_in_v0_1')}
            </p>
          </div>
          {save.error && <ErrorNotice>{save.error.message}</ErrorNotice>}
          {save.isSuccess && (
            <p role="status" className="flex items-center gap-2 text-xs text-primary">
              <CheckCircle2 size={15} />
              {t('profile_saved')}
            </p>
          )}
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? t('saving') : t('save_changes')}
          </Button>
        </form>
      </SettingsSection>
      {features.files && (
        <SettingsSection
          id="avatar-settings"
          title={t('files_avatar')}
          description={t('files_avatar_body')}
        >
          <AvatarSettings userId={viewer.user.id} image={viewer.user.image} />
        </SettingsSection>
      )}
      <AccountSecuritySettings userId={viewer.user.id} mailReady={viewer.mailReady} />
      <AccountLifecycleSettings userId={viewer.user.id} />
    </>
  )
}
