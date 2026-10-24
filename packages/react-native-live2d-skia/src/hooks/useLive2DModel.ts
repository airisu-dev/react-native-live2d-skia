import { useCallback, useEffect, useState } from 'react'
import { type Live2DModel, type Live2DModelSource, loadLive2DModel } from '../loader/loadModel'
import type { Live2DModelContext } from '../loader/modelContext'
import type { Live2DLoadOptions } from '../loader/modelUrl'

export interface Live2DModelState {
  /** The loaded model, `null` while loading or after an error. */
  model: Live2DModel | null
  /** Why the last load failed, e.g. a network error for a URL source. */
  error: Error | null
  loading: boolean
  /** Loads the model again, e.g. after an error. */
  retry: () => void
}

/** Loads a model on mount. `options` apply to remote files (see `Live2DLoadOptions`). */
export function useLive2DModel(
  source: Live2DModelSource | Live2DModelContext | string,
  options?: Live2DLoadOptions,
): Live2DModelState {
  const [model, setModel] = useState<Live2DModel | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [attempt, setAttempt] = useState(0)
  // Read once: remount to load another model. Wrapped because a require.context
  // is a function, which useState would call as an initializer.
  const [initialSource] = useState(() => source)
  const [initialOptions] = useState(options)

  useEffect(() => {
    let cancelled = false
    loadLive2DModel(initialSource, initialOptions).then(
      (m) => !cancelled && setModel(m),
      (e: unknown) => !cancelled && setError(e instanceof Error ? e : new Error(String(e))),
    )
    return () => {
      cancelled = true
    }
  }, [initialSource, initialOptions, attempt])

  const retry = useCallback(() => {
    setError(null)
    setModel(null)
    setAttempt((n) => n + 1)
  }, [])

  return { model, error, loading: !model && !error, retry }
}
