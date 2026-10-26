import { useState, type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Monitor, Smartphone } from 'lucide-react'
import { useI18n } from '@/components/providers'
import { ErrorNotice } from '@/components/common'
import { SettingsSection } from '@/components/patterns/page-patterns'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { api } from '@/lib/api'
import type { AccountSecurity, AccountSession } from '@/modules/auth/security'

export function AccountSecuritySettings({
  userId,
  mailReady,
}: {
  userId: string
  mailReady: boolean
}) {
  const { t, locale } = useI18n()
  const cache = useQueryClient()
  const key = ['account-security', userId]
  const security = useQuery({
    queryKey: key,
    queryFn: () => api<AccountSecurity>('/api/account/security'),
  })
  const [passwordPending, setPasswordPending] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [selection, setSelection] = useState<AccountSession | 'others' | null>(null)
  const [revoked, setRevoked] = useState(false)
  const revoke = useMutation({
    mutationFn: (target: AccountSession | 'others') =>
      api(
        target === 'others'
          ? '/api/account/sessions/revoke-others'
          : `/api/account/sessions/${target.id}`,
        { method: target === 'others' ? 'POST' : 'DELETE' },
      ),
    onSuccess: async () => {
      setSelection(null)
      setRevoked(true)
      await cache.invalidateQueries({ queryKey: key })
    },
  })
  function choose(target: AccountSession | 'others') {
    revoke.reset()
    setRevoked(false)
    setSelection(target)
  }
  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setPasswordError('')
    setPasswordSaved(false)
    if (data.get('newPassword') !== data.get('confirmPassword')) {
      setPasswordError(t('password_confirmation_mismatch'))
      return
    }
    setPasswordPending(true)
    try {
      await api('/api/account/password', {
        method: 'POST',
        data: {
          currentPassword: data.get('currentPassword'),
          newPassword: data.get('newPassword'),
        },
      })
      form.reset()
      setPasswordSaved(true)
      await cache.invalidateQueries({ queryKey: key })
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : t('error_request_failed'))
    } finally {
      setPasswordPending(false)
    }
  }
  function date(value: number) {
    return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(value)
  }
  function device(session: AccountSession) {
    const browsers = {
      edge: 'Edge',
      opera: 'Opera',
      chrome: 'Chrome',
      firefox: 'Firefox',
      safari: 'Safari',
      unknown: t('unknown_browser'),
    }
    const platforms = {
      android: 'Android',
      ios: 'iOS',
      windows: 'Windows',
      macos: 'macOS',
      linux: 'Linux',
      unknown: t('unknown_device'),
    }
    return `${browsers[session.browser]} · ${platforms[session.platform]}`
  }
  return (
    <>
      <SettingsSection
        id="security-settings"
        title={t('password_security')}
        description={t('account_password_description')}
      >
        {security.isPending ? (
          <div role="status" aria-label={t('loading_account_security')}>
            <Skeleton className="h-6 w-48" />
          </div>
        ) : security.isError ? (
          <ErrorNotice>{security.error.message}</ErrorNotice>
        ) : security.data.canChangePassword ? (
          <form
            onSubmit={(event) => {
              void changePassword(event)
            }}
            className="grid max-w-md gap-5"
          >
            <div className="grid gap-2">
              <Label htmlFor="current-password">{t('current_password')}</Label>
              <Input
                id="current-password"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
                maxLength={128}
                disabled={passwordPending}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-password">{t('new_password')}</Label>
              <Input
                id="new-password"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
                disabled={passwordPending}
                aria-describedby="password-guidance"
              />
              <p id="password-guidance" className="text-xs leading-5 text-muted-foreground">
                {t('use_a_unique_password_of_at_least_12_characters')}
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm-new-password">{t('confirm_new_password')}</Label>
              <Input
                id="confirm-new-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
                disabled={passwordPending}
              />
            </div>
            {passwordError && <ErrorNotice>{passwordError}</ErrorNotice>}
            {passwordSaved && (
              <p role="status" className="text-sm text-primary">
                {t('password_changed_other_sessions_ended')}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={passwordPending}>
                {passwordPending ? t('saving') : t('change_password')}
              </Button>
              {mailReady && (
                <Link to="/forgot-password" className={buttonVariants({ variant: 'link' })}>
                  {t('forgot_password')}
                </Link>
              )}
            </div>
          </form>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">
            {t('password_login_not_available')}
          </p>
        )}
      </SettingsSection>
      <SettingsSection
        id="session-settings"
        title={t('signed_in_devices')}
        description={t('session_devices_description')}
      >
        <div className="space-y-5">
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => {
                void security.refetch()
              }}
              disabled={security.isFetching || passwordPending || revoke.isPending}
            >
              {t('refresh_devices')}
            </Button>
            <Button
              variant="outline"
              onClick={() => choose('others')}
              disabled={
                !security.data ||
                security.data.sessions.every((session) => session.current) ||
                passwordPending ||
                revoke.isPending
              }
            >
              {t('sign_out_other_devices')}
            </Button>
          </div>
          {security.isPending ? (
            <div role="status" aria-label={t('loading_account_security')} className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : security.isError ? (
            <ErrorNotice>{security.error.message}</ErrorNotice>
          ) : !security.data.sessions.length ? (
            <p className="text-sm text-muted-foreground">{t('no_active_sessions')}</p>
          ) : (
            <ul className="divide-y rounded-xl border bg-card px-4">
              {security.data.sessions.map((session) => (
                <li
                  key={session.id}
                  className="flex flex-wrap items-start justify-between gap-4 py-5"
                >
                  <div className="flex min-w-0 gap-3">
                    {['android', 'ios'].includes(session.platform) ? (
                      <Smartphone
                        aria-hidden
                        className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                      />
                    ) : (
                      <Monitor
                        aria-hidden
                        className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                      />
                    )}
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="break-words text-sm font-medium">{device(session)}</p>
                        {session.current && (
                          <Badge variant="secondary">{t('current_device')}</Badge>
                        )}
                      </div>
                      <p className="text-xs leading-5 text-muted-foreground">
                        {t('session_created')}{' '}
                        <time dateTime={new Date(session.createdAt).toISOString()}>
                          {date(session.createdAt)}
                        </time>
                      </p>
                      <p className="text-xs leading-5 text-muted-foreground">
                        {t('session_updated')}{' '}
                        <time dateTime={new Date(session.updatedAt).toISOString()}>
                          {date(session.updatedAt)}
                        </time>
                      </p>
                    </div>
                  </div>
                  {!session.current && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={passwordPending || revoke.isPending}
                      onClick={() => choose(session)}
                      aria-label={t('sign_out_device', { device: device(session) })}
                    >
                      {t('sign_out')}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {security.data?.hasMore && (
            <p className="text-xs text-muted-foreground">{t('more_sessions_available')}</p>
          )}
          {revoked && (
            <p role="status" className="text-sm text-primary">
              {t('sessions_ended')}
            </p>
          )}
        </div>
      </SettingsSection>
      <Dialog
        open={selection !== null}
        onOpenChange={(open) => {
          if (!open && !revoke.isPending) setSelection(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selection === 'others' ? t('confirm_sign_out_others') : t('confirm_sign_out_device')}
            </DialogTitle>
            <DialogDescription>
              {selection && selection !== 'others' && (
                <span className="mb-2 block font-medium text-foreground">{device(selection)}</span>
              )}
              {t('session_revocation_description')}
            </DialogDescription>
          </DialogHeader>
          {revoke.error && <ErrorNotice>{revoke.error.message}</ErrorNotice>}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={revoke.isPending}
              onClick={() => setSelection(null)}
            >
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={!selection || revoke.isPending}
              onClick={() => {
                if (selection) revoke.mutate(selection)
              }}
            >
              {revoke.isPending ? t('please_wait') : t('confirm_sign_out')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
