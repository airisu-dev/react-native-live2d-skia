import { useEffect } from 'react'
import { type SharedValue, useAnimatedReaction } from 'react-native-reanimated'
import type { Live2DModel } from '../loader/loadModel'

export interface Live2DParametersOptions {
  /**
   * Eases the held values with this time constant in seconds, so values that change at a low
   * rate look smooth at the display's. Default 0: applied as they are.
   */
  smoothing?: number
}

/**
 * Holds parameters at the values of a shared value, e.g. `{ ParamAngleX: 12, ParamEyeLOpen: 1 }`,
 * as it changes. The values are passed on from the UI thread: nothing runs on the JS thread, and
 * the shared value can be written from any worklet (an animation, a gesture, a camera frame
 * processor). The parameters are released when the component unmounts.
 */
export function useLive2DParameters(
  model: Live2DModel | null,
  values: SharedValue<Record<string, number>>,
  { smoothing = 0 }: Live2DParametersOptions = {},
) {
  // Only the native model goes into the worklet: it can be shared across threads.
  const native = model?.native ?? null

  useEffect(() => {
    if (!native) return
    native.parameterSmoothing = smoothing
    return () => {
      native.clearParameters()
      native.parameterSmoothing = 0
    }
  }, [native, smoothing])

  useAnimatedReaction(
    () => values.value,
    (current) => {
      if (native) native.setParameters(Object.keys(current), Object.values(current))
    },
    [native],
  )
}

/** `useLive2DParameters` for one parameter: holds `id` at the shared value. */
export function useLive2DParameter(
  model: Live2DModel | null,
  id: string,
  value: SharedValue<number>,
  { smoothing = 0 }: Live2DParametersOptions = {},
) {
  const native = model?.native ?? null

  useEffect(() => {
    if (!native) return
    native.parameterSmoothing = smoothing
    return () => {
      native.clearParameter(id)
      native.parameterSmoothing = 0
    }
  }, [native, id, smoothing])

  useAnimatedReaction(
    () => value.value,
    (current) => {
      if (native) native.setParameter(id, current)
    },
    [native, id],
  )
}
