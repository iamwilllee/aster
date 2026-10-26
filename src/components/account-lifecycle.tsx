import { useState, type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Trash2 } from 'lucide-react'
import { features } from '@/config/features'
import { useI18n } from '@/components/providers'
import { ErrorNotice } from '@/components/common'
import { SettingsSection } from '@/components/patterns/page-patterns'
import { Button, buttonVariants } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { authClient } from '@/modules/auth/auth-client'
import { localizePath } from '@/i18n/core'
import type {
  AccountExport,
  AccountLifecycle,
  BillingDeletionStatus,
} from '@/modules/auth/lifecycle'

export function AccountLifecycleSettings({ userId }: { userId: string }) {
  const { t, locale } = useI18n()
  const cache = useQueryClient()
  const lifecycle = useQuery({
    queryKey: ['account-lifecycle', userId],
    queryFn: () => api<AccountLifecycle>('/api/account/lifecycle'),
  })
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [exported, setExported] = useState(false)
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [retainSiteContent, setRetainSiteContent] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [relogging, setRelogging] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [closeDialog, setCloseDialog] = useState(false)
  const billingState =
    lifecycle.data?.billing?.state ?? (lifecycle.data?.billingBlocked ? 'unchecked' : 'none')
  async function review(closing = false) {
    setReviewing(true)
    setDeleteError('')
    try {
      const billing = await api<BillingDeletionStatus>(
        closing ? '/api/account/close-checkouts' : '/api/account/billing-review',
        {
          method: 'POST',
          ...(closing ? { data: { confirmation: 'CLOSE' } } : {}),
        },
      )
      cache.setQueryData<AccountLifecycle>(['account-lifecycle', userId], (previous) =>
        previous
          ? { ...previous, billing, billingBlocked: !['none', 'ready'].includes(billing.state) }
          : previous,
      )
      setCloseDialog(false)
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : t('error_request_failed'))
    } finally {
      setReviewing(false)
    }
  }
  async function download() {
    setExporting(true)
    setExportError('')
    setExported(false)
    try {
      // Keep personal data out of the shared query cache and persist only the user-requested download.
      const data = await api<AccountExport>('/api/account/export', { method: 'POST' })
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      )
      const link = document.createElement('a')
      link.href = url
      link.download = 'account-data.json'
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setExported(true)
    } catch (error) {
      setExportError(error instanceof Error ? error.message : t('error_request_failed'))
    } finally {
      setExporting(false)
    }
  }
  async function remove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setDeleteError('')
    setDeleting(true)
    try {
      await api('/api/account/delete', {
        method: 'POST',
        data: {
          confirmation: data.get('confirmation'),
          retainSiteContent,
          ...(lifecycle.data?.verification === 'password'
            ? { currentPassword: data.get('currentPassword') }
            : {}),
        },
      })
      form.reset()
      setDeleted(true)
      setOpen(false)
      cache.clear()
      // A full navigation discards router loaders and in-memory authentication state.
      window.location.assign(localizePath('/login', locale) + '?deleted=1')
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : t('error_request_failed'))
      void lifecycle.refetch()
    } finally {
      setDeleting(false)
    }
  }
  async function relogin() {
    setRelogging(true)
    setDeleteError('')
    try {
      const result = await authClient.signOut()
      if (result.error) throw new Error(t('error_request_failed'))
      cache.clear()
      window.location.assign(localizePath('/login', locale))
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : t('error_request_failed'))
      setRelogging(false)
    }
  }
  return (
    <>
      <SettingsSection
        id="data-export-settings"
        title={t('export_account_data')}
        description={t('export_account_description')}
      >
        <div className="space-y-4">
          <p className="text-sm leading-6 text-muted-foreground">{t('export_scope_notice')}</p>
          <Button
            variant="outline"
            disabled={exporting || deleting || deleted}
            onClick={() => {
              void download()
            }}
          >
            <Download data-icon="inline-start" />
            {exporting ? t('preparing_export') : t('download_account_data')}
          </Button>
          {exportError && <ErrorNotice>{exportError}</ErrorNotice>}
          {exported && (
            <p role="status" className="text-sm text-primary">
              {t('export_download_started')}
            </p>
          )}
        </div>
      </SettingsSection>
      <SettingsSection
        id="account-deletion-settings"
        title={t('delete_account')}
        description={t('delete_account_description')}
      >
        <div className="space-y-4">
          {lifecycle.isPending ? (
            <Skeleton className="h-16 w-full" />
          ) : lifecycle.isError ? (
            <>
              <ErrorNotice>{lifecycle.error.message}</ErrorNotice>
              <Button
                variant="outline"
                disabled={lifecycle.isFetching}
                onClick={() => {
                  void lifecycle.refetch()
                }}
              >
                {t('retry')}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm leading-6 text-muted-foreground">
                {t('deletion_irreversible_notice')}
              </p>
              {billingState !== 'none' && (
                <div className="space-y-3">
                  <p role="status" className="text-sm leading-6 text-muted-foreground">
                    {t(
                      (
                        {
                          unchecked: 'billing_deletion_unchecked',
                          ready: 'billing_deletion_ready',
                          subscription: 'billing_deletion_subscription',
                          checkout:
                            lifecycle.data.billing?.canCloseCheckouts === false
                              ? 'billing_deletion_checkout_manual'
                              : 'billing_deletion_checkout',
                          invoice: 'billing_deletion_invoice',
                          unknown: 'billing_deletion_unknown',
                        } as const
                      )[billingState],
                    )}
                  </p>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {t('billing_deletion_retention')}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="outline"
                      disabled={reviewing || deleting || exporting}
                      onClick={() => {
                        void review()
                      }}
                    >
                      {reviewing ? t('billing_deletion_checking') : t('billing_deletion_check')}
                    </Button>
                    {lifecycle.data.billing?.canCloseCheckouts && (
                      <Button
                        variant="outline"
                        disabled={reviewing || deleting}
                        onClick={() => setCloseDialog(true)}
                      >
                        {t('billing_deletion_close_checkouts')}
                      </Button>
                    )}
                    {features.billing && (
                      <Link to="/app/billing" className={buttonVariants({ variant: 'outline' })}>
                        {t('review_billing_before_deletion')}
                      </Link>
                    )}
                  </div>
                </div>
              )}
              {lifecycle.data.billingBlocked ? null : lifecycle.data.verification ===
                'unavailable' ? (
                <p className="text-sm text-muted-foreground">{t('deletion_method_unavailable')}</p>
              ) : (
                <>
                  {lifecycle.data.verification === 'recent-login' && (
                    <p className="text-sm leading-6 text-muted-foreground">
                      {t('deletion_recent_login_notice')}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="destructive"
                      disabled={
                        deleting ||
                        exporting ||
                        deleted ||
                        reviewing ||
                        (lifecycle.data.verification === 'recent-login' &&
                          !lifecycle.data.recentLogin)
                      }
                      onClick={() => {
                        setDeleteError('')
                        setConfirmed(false)
                        setRetainSiteContent(false)
                        setOpen(true)
                      }}
                    >
                      <Trash2 data-icon="inline-start" />
                      {t('delete_account')}
                    </Button>
                    {lifecycle.data.verification === 'recent-login' && (
                      <Button
                        variant="outline"
                        disabled={relogging || deleting}
                        onClick={() => {
                          void relogin()
                        }}
                      >
                        {t('sign_in_again_to_confirm')}
                      </Button>
                    )}
                  </div>
                </>
              )}
            </>
          )}
          {lifecycle.data?.lastAdministrator && (
            <p role="note" className="text-sm leading-6 text-muted-foreground">
              {t('admin_last_delete')}
            </p>
          )}
          {deleteError && !open && <ErrorNotice>{deleteError}</ErrorNotice>}
        </div>
      </SettingsSection>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!deleting) {
            setOpen(value)
            setConfirmed(false)
            setRetainSiteContent(false)
          }
        }}
      >
        <DialogContent showCloseButton={!deleting}>
          <DialogHeader>
            <DialogTitle>{t('delete_account_confirmation')}</DialogTitle>
            <DialogDescription>{t('deletion_irreversible_notice')}</DialogDescription>
          </DialogHeader>
          {billingState === 'ready' && (
            <p className="text-sm leading-6 text-muted-foreground">
              {t('billing_deletion_retention')}
            </p>
          )}
          <form
            className="grid gap-5"
            onSubmit={(event) => {
              void remove(event)
            }}
          >
            {lifecycle.data?.verification === 'password' && (
              <div className="grid gap-2">
                <Label htmlFor="deletion-password">{t('current_password')}</Label>
                <Input
                  id="deletion-password"
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  required
                  maxLength={128}
                  disabled={deleting}
                />
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="deletion-confirmation">{t('type_delete_to_confirm')}</Label>
              <Input
                id="deletion-confirmation"
                name="confirmation"
                autoComplete="off"
                spellCheck={false}
                required
                pattern="DELETE"
                disabled={deleting}
                onChange={(event) => setConfirmed(event.target.value === 'DELETE')}
                aria-describedby="deletion-confirmation-help"
              />
              <p id="deletion-confirmation-help" className="text-xs text-muted-foreground">
                {t('export_before_deletion')}
              </p>
            </div>
            {!!lifecycle.data?.siteContributions && (
              <div className="flex items-start gap-3">
                <Checkbox
                  id="retain-site-content"
                  checked={retainSiteContent}
                  onCheckedChange={(checked) => setRetainSiteContent(checked === true)}
                  disabled={deleting}
                />
                <Label htmlFor="retain-site-content" className="text-sm leading-6">
                  {t('content_retention_ack')}
                </Label>
              </div>
            )}
            {deleteError && <ErrorNotice>{deleteError}</ErrorNotice>}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={deleting}
                onClick={() => setOpen(false)}
              >
                {t('cancel')}
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={
                  !confirmed ||
                  deleting ||
                  (!!lifecycle.data?.siteContributions && !retainSiteContent)
                }
              >
                {deleting ? t('deleting_account') : t('permanently_delete_account')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={closeDialog}
        onOpenChange={(value) => {
          if (!reviewing) setCloseDialog(value)
        }}
      >
        <DialogContent showCloseButton={!reviewing}>
          <DialogHeader>
            <DialogTitle>{t('billing_deletion_close_title')}</DialogTitle>
            <DialogDescription>{t('billing_deletion_close_description')}</DialogDescription>
          </DialogHeader>
          {deleteError && <ErrorNotice>{deleteError}</ErrorNotice>}
          <DialogFooter>
            <Button variant="outline" disabled={reviewing} onClick={() => setCloseDialog(false)}>
              {t('cancel')}
            </Button>
            <Button
              disabled={reviewing}
              onClick={() => {
                void review(true)
              }}
            >
              {reviewing ? t('billing_deletion_checking') : t('billing_deletion_close_confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
