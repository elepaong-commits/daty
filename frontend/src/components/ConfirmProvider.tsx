import { AnimatePresence } from 'motion/react'
import { useCallback, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ConfirmContext, type ConfirmOptions } from '../lib/confirm'
import { useT } from '../lib/i18n'
import { ConfirmDialog } from './ConfirmDialog'

/** Holds the one confirm popup `useConfirm` opens, drawn over the whole page. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const t = useT()
  const [pending, setPending] = useState<{ options: ConfirmOptions; resolve: (ok: boolean) => void } | null>(null)

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setPending((previous) => {
          previous?.resolve(false)
          return { options, resolve }
        })
      }),
    [],
  )

  const settle = (ok: boolean) => {
    pending?.resolve(ok)
    setPending(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {createPortal(
        <AnimatePresence>
          {pending && (
            <ConfirmDialog
              fixed
              title={pending.options.title}
              message={pending.options.message}
              confirmLabel={pending.options.confirmLabel}
              cancelLabel={t.common.cancel}
              danger={pending.options.danger}
              onConfirm={() => settle(true)}
              onCancel={() => settle(false)}
            />
          )}
        </AnimatePresence>,
        document.body,
      )}
    </ConfirmContext.Provider>
  )
}
