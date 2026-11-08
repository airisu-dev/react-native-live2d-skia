import { BottomSheet, Group, Host, RNHostView } from '@expo/ui/swift-ui'
import {
  preferredColorScheme,
  presentationBackground,
  presentationDragIndicator,
} from '@expo/ui/swift-ui/modifiers'
import { useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { colors, spacing } from '@/theme'
import { type NativeSheetProps, SheetCloseContext } from './sheetContext'

const PRESENTATION = [
  presentationDragIndicator('visible'),
  presentationBackground(colors.surface),
  preferredColorScheme('dark'),
]

export function NativeSheet({ open, onClose, children }: NativeSheetProps) {
  const afterClose = useRef<(() => void) | null>(null)

  const close = (after?: () => void) => {
    afterClose.current = after ?? null
    onClose()
  }

  const onIsPresentedChange = (presented: boolean) => {
    if (!presented) onClose()
  }

  const onDismiss = () => {
    const after = afterClose.current
    afterClose.current = null
    after?.()
  }

  return (
    <SheetCloseContext value={close}>
      {/* The sheet is presented on its own; the host only anchors it and takes no space. */}
      <Host matchContents pointerEvents="none" style={styles.host}>
        <BottomSheet
          isPresented={open}
          onIsPresentedChange={onIsPresentedChange}
          onDismiss={onDismiss}
          fitToContents
        >
          <Group modifiers={PRESENTATION}>
            <RNHostView matchContents={{ vertical: true }}>
              <View style={styles.body}>{children}</View>
            </RNHostView>
          </Group>
        </BottomSheet>
      </Host>
    </SheetCloseContext>
  )
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
  },
  // The drag indicator overlays the top edge, so leave room for it. The sheet keeps its content
  // above the home indicator.
  body: {
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
})
