'use client'

import { cn } from 'cn'
import type { ComponentProps } from 'react'
import { DialogContent as FlatDialogContent } from '@/components/flatpack/dialog'
import { useI18n } from '@/components/providers'

export {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/flatpack/dialog'

// Aster closes dialogs with a corner button by default, labelled in the page language, and
// lets pages widen a dialog with sm:max-w-*.
function DialogContent({
  className,
  showCloseButton = true,
  ...props
}: ComponentProps<typeof FlatDialogContent>) {
  const { t } = useI18n()
  return (
    <FlatDialogContent
      showCloseButton={showCloseButton}
      closeLabel={t('close_dialog')}
      className={cn('w-full max-w-[calc(100%-2rem)] outline-none sm:max-w-[480px]', className)}
      {...props}
    />
  )
}

export { DialogContent }
