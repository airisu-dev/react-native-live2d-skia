import type { Live2DModel } from '@airisu-dev/react-native-live2d-skia'
import { useCallback, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { NativeSheet } from '@/components/sheets/NativeSheet'
import type { ModelRecord, ViewerSettings } from '@/features/library/helpers/storage'
import { useLibrary } from '@/features/library/LibraryProvider'
import { colors } from '@/theme'
import { EmptyState } from './components/EmptyState'
import { ExpressionSheet } from './components/ExpressionSheet'
import { FabCluster } from './components/FabCluster'
import { ModelSheet } from './components/ModelSheet'
import { ModelStage } from './components/ModelStage'
import { MotionSheet } from './components/MotionSheet'
import { TopBar } from './components/TopBar'
import { ZoomChip } from './components/ZoomChip'
import { useViewTransform } from './hooks/useViewTransform'

type SheetKind = 'motion' | 'expression' | 'model'

export default function ViewerScreen() {
  const { ready, models, activeModel, settings } = useLibrary()

  if (!ready) return <View style={styles.stage} />
  if (models.length === 0 || !activeModel) return <EmptyState />

  // With "Reset view when switching model" on, each model gets a fresh viewer (and so a fresh
  // transform); with it off, the key stays put and the transform carries over.
  return (
    <Viewer
      key={settings.resetViewOnSwitch ? activeModel.id : 'viewer'}
      record={activeModel}
      settings={settings}
    />
  )
}

function Viewer({ record, settings }: { record: ModelRecord; settings: ViewerSettings }) {
  const view = useViewTransform()
  const { resetView, zoomPercent } = view
  const [model, setModel] = useState<Live2DModel | null>(null)
  const [openSheet, setOpenSheet] = useState<SheetKind | null>(null)
  const [expression, setExpression] = useState<string | null>(null)

  // The viewer isn't remounted per model when the view carries over, so reset the per-model
  // state while rendering (no effect, no stale frame) when the record or the loaded model changes:
  // a new record closes any sheet; a reloaded model closes the sheets that drive it.
  const modelId = model?.id ?? null
  const [shownFor, setShownFor] = useState({ recordId: record.id, modelId })
  if (shownFor.recordId !== record.id || shownFor.modelId !== modelId) {
    const recordChanged = shownFor.recordId !== record.id
    setShownFor({ recordId: record.id, modelId })
    setExpression(null)
    setOpenSheet((prev) => (recordChanged ? null : prev === 'model' ? prev : null))
  }

  const closeSheet = useCallback(() => setOpenSheet(null), [])
  const toggleModelSheet = useCallback(
    () => setOpenSheet((prev) => (prev === 'model' ? null : 'model')),
    [],
  )
  const openMotionSheet = useCallback(() => {
    if (model) setOpenSheet('motion')
  }, [model])
  const openExpressionSheet = useCallback(() => {
    if (model) setOpenSheet('expression')
  }, [model])

  const resetMotion = useCallback(() => model?.resetPose(), [model])
  const resetExpression = useCallback(() => {
    model?.resetExpression()
    setExpression(null)
  }, [model])
  const onZoomChip = useCallback(() => resetView(true), [resetView])

  const sheetOpen = openSheet !== null

  return (
    <View style={styles.stage}>
      <ModelStage record={record} background={settings.background} view={view} onModel={setModel} />
      <TopBar name={record.name} open={openSheet === 'model'} onPress={toggleModelSheet} />
      <FabCluster
        side="left"
        icon="play"
        label="Motions"
        onPress={openMotionSheet}
        onReset={resetMotion}
        resetLabel="Stop motion"
        hidden={sheetOpen}
      />
      <ZoomChip percent={zoomPercent} onPress={onZoomChip} hidden={sheetOpen} />
      <FabCluster
        side="right"
        icon="smile"
        label="Expressions"
        onPress={openExpressionSheet}
        onReset={resetExpression}
        resetLabel="Reset expression"
        hidden={sheetOpen}
      />

      {/* The motion and expression sheets drive the loaded model, so they exist only with one.
          Each stays mounted while its sheet animates out. */}
      {model && (
        <NativeSheet open={openSheet === 'motion'} onClose={closeSheet}>
          <MotionSheet model={model} />
        </NativeSheet>
      )}
      {model && (
        <NativeSheet open={openSheet === 'expression'} onClose={closeSheet}>
          <ExpressionSheet model={model} selected={expression} onSelectedChange={setExpression} />
        </NativeSheet>
      )}
      <NativeSheet open={openSheet === 'model'} onClose={closeSheet}>
        <ModelSheet />
      </NativeSheet>
    </View>
  )
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    backgroundColor: colors.stage,
  },
})
