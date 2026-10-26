import { formText } from '@/lib/forms'
import { useState, type FormEvent } from 'react'
import { Link, useRouter } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, CheckCircle2, Mail, ShieldCheck } from 'lucide-react'
import { authClient } from '@/modules/auth/auth-client'
import { Logo, Preferences, ErrorNotice } from './common'
import { VerificationResend } from './verification-resend'
import { localizePath } from '@/i18n/core'
import { authError } from '@/i18n/auth-errors'
import { site } from '@/config/site'
import { useI18n } from './providers'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'

export function AuthForm({
  mode,
  local,
  token,
  verified,
  googleReady = false,
  emailPasswordEnabled = true,
  mailReady = true,
  oauthError = false,
  deleted = false,
}: {
  mode: 'login' | 'signup' | 'forgot' | 'reset'
  local: boolean
  token?: string
  verified?: boolean
  emailPasswordEnabled?: boolean
  googleReady?: boolean
  mailReady?: boolean
  oauthError?: boolean
  deleted?: boolean
}) {
  const { t, locale } = useI18n()
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [pending, setPending] = useState(false)
  const [emailAddress, setEmailAddress] = useState('')
  const router = useRouter()
  const title = {
    login: t('welcome_back'),
    signup: t('make_your_next_beginning'),
    forgot: t('reset_your_password'),
    reset: t('choose_a_new_password'),
  }[mode]
  const subtitle = {
    login: t('sign_in_and_pick_up_where_you_left_off'),
    signup: t('one_account_a_workspace_of_your_own'),
    forgot: t('we_will_send_a_reset_link_if_your_account_exists'),
    reset: t('use_a_unique_password_of_at_least_12_characters'),
  }[mode]
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setPending(true)
    const form = new FormData(event.currentTarget)
    const email = formText(form, 'email').trim()
    setEmailAddress(email)
    const password = formText(form, 'password')
    try {
      const result =
        mode === 'login'
          ? await authClient.signIn.email({ email, password })
          : mode === 'signup'
            ? await authClient.signUp.email({
                email,
                password,
                name: formText(form, 'name').trim(),
                callbackURL: localizePath('/login', locale) + '?verified=1',
              })
            : mode === 'forgot'
              ? await authClient.requestPasswordReset({
                  email,
                  redirectTo: localizePath('/reset-password', locale),
                })
              : await authClient.resetPassword({ newPassword: password, token })
      if (result.error) {
        throw new Error(authError(result.error.code ?? '', locale))
      }
      if (mode === 'login') {
        await router.navigate({ to: '/app' })
        await router.invalidate()
      } else setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('network_error_please_try_again'))
    } finally {
      setPending(false)
    }
  }
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between px-6 py-6 sm:px-10">
        <Logo />
        <Preferences />
      </header>
      <main className="mx-auto grid min-h-[calc(100vh-100px)] max-w-5xl items-center gap-12 px-6 pb-16 pt-6 lg:grid-cols-2 lg:gap-24">
        <div className="hidden lg:block">
          <p className="mb-7 text-[10px] font-semibold tracking-[0.2em] text-primary">
            A GOOD PLACE TO START
          </p>
          <h2 className="text-5xl leading-tight font-semibold tracking-[-0.04em]">
            {t('every_good_product')}
            <br />
            {t('starts_somewhere')}
          </h2>
          <p className="mt-6 max-w-sm text-sm leading-8 text-muted-foreground">
            {t('make_the_repetitive_work_simpler_leave_more_room_for_the_ideas_that_matter')}
          </p>
          <div className="mt-10 flex items-center gap-3 text-xs text-muted-foreground">
            <ShieldCheck className="size-5 text-primary" />
            {t('your_account_your_data_your_code')}
          </div>
        </div>
        <section className="mx-auto w-full max-w-sm">
          <Link
            to="/"
            className="mb-8 inline-flex items-center gap-2 text-xs text-muted-foreground"
          >
            <ArrowLeft size={13} />
            {t('back_home')}
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mb-8 mt-3 text-sm leading-6 text-muted-foreground">{subtitle}</p>
          {mode === 'login' && deleted && (
            <p role="status" className="mb-5 text-sm text-primary">
              {t('account_deleted_notice')}
            </p>
          )}
          {!emailPasswordEnabled && !googleReady && (
            <p className="mb-5 text-sm text-muted-foreground">{t('sign_in_unavailable')}</p>
          )}
          {oauthError && (
            <div className="mb-5">
              <ErrorNotice>{t('google_error')}</ErrorNotice>
            </div>
          )}
          {!success && googleReady && (mode === 'login' || mode === 'signup') && (
            <div className="mb-6">
              <Button
                className="w-full"
                variant="outline"
                disabled={pending}
                onClick={async () => {
                  setPending(true)
                  setError('')
                  try {
                    const result = await authClient.signIn.social({
                      provider: 'google',
                      callbackURL: localizePath('/app', locale),
                      errorCallbackURL: localizePath('/login', locale) + '?oauthError=1',
                    })
                    if (result.error) throw new Error(t('google_error'))
                  } catch {
                    setError(t('google_error'))
                    setPending(false)
                  }
                }}
              >
                {t('google_continue')}
              </Button>
            </div>
          )}
          {emailPasswordEnabled && !mailReady && mode !== 'reset' && (
            <div className="mb-5">
              {local ? (
                <ErrorNotice>{t('mail_disabled')}</ErrorNotice>
              ) : (
                <p className="rounded-lg border bg-muted/50 p-3 text-sm leading-6 text-muted-foreground">
                  {t('email_access_unavailable')}
                </p>
              )}
            </div>
          )}
          {verified && !success && (
            <div className="mb-5 rounded-lg border border-primary/20 bg-accent p-3 text-xs text-primary">
              {t('email_verified_you_can_now_sign_in')}
            </div>
          )}
          {error && (
            <div className="mb-5">
              <ErrorNotice>{error}</ErrorNotice>
            </div>
          )}
          {success ? (
            <div role="status" className="space-y-5 rounded-xl border bg-card p-6">
              <CheckCircle2 className="size-8 text-primary" />
              <h2 className="font-medium">
                {mode === 'reset' ? t('password_updated') : t('check_your_inbox')}
              </h2>
              <p className="text-sm leading-7 text-muted-foreground">
                {mode === 'signup'
                  ? t('follow_the_verification_link_then_return_to_sign_in')
                  : mode === 'forgot'
                    ? t('if_this_email_is_registered_a_reset_link_has_been_sent')
                    : t('existing_sessions_were_revoked_sign_in_with_your_new_password')}
              </p>
              {local && mode !== 'reset' && (
                <Link
                  to="/dev/inbox"
                  className="inline-flex items-center gap-2 text-sm text-primary"
                >
                  <Mail size={15} />
                  {t('open_local_test_inbox')}
                </Link>
              )}
              <Link to="/login" className="block text-sm font-medium text-primary">
                {t('go_to_sign_in')} →
              </Link>
            </div>
          ) : !emailPasswordEnabled ? null : !mailReady &&
            (mode === 'signup' || mode === 'forgot') ? (
            <Link to="/login" className="text-sm font-medium text-primary">
              {t('go_to_sign_in')} →
            </Link>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              {mode === 'signup' && (
                <div className="grid gap-2">
                  <Label htmlFor="name">{t('your_name')}</Label>
                  <Input
                    id="name"
                    name="name"
                    autoComplete="name"
                    maxLength={60}
                    placeholder={t('what_should_we_call_you')}
                    required
                  />
                </div>
              )}
              {mode !== 'reset' && (
                <div className="grid gap-2">
                  <Label htmlFor="email">{t('email_address')}</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    onChange={(event) => setEmailAddress(event.target.value)}
                    placeholder="you@example.com"
                    maxLength={254}
                    required
                  />
                </div>
              )}
              {mode !== 'forgot' && (
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">{t('password')}</Label>
                    {mode === 'login' && mailReady && (
                      <Link
                        to="/forgot-password"
                        className="text-xs text-muted-foreground hover:text-primary"
                      >
                        {t('forgot_password')}
                      </Link>
                    )}
                  </div>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    minLength={mode === 'login' ? 1 : 12}
                    maxLength={128}
                    placeholder={
                      mode === 'login' ? t('enter_your_password') : t('at_least_12_characters')
                    }
                    required
                  />
                </div>
              )}
              {mode === 'reset' && !token && (
                <ErrorNotice>{t('invalid_reset_link_request_a_new_one')}</ErrorNotice>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={
                  pending ||
                  (mode === 'reset' && !token) ||
                  (!mailReady && (mode === 'signup' || mode === 'forgot'))
                }
              >
                {pending
                  ? t('please_wait')
                  : {
                      login: t('sign_in'),
                      signup: t('create_account'),
                      forgot: t('send_reset_link'),
                      reset: t('save_new_password'),
                    }[mode]}
                {!pending && <ArrowRight size={15} />}
              </Button>
              {(mode !== 'login' || mailReady) && (
                <p className="text-center text-xs text-muted-foreground">
                  {mode === 'login' ? (
                    <>
                      {t('new_here')}{' '}
                      <Link to="/signup" className="font-medium text-primary">
                        {t('get_started')}
                      </Link>
                    </>
                  ) : (
                    <Link to="/login" className="text-primary">
                      {t('already_have_an_account_sign_in')}
                    </Link>
                  )}
                </p>
              )}
            </form>
          )}
          {mailReady && ((mode === 'signup' && success) || mode === 'login') && (
            <VerificationResend email={emailAddress} />
          )}
          {local && !success && (
            <Link
              to="/dev/inbox"
              className="mt-8 flex items-center justify-center gap-2 border-t pt-5 text-[11px] text-muted-foreground"
            >
              <Mail size={13} />
              {t('local_development_test_inbox')}
            </Link>
          )}
          <p className="mt-8 text-center text-[10px] text-muted-foreground">
            {site.name} · TanStack Start × Cloudflare
          </p>
        </section>
      </main>
    </div>
  )
}
