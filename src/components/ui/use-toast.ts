// Request-local toast manager from the nearest ToastProvider; no global manager is created
// during SSR.
export { useToast } from '@/components/flatpack/toast'
