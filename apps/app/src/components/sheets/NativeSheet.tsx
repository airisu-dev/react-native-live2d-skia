import { StyleSheet, View } from 'react-native'
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, radii, spacing } from '@/theme'
import { type NativeSheetProps, SheetCloseContext } from './sheetContext'

const ENTER_MS = 220
const EXIT_MS = 160
const MIN_BOTTOM_PADDING = 34

export function NativeSheet({ open, onClose, children }: NativeSheetProps) {
  const insets = useSafeAreaInsets()

  if (!open) return null

  const close = (after?: () => void) => {
    onClose()
    after?.()
  }

  return (
    <SheetCloseContext value={close}>
      <Animated.View
        entering={SlideInDown.duration(ENTER_MS)}
        exiting={SlideOutDown.duration(EXIT_MS)}
        style={[
          styles.sheet,
          {
            paddingBottom: Math.max(MIN_BOTTOM_PADDING, insets.bottom + spacing.lg),
            paddingLeft: insets.left + spacing.lg,
            paddingRight: insets.right + spacing.lg,
          },
        ]}
      >
        <View style={styles.handle} />
        {children}
      </Animated.View>
    </SheetCloseContext>
  )
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderColor: colors.border,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 16,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
  },
})
