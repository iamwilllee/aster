import type { ComponentProps } from 'react'
import { Card as FlatCard } from '@/components/flatpack/card'

export {
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
} from '@/components/flatpack/card'

function Card({
  size = 'default',
  ...props
}: ComponentProps<typeof FlatCard> & { size?: 'default' | 'sm' }) {
  return <FlatCard data-size={size} {...props} />
}

export { Card }
