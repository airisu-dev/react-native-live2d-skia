import { useCallback, useMemo, useState } from 'react'
import { Gesture } from 'react-native-gesture-handler'
import {
  type DerivedValue,
  Easing,
  type SharedValue,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import type { Fit, Size } from '../helpers/fit'

export const MIN_ZOOM = 0.3
export const MAX_ZOOM = 5

const RESET_TIMING = { duration: 260, easing: Easing.out(Easing.cubic) }

export type ViewTransform = {
  gesture: ReturnType<typeof Gesture.Race>
  x: DerivedValue<number>
  y: DerivedValue<number>
  scale: DerivedValue<number>
  offsetX: SharedValue<number>
  offsetY: SharedValue<number>
  zoom: SharedValue<number>
  zoomPercent: number
  resetView: (animated?: boolean) => void
  setBase: (fit: Fit, stage: Size) => void
}

const clamp = (value: number, min: number, max: number) => {
  'worklet'
  return Math.min(max, Math.max(min, value))
}

/**
 * The viewer's transform. A point `p` on the fitted model is drawn at
 * `c + zoom * (p - c) + offset`, where `c` is the stage centre, so:
 * - `scale = base.scale * zoom`
 * - `x = c.x + zoom * (base.x - c.x) + offset.x` (and the same for y).
 */
export function useViewTransform(): ViewTransform {
  const offsetX = useSharedValue(0)
  const offsetY = useSharedValue(0)
  const zoom = useSharedValue(1)
  const baseX = useSharedValue(0)
  const baseY = useSharedValue(0)
  const baseScale = useSharedValue(1)
  const centerX = useSharedValue(0)
  const centerY = useSharedValue(0)
  const [zoomPercent, setZoomPercent] = useState(100)

  const x = useDerivedValue(
    () => centerX.get() + zoom.get() * (baseX.get() - centerX.get()) + offsetX.get(),
  )
  const y = useDerivedValue(
    () => centerY.get() + zoom.get() * (baseY.get() - centerY.get()) + offsetY.get(),
  )
  const scale = useDerivedValue(() => baseScale.get() * zoom.get())

  const gesture = useMemo(() => {
    const reportZoom = () => {
      'worklet'
      scheduleOnRN(setZoomPercent, Math.round(zoom.get() * 100))
    }

    // One finger or more: the centroid's movement moves the model. With two fingers this
    // carries the pinch's focal point along, so the pinch only has to scale about it.
    const pan = Gesture.Pan()
      .minPointers(1)
      .onChange((e) => {
        offsetX.set(offsetX.get() + e.changeX)
        offsetY.set(offsetY.get() + e.changeY)
      })

    // Scales about the focal point, so the point under the fingers stays put:
    // with ratio r, every drawn point s goes to f + r * (s - f), which gives
    // offset' = (1 - r) * (f - c) + r * offset.
    const pinch = Gesture.Pinch()
      .onChange((e) => {
        const current = zoom.get()
        const next = clamp(current * e.scaleChange, MIN_ZOOM, MAX_ZOOM)
        const r = next / current
        offsetX.set((1 - r) * (e.focalX - centerX.get()) + r * offsetX.get())
        offsetY.set((1 - r) * (e.focalY - centerY.get()) + r * offsetY.get())
        zoom.set(next)
      })
      .onEnd(reportZoom)

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .onEnd((_e, success) => {
        if (!success) return
        offsetX.set(withTiming(0, RESET_TIMING))
        offsetY.set(withTiming(0, RESET_TIMING))
        zoom.set(withTiming(1, RESET_TIMING))
        scheduleOnRN(setZoomPercent, 100)
      })

    // Whichever starts first wins: dragging cancels a pending double-tap without
    // waiting for it to fail, and a double-tap never moves the model.
    return Gesture.Race(doubleTap, Gesture.Simultaneous(pan, pinch))
  }, [offsetX, offsetY, zoom, centerX, centerY])

  const resetView = useCallback(
    (animated = true) => {
      if (animated) {
        offsetX.set(withTiming(0, RESET_TIMING))
        offsetY.set(withTiming(0, RESET_TIMING))
        zoom.set(withTiming(1, RESET_TIMING))
      } else {
        offsetX.set(0)
        offsetY.set(0)
        zoom.set(1)
      }
      setZoomPercent(100)
    },
    [offsetX, offsetY, zoom],
  )

  const setBase = useCallback(
    (fit: Fit, stage: Size) => {
      baseX.set(fit.x)
      baseY.set(fit.y)
      baseScale.set(fit.scale)
      centerX.set(stage.width / 2)
      centerY.set(stage.height / 2)
    },
    [baseX, baseY, baseScale, centerX, centerY],
  )

  return {
    gesture,
    x,
    y,
    scale,
    offsetX,
    offsetY,
    zoom,
    zoomPercent,
    resetView,
    setBase,
  }
}
