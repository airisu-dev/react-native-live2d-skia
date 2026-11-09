import Feather from '@expo/vector-icons/Feather'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { NativeSheet } from '@/components/sheets/NativeSheet'
import { colors, radii, spacing, touchTarget } from '@/theme'
import { type ImportState, type ImportStep, useLibrary } from '../LibraryProvider'

function formatSize(bytes: number | undefined): string | null {
  if (bytes === undefined) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ImportSheet() {
  const { importState, dismissImport } = useLibrary()
  // The sheet animates out after the import state is reset: keep showing the last state.
  const [shown, setShown] = useState<VisibleImportState | null>(null)
  const visible = importState.status !== 'idle'
  if (visible && importState !== shown) setShown(importState)

  return (
    <NativeSheet open={visible} onClose={dismissImport}>
      {shown && <ImportSheetBody state={shown} onClose={dismissImport} />}
    </NativeSheet>
  )
}

type VisibleImportState = Exclude<ImportState, { status: 'idle' }>

const TITLES: Record<VisibleImportState['status'], string> = {
  running: 'Importing model',
  error: "Couldn't import",
  done: 'Model imported',
}

const BUTTONS: Record<VisibleImportState['status'], string> = {
  running: 'Cancel',
  error: 'Close',
  done: 'Done',
}

function ImportSheetBody({ state, onClose }: { state: VisibleImportState; onClose: () => void }) {
  const size = formatSize(state.sizeBytes)
  const subtitle = size ? `${state.zipName} · ${size}` : state.zipName
  const running = state.status === 'running'

  return (
    <View accessibilityViewIsModal>
      <View style={styles.header}>
        <View style={styles.tile}>
          <Feather name="package" size={22} color={colors.accentText} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>{TITLES[state.status]}</Text>
          <Text style={styles.subtitle} numberOfLines={1} ellipsizeMode="middle">
            {subtitle}
          </Text>
        </View>
      </View>

      {state.status === 'done' ? (
        <View style={styles.progressBlock}>
          <View style={styles.track}>
            <View style={[styles.fill, styles.fillDone]} />
          </View>
          <Text style={styles.progressText}>
            {state.modelName} is in your library and on screen.
          </Text>
        </View>
      ) : running ? (
        <View style={styles.progressBlock}>
          <View
            style={styles.track}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(state.progress * 100) }}
          >
            <View style={[styles.fill, { width: `${Math.round(state.progress * 100)}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {state.files.total > 0
              ? `Extracting ${state.files.done} of ${state.files.total} files`
              : 'Reading zip…'}
          </Text>
        </View>
      ) : (
        <View style={styles.errorCard} accessibilityRole="alert">
          <Feather name="alert-circle" size={18} color={colors.dangerText} />
          <Text style={styles.errorMessage}>{state.message}</Text>
        </View>
      )}

      <View style={styles.steps}>
        {state.steps.map((step) => (
          <StepRow
            key={step.key}
            step={step}
            failed={state.status === 'error' && step.status === 'active'}
          />
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onClose}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={styles.buttonText}>{BUTTONS[state.status]}</Text>
      </Pressable>
    </View>
  )
}

function StepRow({ step, failed }: { step: ImportStep; failed: boolean }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepIcon}>
        {failed ? (
          <Feather name="x" size={16} color={colors.dangerText} />
        ) : step.status === 'done' ? (
          <Feather name="check" size={16} color={colors.success} />
        ) : (
          <View style={step.status === 'active' ? styles.dotActive : styles.dotPending} />
        )}
      </View>
      <Text
        style={[
          styles.stepLabel,
          step.status === 'active' && styles.stepLabelActive,
          step.status === 'pending' && styles.stepLabelPending,
          failed && styles.stepLabelFailed,
        ]}
        numberOfLines={1}
      >
        {step.label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  tile: {
    width: 48,
    height: 48,
    borderRadius: radii.chip,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: spacing.xxs,
  },
  progressBlock: {
    marginBottom: spacing.xl,
  },
  track: {
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
  },
  fillDone: {
    width: '100%',
    backgroundColor: colors.success,
  },
  progressText: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: spacing.sm,
  },
  errorCard: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.chip,
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    marginBottom: spacing.xl,
  },
  errorMessage: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  steps: {
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stepIcon: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActive: {
    width: 10,
    height: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
  },
  dotPending: {
    width: 10,
    height: 10,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.textFaint,
  },
  stepLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
  },
  stepLabelActive: {
    fontWeight: '700',
  },
  stepLabelPending: {
    color: colors.textFaint,
  },
  stepLabelFailed: {
    color: colors.dangerText,
  },
  button: {
    minHeight: touchTarget + spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surface3,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  buttonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
})
