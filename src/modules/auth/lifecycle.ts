export interface AccountLifecycle {
  lastAdministrator?: boolean
  siteContributions?: number
  verification: 'password' | 'recent-login' | 'unavailable'
  recentLogin: boolean
  billingBlocked: boolean
  billing?: BillingDeletionStatus
}
export interface BillingDeletionStatus {
  state: 'none' | 'unchecked' | 'ready' | 'subscription' | 'checkout' | 'invoice' | 'unknown'
  canCloseCheckouts: boolean
}

export interface AccountExport {
  auditData?: { retained: true; identityReferencesRemovedOnDeletion: true }
  siteData?: { ownership: 'site'; included: false; retainedAfterDeletion: true }
  version: 1
  exportedAt: string
  profile: { name: string; email: string; image: string | null; createdAt: number }
  projects: {
    id: string
    name: string
    description: string
    status: string
    coverAssetId: string | null
    createdAt: number
    updatedAt: number
  }[]
  files: {
    id: string
    name: string
    type: string
    size: number
    state: string
    createdAt: number
  }[]
  billing: {
    subscriptions: {
      provider: string
      status: string
      currentPeriodEnd: number
      cancelAtPeriodEnd: number
    }[]
    checkouts: { provider: string; status: string; createdAt: number }[]
  }
}
