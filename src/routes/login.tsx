import { features } from '@/config/features'
import { notFound } from '@tanstack/react-router'
import { createFileRoute } from '@tanstack/react-router'
import { AuthForm } from '@/components/auth-form'
import { getAuthInfo } from '@/server/functions'

export const Route = createFileRoute('/login')({
  beforeLoad: () => {
    if (!features.auth) throw notFound()
  },
  validateSearch: (
    search: Record<string, unknown>,
  ): { verified?: boolean; oauthError?: boolean; deleted?: boolean } => ({
    verified: search.verified === '1' || search.verified === 1 || search.verified === true,
    oauthError: search.oauthError === '1' || search.oauthError === 1 || search.oauthError === true,
    deleted:
      search.deleted === '1' || search.deleted === 1 || search.deleted === true ? true : undefined,
  }),
  loader: () => getAuthInfo(),
  component: Login,
})
function Login() {
  const info = Route.useLoaderData()
  const { verified, oauthError, deleted } = Route.useSearch()
  return (
    <AuthForm
      emailPasswordEnabled={Route.useLoaderData().emailPassword}
      mode="login"
      local={info.local}
      googleReady={info.google.ready}
      mailReady={info.mailReady}
      verified={verified}
      oauthError={oauthError}
      deleted={deleted}
    />
  )
}
