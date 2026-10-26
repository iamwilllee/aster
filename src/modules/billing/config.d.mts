export type PaymentProvider = 'stripe' | 'creem'
export function paymentProvider(vars: { BILLING_PROVIDER?: string }): PaymentProvider | null
export function paymentSecrets(provider: PaymentProvider): string[]
export function paymentProviders(vars: {
  BILLING_PROVIDER?: string
  BILLING_LEGACY_PROVIDERS?: string
}): PaymentProvider[] | null
