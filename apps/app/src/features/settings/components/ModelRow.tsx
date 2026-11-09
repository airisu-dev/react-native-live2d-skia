import Feather from '@expo/vector-icons/Feather'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { ModelRecord } from '@/features/library/helpers/storage'
import { colors, spacing, touchTarget } from '@/theme'

const BYTES_PER_MB = 1024 * 1024

export function formatMegabytes(bytes: number): string {
  return `${(bytes / BYTES_PER_MB).toFixed(1)} MB`
}

function formatImportDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

type ModelRowProps = {
  record: ModelRecord
  active: boolean
  onSelect: (id: string) => void
  onRemove: (id: string) => void
}

export function ModelRow({ record, active, onSelect, onRemove }: ModelRowProps) {
  const date = formatImportDate(record.importedAt)
  const meta = [record.zipName, formatMegabytes(record.sizeBytes), date].filter(Boolean).join(' · ')
  const letter = record.name.trim().charAt(0).toUpperCase() || '?'

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={record.name}
        accessibilityHint={active ? undefined : 'Makes this the active model'}
        accessibilityState={{ selected: active }}
        onPress={() => onSelect(record.id)}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
      >
        <View style={[styles.thumb, active && styles.thumbActive]}>
          <Text style={[styles.letter, active && styles.letterActive]}>{letter}</Text>
        </View>
        <View style={styles.text}>
          <View style={styles.titleLine}>
            <Text style={styles.name} numberOfLines={1}>
              {record.name}
            </Text>
            {active && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Active</Text>
              </View>
            )}
          </View>
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove ${record.name}`}
        onPress={() => onRemove(record.id)}
        style={({ pressed }) => [styles.trash, pressed && styles.pressed]}
      >
        <Feather name="trash-2" size={18} color={colors.textMuted} />
      </Pressable>
    </View>
  )
}

type ImportRowProps = {
  onPress: () => void
}

export function ImportRow({ onPress }: ImportRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.importRow, pressed && styles.pressed]}
    >
      <Feather name="plus" size={18} color={colors.accentText} />
      <Text style={styles.importText}>Import model from .zip</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: spacing.sm,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbActive: {
    backgroundColor: colors.accentThumb,
  },
  letter: {
    color: colors.textMuted,
    fontSize: 20,
    fontWeight: '700',
  },
  letterActive: {
    color: colors.accentText,
  },
  text: {
    flex: 1,
    gap: spacing.xxs,
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    flexShrink: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  badge: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: 10,
    backgroundColor: colors.accentSoft,
  },
  badgeText: {
    color: colors.accentText,
    fontSize: 11,
    fontWeight: '700',
  },
  meta: {
    color: colors.textMuted,
    fontSize: 13,
  },
  trash: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    height: 56,
    paddingHorizontal: spacing.lg,
  },
  importText: {
    color: colors.accentText,
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
})
