export function paymentProvider(vars) {
  const value = vars.BILLING_PROVIDER ?? 'stripe'
  return ['stripe', 'creem'].includes(value) ? value : null
}
export function paymentSecrets(provider) {
  return provider === 'creem'
    ? ['CREEM_API_KEY', 'CREEM_WEBHOOK_SECRET', 'CREEM_PRODUCT_ID']
    : ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_ID']
}
export function paymentProviders(vars) {
  const selected = paymentProvider(vars)
  const retained = (vars.BILLING_LEGACY_PROVIDERS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  if (!selected || retained.some((value) => !['stripe', 'creem'].includes(value))) return null
  return [...new Set([selected, ...retained])]
}
