import { Input as FlatInput, type InputProps } from '@/components/flatpack/input'
import { cn } from 'cn'
import { useHydrated } from '@/lib/use-hydrated'

function Input({ className, ...props }: InputProps) {
  const hydrated = useHydrated()
  return (
    <FlatInput
      className={cn(
        'file:inline-flex file:h-full file:border-0 file:bg-transparent file:text-sm file:font-medium',
        className,
      )}
      {...props}
      disabled={!hydrated || props.disabled}
    />
  )
}

export { Input }
