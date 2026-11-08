import Feather from '@expo/vector-icons/Feather'
import { Children, type ComponentProps, type ReactNode } from 'react'
import {
  Pressable,
  ScrollView,
  type StyleProp,
  StyleSheet,
  Text,
  type TextStyle,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native'
import { colors, radii, spacing, touchTarget } from '@/theme'
import { useSheetClose } from './sheetContext'

type FeatherName = ComponentProps<typeof Feather>['name']

const GRID_MAX_HEIGHT = 0.4

type BottomSheetProps = {
  title: string
  actions?: ReactNode
  children: ReactNode
}

export function BottomSheet({ title, actions, children }: BottomSheetProps) {
  const close = useSheetClose()

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
        {actions}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={4}
          onPress={() => close()}
          style={styles.touch}
        >
          {({ pressed }) => (
            <View style={[styles.close, pressed && styles.pressed]}>
              <Feather name="x" size={18} color={colors.text} />
            </View>
          )}
        </Pressable>
      </View>
      {children}
    </View>
  )
}

type SheetPillProps = {
  label: string
  icon?: FeatherName
  onPress: () => void
  active?: boolean
}

export function SheetPill({ label, icon, onPress, active }: SheetPillProps) {
  const color = active ? colors.accentText : colors.text
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={active === undefined ? undefined : { checked: active }}
      onPress={onPress}
      style={styles.touch}
    >
      {({ pressed }) => (
        <View style={[styles.pill, active && styles.pillActive, pressed && styles.pressed]}>
          {icon && <Feather name={icon} size={14} color={color} />}
          <Text style={[styles.pillText, { color }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  )
}

export function SheetGrid({ children }: { children: ReactNode }) {
  const { height } = useWindowDimensions()
  const cells = Children.toArray(children)
  const rows: ReactNode[][] = []
  for (let i = 0; i < cells.length; i += 2) rows.push(cells.slice(i, i + 2))

  return (
    <ScrollView
      style={{ maxHeight: height * GRID_MAX_HEIGHT }}
      contentContainerStyle={styles.grid}
      showsVerticalScrollIndicator={false}
      bounces={false}
      // Inside the Android sheet: scroll the grid first, then drag the sheet once at the top.
      nestedScrollEnabled
    >
      {rows.map((row, i) => (
        <View key={i} style={styles.row}>
          {row}
          {row.length === 1 && <View style={styles.cellSpacer} />}
        </View>
      ))}
    </ScrollView>
  )
}

type GridButtonProps = {
  label: string
  onPress?: () => void
  selected?: boolean
  disabled?: boolean
  icon?: FeatherName
  leading?: ReactNode
  trailing?: ReactNode
  style?: StyleProp<ViewStyle>
  labelStyle?: StyleProp<TextStyle>
}

export function GridButton({
  label,
  onPress,
  selected = false,
  disabled = false,
  icon,
  leading,
  trailing,
  style,
  labelStyle,
}: GridButtonProps) {
  const color = selected ? colors.accentText : disabled ? colors.textFaint : colors.text
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.cell,
        selected && styles.cellSelected,
        style,
        pressed && styles.pressed,
      ]}
    >
      {leading ?? (icon && <Feather name={icon} size={14} color={color} />)}
      <Text
        style={[styles.cellText, { color }, selected && styles.cellTextSelected, labelStyle]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {trailing}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: touchTarget,
    marginBottom: spacing.sm,
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  touch: {
    height: touchTarget,
    minWidth: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    height: 32,
    paddingHorizontal: spacing.md,
    marginRight: spacing.xs,
    borderRadius: radii.sheetPill,
    backgroundColor: colors.surface3,
  },
  pillActive: {
    backgroundColor: colors.accentSoft,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '500',
  },
  grid: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: touchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radii.chip,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cellSelected: {
    backgroundColor: colors.accentSoft,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  cellSpacer: {
    flex: 1,
  },
  cellText: {
    flexShrink: 1,
    fontSize: 14,
  },
  cellTextSelected: {
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
  },
})
