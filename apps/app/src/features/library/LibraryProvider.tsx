import * as DocumentPicker from 'expo-document-picker'
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Alert } from 'react-native'
import {
  ImportCancelledError,
  type ImportFileProgress,
  type ImportStep,
  importModelZip,
} from './helpers/importZip'
import {
  defaultLibrary,
  deleteModelFiles,
  type LibraryData,
  loadLibrary,
  type ModelRecord,
  saveLibrary,
  type ViewerSettings,
} from './helpers/storage'

export type { ImportFileProgress, ImportStep, ImportStepStatus } from './helpers/importZip'

export type ImportFile = { zipName: string; sizeBytes: number | undefined }

export type ImportState =
  | { status: 'idle' }
  | ({
      status: 'running'
      steps: ImportStep[]
      progress: number
      files: ImportFileProgress
    } & ImportFile)
  | ({ status: 'error'; message: string; steps: ImportStep[] } & ImportFile)
  // Stays until the user closes the sheet.
  | ({ status: 'done'; modelName: string; steps: ImportStep[] } & ImportFile)

type LibraryContextValue = {
  ready: boolean
  models: ModelRecord[]
  activeModel: ModelRecord | null
  settings: ViewerSettings
  importState: ImportState
  setActive: (id: string) => void
  remove: (id: string) => void
  updateSettings: (patch: Partial<ViewerSettings>) => void
  startImport: () => void
  dismissImport: () => void
}

const LibraryContext = createContext<LibraryContextValue | null>(null)

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<LibraryData>(defaultLibrary)
  const [ready, setReady] = useState(false)
  const [importState, setImportState] = useState<ImportState>({ status: 'idle' })
  // Latest data for callbacks that need to read it without changing identity.
  const dataRef = useRef(data)

  useEffect(() => {
    let cancelled = false
    loadLibrary().then((loaded) => {
      if (cancelled) return
      setData(loaded)
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    dataRef.current = data
    if (!ready) return
    try {
      saveLibrary(data)
    } catch (error) {
      console.warn('[library] failed to save library.json', error)
    }
  }, [data, ready])

  const setActive = useCallback((id: string) => {
    setData((prev) =>
      prev.activeId === id || !prev.models.some((m) => m.id === id)
        ? prev
        : { ...prev, activeId: id },
    )
  }, [])

  const remove = useCallback((id: string) => {
    const record = dataRef.current.models.find((m) => m.id === id)
    if (!record) return
    Alert.alert(
      'Remove model?',
      `"${record.name}" and its files will be deleted from this device.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            try {
              deleteModelFiles(id)
            } catch (error) {
              console.warn('[library] failed to delete model files', error)
            }
            setData((prev) => {
              const index = prev.models.findIndex((m) => m.id === id)
              if (index === -1) return prev
              const models = prev.models.filter((m) => m.id !== id)
              const activeId =
                prev.activeId === id
                  ? (models[Math.min(index, models.length - 1)]?.id ?? null)
                  : prev.activeId
              return { ...prev, models, activeId }
            })
          },
        },
      ],
    )
  }, [])

  const updateSettings = useCallback((patch: Partial<ViewerSettings>) => {
    setData((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }))
  }, [])

  // The import in flight, if any. dismissImport sets `cancelled` to discard its result.
  const runRef = useRef<{ cancelled: boolean } | null>(null)

  useEffect(
    () => () => {
      if (runRef.current) runRef.current.cancelled = true
    },
    [],
  )

  const runImport = useCallback(async (run: { cancelled: boolean }) => {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'],
      copyToCacheDirectory: true,
      multiple: false,
    })
    const asset = picked.canceled ? undefined : picked.assets[0]
    if (!asset || run.cancelled) return

    const file: ImportFile = { zipName: asset.name, sizeBytes: asset.size }
    let lastSteps: ImportStep[] = []
    try {
      const record = await importModelZip(
        { uri: asset.uri, name: asset.name, size: asset.size },
        (steps, progress, files) => {
          lastSteps = steps
          if (!run.cancelled) {
            setImportState({ status: 'running', steps, progress, files, ...file })
          }
        },
        { isCancelled: () => run.cancelled },
      )
      if (run.cancelled) {
        deleteModelFiles(record.id)
        return
      }
      setData((prev) => ({ ...prev, models: [...prev.models, record], activeId: record.id }))
      setImportState({ status: 'done', modelName: record.name, steps: lastSteps, ...file })
    } catch (error) {
      if (run.cancelled || error instanceof ImportCancelledError) return
      console.warn('[library] import failed', error)
      const message = error instanceof Error ? error.message : String(error)
      setImportState({ status: 'error', message, steps: lastSteps, ...file })
    }
  }, [])

  const startImport = useCallback(() => {
    if (runRef.current) return
    const run = { cancelled: false }
    runRef.current = run
    runImport(run)
      .catch((error: unknown) => {
        console.warn('[library] document picker failed', error)
      })
      .finally(() => {
        if (runRef.current === run) runRef.current = null
      })
  }, [runImport])

  const dismissImport = useCallback(() => {
    if (runRef.current) runRef.current.cancelled = true
    runRef.current = null
    setImportState({ status: 'idle' })
  }, [])

  const activeModel = data.models.find((m) => m.id === data.activeId) ?? null

  const value = useMemo<LibraryContextValue>(
    () => ({
      ready,
      models: data.models,
      activeModel,
      settings: data.settings,
      importState,
      setActive,
      remove,
      updateSettings,
      startImport,
      dismissImport,
    }),
    [
      ready,
      data.models,
      activeModel,
      data.settings,
      importState,
      setActive,
      remove,
      updateSettings,
      startImport,
      dismissImport,
    ],
  )

  return <LibraryContext value={value}>{children}</LibraryContext>
}

export function useLibrary(): LibraryContextValue {
  const ctx = use(LibraryContext)
  if (!ctx) throw new Error('useLibrary must be used inside <LibraryProvider>')
  return ctx
}
