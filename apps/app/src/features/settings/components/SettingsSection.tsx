import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { colors, radii, spacing } from '@/theme'

type SettingsSectionProps = {
  title: string
  summary?: string
  hint?: string
  children: ReactNode
}

export function SettingsSection({ title, summary, hint, children }: SettingsSectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {summary !== undefined && <Text style={styles.summary}>{summary}</Text>}
      </View>
      <View style={styles.card}>{children}</View>
      {hint !== undefined && <Text style={styles.hint}>{hint}</Text>}
    </View>
  )
}

export function SettingsDivider() {
  return <View style={styles.divider} />
}

type SettingsRowProps = {
  label: string
  children?: ReactNode
}

export function SettingsRow({ label, children }: SettingsRowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  title: {
    color: colors.textFaint,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  summary: {
    color: colors.textFaint,
    fontSize: 13,
  },
  card: {
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  hint: {
    color: colors.textFaint,
    fontSize: 13,
    paddingHorizontal: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  label: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
  },
})
