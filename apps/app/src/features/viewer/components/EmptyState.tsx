import Feather from '@expo/vector-icons/Feather'
import { router } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLibrary } from '@/features/library/LibraryProvider'
import { colors, radii, spacing, touchTarget } from '@/theme'

// A plain Pressable, not <Link asChild>, which drops a function `style` (and with it the background).
const openSettings = () => router.push('/settings')

export function EmptyState() {
  const insets = useSafeAreaInsets()
  const { startImport } = useLibrary()

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings"
          hitSlop={4}
          onPress={openSettings}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Feather name="settings" size={20} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.content}>
        <View style={styles.iconTile}>
          <Feather name="package" size={36} color={colors.accentText} />
        </View>
        <Text style={styles.title}>No models yet</Text>
        <Text style={styles.body}>
          Import a .zip that contains a Cubism model folder (a .model3.json with its moc, textures,
          motions and expressions).
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={startImport}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        >
          <Feather name="plus" size={18} color={colors.onAccent} />
          <Text style={styles.primaryButtonText}>Import model from .zip</Text>
        </Pressable>
        <Text style={styles.caption}>Imported models are stored on this device.</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.stage,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  iconButton: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxxl,
    paddingBottom: touchTarget + spacing.sm,
  },
  iconTile: {
    width: 88,
    height: 88,
    borderRadius: radii.card,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxl,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  body: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 320,
    marginBottom: spacing.xxl,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.xxl,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
  },
  primaryButtonText: {
    color: colors.onAccent,
    fontSize: 16,
    fontWeight: '700',
  },
  caption: {
    color: colors.textFaint,
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
})
