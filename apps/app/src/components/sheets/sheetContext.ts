import { createContext, type ReactNode, use } from 'react'

export type SheetClose = (after?: () => void) => void

export const SheetCloseContext = createContext<SheetClose>((after) => after?.())

export function useSheetClose(): SheetClose {
  return use(SheetCloseContext)
}

export type NativeSheetProps = {
  open: boolean
  onClose: () => void
  children: ReactNode
}
