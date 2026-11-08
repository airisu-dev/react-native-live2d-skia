import Feather from '@expo/vector-icons/Feather'
import { router } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, radii, spacing, touchTarget } from '@/theme'

type TopBarProps = {
  name: string
  open?: boolean
  onPress: () => void
}

const openSettings = () => router.push('/settings')

export function TopBar({ name, open = false, onPress }: TopBarProps) {
  const insets = useSafeAreaInsets()
  const letter = name.trim().charAt(0).toUpperCase() || '?'

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.root,
        {
          top: insets.top + spacing.sm,
          left: insets.left + spacing.lg,
          right: insets.right + spacing.lg,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Model: ${name}`}
        accessibilityHint="Shows your models"
        accessibilityState={{ expanded: open }}
        onPress={onPress}
        style={({ pressed }) => [styles.pill, open && styles.pillOpen, pressed && styles.pressed]}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarLetter}>{letter}</Text>
        </View>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Feather
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={open ? colors.accentText : colors.textMuted}
        />
      </Pressable>

      {/* Not <Link asChild>: it drops a function `style`, which removed the button's background. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Settings"
        onPress={openSettings}
        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
      >
        <Feather name="settings" size={20} color={colors.text} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  pill: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: touchTarget,
    paddingLeft: spacing.xs + 2,
    paddingRight: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceTranslucent,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillOpen: {
    borderColor: colors.accent,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: colors.accentLetter,
    fontSize: 14,
    fontWeight: '700',
  },
  name: {
    flexShrink: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  iconButton: {
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
    opacity: 0.7,
  },
})
