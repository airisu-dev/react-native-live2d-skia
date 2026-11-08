import Feather from '@expo/vector-icons/Feather'
import type { ComponentProps } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, radii, spacing, touchTarget } from '@/theme'

export const FAB_SIZE = 60
export const FAB_BOTTOM = 36
const SIDE_MARGIN = spacing.xl

type FabClusterProps = {
  side: 'left' | 'right'
  icon: ComponentProps<typeof Feather>['name']
  label: string
  onPress: () => void
  onReset: () => void
  resetLabel: string
  hidden?: boolean
}

export function FabCluster({
  side,
  icon,
  label,
  onPress,
  onReset,
  resetLabel,
  hidden = false,
}: FabClusterProps) {
  const insets = useSafeAreaInsets()
  if (hidden) return null

  const main = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.main, pressed && styles.pressed]}
    >
      <Feather name={icon} size={24} color={colors.onAccent} />
    </Pressable>
  )
  const reset = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={resetLabel}
      onPress={onReset}
      style={({ pressed }) => [styles.reset, pressed && styles.pressed]}
    >
      <Feather name="rotate-ccw" size={18} color={colors.text} />
    </Pressable>
  )

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.root,
        { bottom: insets.bottom + FAB_BOTTOM },
        side === 'left'
          ? { left: insets.left + SIDE_MARGIN }
          : { right: insets.right + SIDE_MARGIN },
      ]}
    >
      {side === 'left' ? (
        <>
          {main}
          {reset}
        </>
      ) : (
        <>
          {reset}
          {main}
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  main: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  reset: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceTranslucent,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
})
