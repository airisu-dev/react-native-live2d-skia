import {
  Live2D,
  type Live2DLoadOptions,
  type Live2DModel,
  type Live2DModelSource,
  useLive2DModel,
} from '@airisu-dev/react-native-live2d-skia'
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import { Canvas, Fill, Points, vec } from 'react-native-skia'
import { buildModelSource } from '@/features/library/helpers/modelSource'
import type { ModelRecord, ViewerBackground } from '@/features/library/helpers/storage'
import { colors, radii, spacing, touchTarget } from '@/theme'
import { fitModel, type Size } from '../helpers/fit'
import type { ViewTransform } from '../hooks/useViewTransform'

type ModelStageProps = {
  record: ModelRecord
  background: ViewerBackground
  view: ViewTransform
  onModel?: (model: Live2DModel | null) => void
}

type BuiltSource =
  | { id: string; attempt: number; source: Live2DModelSource; error?: undefined }
  | { id: string; attempt: number; source?: undefined; error: Error }

const DOT_SPACING = 20
const LOAD_OPTIONS: Live2DLoadOptions = { idleMotion: false, eyeBlink: false }

const backgroundColor: Record<ViewerBackground, string> = {
  dots: colors.stage,
  dark: colors.stage,
  light: colors.stageLight,
}

export function ModelStage({ record, background, view, onModel }: ModelStageProps) {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }))
  }, [])

  // Reading the model's JSON files is async; the result is tagged with what it was built for,
  // so a stale one (another record, or before a retry) is never shown.
  const [attempt, setAttempt] = useState(0)
  const [built, setBuilt] = useState<BuiltSource | null>(null)
  useEffect(() => {
    let cancelled = false
    const tag = { id: record.id, attempt }
    buildModelSource(record).then(
      (source) => !cancelled && setBuilt({ ...tag, source }),
      (e: unknown) =>
        !cancelled && setBuilt({ ...tag, error: e instanceof Error ? e : new Error(String(e)) }),
    )
    return () => {
      cancelled = true
    }
  }, [record, attempt])
  const current = built?.id === record.id && built.attempt === attempt ? built : null
  const rebuild = useCallback(() => setAttempt((n) => n + 1), [])

  return (
    <View
      style={[styles.root, { backgroundColor: backgroundColor[background] }]}
      onLayout={onLayout}
    >
      {current?.source ? (
        // useLive2DModel loads once per mount: remount for each model.
        <LoadedStage
          key={record.id}
          source={current.source}
          background={background}
          size={size}
          view={view}
          onModel={onModel}
        />
      ) : (
        <>
          <StageCanvas background={background} size={size} view={view} model={null} />
          {current?.error ? (
            <StageError
              message={current.error.message}
              light={background === 'light'}
              onRetry={rebuild}
            />
          ) : (
            <StageLoading light={background === 'light'} />
          )}
        </>
      )}
    </View>
  )
}

function LoadedStage({
  source,
  background,
  size,
  view,
  onModel,
}: {
  source: Live2DModelSource
  background: ViewerBackground
  size: Size
  view: ViewTransform
  onModel?: (model: Live2DModel | null) => void
}) {
  // The model only moves when a motion is picked: no random idle motions, no blinking.
  const { model, error, retry } = useLive2DModel(source, LOAD_OPTIONS)
  const { setBase } = view

  // Sync the fitted place to the UI thread before paint, so the first frame is already placed.
  useLayoutEffect(() => {
    if (!model || size.width <= 0 || size.height <= 0) return
    setBase(fitModel(model, size), size)
  }, [model, size, setBase])

  useEffect(() => {
    if (!model) return
    onModel?.(model)
    return () => onModel?.(null)
  }, [model, onModel])

  const light = background === 'light'
  return (
    <>
      <StageCanvas background={background} size={size} view={view} model={model} />
      {error ? (
        <StageError message={error.message} light={light} onRetry={retry} />
      ) : (
        !model && <StageLoading light={light} />
      )}
    </>
  )
}

function StageCanvas({
  background,
  size,
  view,
  model,
}: {
  background: ViewerBackground
  size: Size
  view: ViewTransform
  model: Live2DModel | null
}) {
  return (
    <GestureDetector gesture={view.gesture}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Fill color={backgroundColor[background]} />
        {background === 'dots' && <DotGrid width={size.width} height={size.height} />}
        <Live2D model={model} x={view.x} y={view.y} scale={view.scale} />
      </Canvas>
    </GestureDetector>
  )
}

function DotGrid({ width, height }: { width: number; height: number }) {
  const points = useMemo(() => {
    const result = []
    for (let y = DOT_SPACING / 2; y < height; y += DOT_SPACING) {
      for (let x = DOT_SPACING / 2; x < width; x += DOT_SPACING) result.push(vec(x, y))
    }
    return result
  }, [width, height])
  if (points.length === 0) return null
  return (
    <Points
      points={points}
      mode="points"
      color={colors.stageDots}
      strokeWidth={2}
      strokeCap="round"
    />
  )
}

function StageLoading({ light }: { light: boolean }) {
  return (
    <View style={styles.overlay} pointerEvents="none">
      <ActivityIndicator color={light ? colors.onAccent : colors.textMuted} />
      <Text style={[styles.loadingText, light && styles.loadingTextLight]}>Loading model…</Text>
    </View>
  )
}

function StageError({
  message,
  light,
  onRetry,
}: {
  message: string
  light: boolean
  onRetry: () => void
}) {
  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={[styles.errorCard, light && styles.errorCardLight]} accessibilityRole="alert">
        <Text style={styles.errorTitle}>Couldn't load this model</Text>
        <Text style={styles.errorText}>{message}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xxl,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  loadingTextLight: {
    color: colors.surface,
  },
  errorCard: {
    maxWidth: 340,
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: radii.card,
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  errorCardLight: {
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  errorTitle: {
    color: colors.dangerText,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.sm,
    minHeight: touchTarget,
    minWidth: 120,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    color: colors.onAccent,
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
  },
})
