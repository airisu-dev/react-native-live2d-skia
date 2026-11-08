import Feather from '@expo/vector-icons/Feather'
import { router } from 'expo-router'
import { Fragment, useCallback } from 'react'
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { ViewerBackground } from '@/features/library/helpers/storage'
import { useLibrary } from '@/features/library/LibraryProvider'
import { colors, radii, spacing, touchTarget } from '@/theme'
import { formatMegabytes, ImportRow, ModelRow } from './components/ModelRow'
import { Segmented, type SegmentedOption } from './components/Segmented'
import { SettingsDivider, SettingsRow, SettingsSection } from './components/SettingsSection'

const BACKGROUND_OPTIONS: readonly SegmentedOption<ViewerBackground>[] = [
  { value: 'dots', label: 'Dots' },
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
]

const SWITCH_TRACK = { false: colors.borderStrong, true: colors.accent }

function goBack() {
  if (router.canGoBack()) router.back()
  else router.replace('/')
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets()
  const { models, activeModel, settings, setActive, remove, updateSettings, startImport } =
    useLibrary()

  const totalBytes = models.reduce((sum, m) => sum + m.sizeBytes, 0)
  const librarySummary = `${models.length} ${models.length === 1 ? 'model' : 'models'} · ${formatMegabytes(totalBytes)}`

  const setResetViewOnSwitch = useCallback(
    (resetViewOnSwitch: boolean) => updateSettings({ resetViewOnSwitch }),
    [updateSettings],
  )
  const setBackground = useCallback(
    (background: ViewerBackground) => updateSettings({ background }),
    [updateSettings],
  )

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right },
      ]}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={goBack}
          hitSlop={4}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Feather name="chevron-left" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          Settings
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}
      >
        <SettingsSection
          title="Model library"
          summary={librarySummary}
          hint="Tap a model to make it active."
        >
          {models.map((record) => (
            <Fragment key={record.id}>
              <ModelRow
                record={record}
                active={record.id === activeModel?.id}
                onSelect={setActive}
                onRemove={remove}
              />
              <SettingsDivider />
            </Fragment>
          ))}
          <ImportRow onPress={startImport} />
        </SettingsSection>

        <SettingsSection title="Viewer">
          <SettingsRow label="Reset view when switching model">
            <Switch
              accessibilityLabel="Reset view when switching model"
              value={settings.resetViewOnSwitch}
              onValueChange={setResetViewOnSwitch}
              trackColor={SWITCH_TRACK}
              thumbColor={colors.text}
              ios_backgroundColor={colors.borderStrong}
            />
          </SettingsRow>
          <SettingsDivider />
          <SettingsRow label="Background">
            <Segmented
              label="Background"
              options={BACKGROUND_OPTIONS}
              value={settings.background}
              onChange={setBackground}
            />
          </SettingsRow>
        </SettingsSection>

        <SettingsSection title="About">
          <View style={styles.about}>
            <Text style={styles.aboutTitle}>Live2D Viewer</Text>
            <Text style={styles.aboutText}>
              Rendered with Live2D Cubism SDK and Skia. Models remain the property of their authors.
            </Text>
          </View>
        </SettingsSection>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.stage,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  backButton: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  content: {
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    gap: 28,
  },
  about: {
    padding: spacing.lg,
    gap: spacing.xs,
  },
  aboutTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  aboutText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
})
