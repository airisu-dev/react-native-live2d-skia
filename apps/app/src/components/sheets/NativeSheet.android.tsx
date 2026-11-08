import {
  Box,
  Column,
  Host,
  ModalBottomSheet,
  type ModalBottomSheetRef,
  RNHostView,
} from '@expo/ui/jetpack-compose'
import {
  background,
  clip,
  fillMaxWidth,
  padding,
  Shapes,
  size,
} from '@expo/ui/jetpack-compose/modifiers'
import { useEffect, useRef, useState } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import { colors, spacing } from '@/theme'
import { type NativeSheetProps, SheetCloseContext } from './sheetContext'

const SCRIM = 'transparent'
const SHEET_PROPERTIES = { shouldDismissOnBackPress: true, shouldDismissOnClickOutside: true }

export function NativeSheet({ open, onClose, children }: NativeSheetProps) {
  const { width } = useWindowDimensions()
  const sheetRef = useRef<ModalBottomSheetRef>(null)
  const afterClose = useRef<(() => void) | null>(null)
  const [mounted, setMounted] = useState(open)
  // Bumped on every open, so reopening during the exit animation presents a fresh sheet
  // instead of the one that is hiding.
  const [generation, setGeneration] = useState(0)
  const [shownOpen, setShownOpen] = useState(open)
  if (open !== shownOpen) {
    setShownOpen(open)
    if (open) {
      setGeneration((g) => g + 1)
      setMounted(true)
    }
  }

  useEffect(() => {
    if (open || !mounted) return
    let cancelled = false
    const finish = () => {
      if (cancelled) return
      setMounted(false)
      const after = afterClose.current
      afterClose.current = null
      after?.()
    }
    const sheet = sheetRef.current
    if (sheet) sheet.hide().then(finish, finish)
    else finish()
    return () => {
      cancelled = true
    }
  }, [open, mounted])

  if (!mounted) return null

  const close = (after?: () => void) => {
    afterClose.current = after ?? null
    onClose()
  }

  return (
    <SheetCloseContext value={close}>
      {/* The sheet is its own window; the host only anchors it and takes no space. */}
      <Host matchContents colorScheme="dark" pointerEvents="none" style={styles.host}>
        <ModalBottomSheet
          key={generation}
          ref={sheetRef}
          onDismissRequest={onClose}
          scrimColor={SCRIM}
          containerColor={colors.surface}
          contentColor={colors.text}
          skipPartiallyExpanded
          properties={SHEET_PROPERTIES}
        >
          <ModalBottomSheet.DragHandle>
            <Box
              contentAlignment="center"
              modifiers={[fillMaxWidth(), padding(0, spacing.md, 0, spacing.sm)]}
            >
              <Box
                modifiers={[
                  size(36, 4),
                  clip(Shapes.RoundedCorner(2)),
                  background(colors.borderStrong),
                ]}
              />
            </Box>
          </ModalBottomSheet.DragHandle>
          <Column modifiers={[fillMaxWidth()]}>
            <RNHostView matchContents={{ vertical: true }} modifiers={[fillMaxWidth()]}>
              {/* An explicit width: the hosted RN view otherwise lays out at its content width. */}
              <View style={[styles.body, { width }]}>{children}</View>
            </RNHostView>
          </Column>
        </ModalBottomSheet>
      </Host>
    </SheetCloseContext>
  )
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
  },
  // Compose pads the sheet content above the navigation bar itself, so no safe-area inset here.
  body: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
})
