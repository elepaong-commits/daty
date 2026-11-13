import { createContext, useContext } from 'react'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel: string
  /** Red confirm button, for deleting. */
  danger?: boolean
}

export const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null)

/**
 * The app's own yes/no popup in place of `window.confirm`, in either design:
 * `if (await confirm({ title, confirmLabel })) …`. Resolves `false` on cancel, Escape or a backdrop tap.
 */
export function useConfirm() {
  const confirm = useContext(ConfirmContext)
  if (!confirm) throw new Error('useConfirm needs a ConfirmProvider')
  return confirm
}
