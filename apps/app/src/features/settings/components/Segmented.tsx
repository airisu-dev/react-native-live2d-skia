import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, radii, spacing, touchTarget } from '@/theme'

const SEGMENT_HEIGHT = 32
const CONTAINER_PADDING = 2
const SLOP = (touchTarget - SEGMENT_HEIGHT) / 2
const SEGMENT_HIT_SLOP = { top: SLOP, bottom: SLOP }

export type SegmentedOption<T extends string> = { value: T; label: string }

type SegmentedProps<T extends string> = {
  label: string
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedProps<T>) {
  return (
    <View style={styles.container} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((option) => {
        const selected = option.value === value
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(option.value)}
            hitSlop={SEGMENT_HIT_SLOP}
            style={({ pressed }) => [
              styles.segment,
              selected && styles.selected,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.text, selected && styles.textSelected]}>{option.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: CONTAINER_PADDING,
    borderRadius: radii.pill,
    backgroundColor: colors.surface3,
  },
  segment: {
    height: SEGMENT_HEIGHT,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: {
    backgroundColor: colors.accentSoft,
  },
  pressed: {
    opacity: 0.7,
  },
  text: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  textSelected: {
    color: colors.accentText,
    fontWeight: '700',
  },
})
