import Feather from '@expo/vector-icons/Feather'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, radii, spacing, touchTarget } from '@/theme'
import { FAB_BOTTOM, FAB_SIZE } from './FabCluster'

type ZoomChipProps = {
  percent: number
  onPress: () => void
  hidden?: boolean
}

export function ZoomChip({ percent, onPress, hidden = false }: ZoomChipProps) {
  const insets = useSafeAreaInsets()
  if (hidden) return null

  return (
    <View
      pointerEvents="box-none"
      style={[styles.root, { bottom: insets.bottom + FAB_BOTTOM + (FAB_SIZE - touchTarget) / 2 }]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Zoom ${percent}%`}
        accessibilityHint="Resets the view"
        onPress={onPress}
        style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
      >
        <Feather name="maximize" size={14} color={colors.textMuted} />
        <Text style={styles.text}>{percent}%</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    height: touchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
  },
  text: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  pressed: {
    opacity: 0.6,
  },
})
