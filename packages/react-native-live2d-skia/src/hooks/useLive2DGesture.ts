import { useLayoutEffect, useMemo, useRef } from 'react'
import { Gesture } from 'react-native-gesture-handler'
import type { Live2DModel } from '../loader/loadModel'

export interface Live2DGestureTarget {
  model: Live2DModel | null
  x?: number
  y?: number
  scale?: number
  /**
   * Called with the hit areas under a tap. Return true to skip the default
   * reaction: a `Tap<area>` motion, else a random expression for `Head`, else a `Tap` motion.
   */
  onHit?: (hitAreas: string[]) => boolean | void
  /** Makes the model draggable by long-press. Called with its new top-left; the app moves it. */
  onMove?: (x: number, y: number) => void
}

export interface Live2DGesturesOptions {
  /** Models follow the finger while it's down. Default true. */
  focus?: boolean
}

export interface Live2DGestureOptions
  extends Omit<Live2DGestureTarget, 'model'>,
    Live2DGesturesOptions {}

function react(model: Live2DModel, hitAreas: string[]) {
  for (const area of hitAreas) {
    const group = `Tap${area}`
    if (model.motionGroups.includes(group)) {
      model.motion(group)
      return
    }
    if (area === 'Head' && model.expressionNames.length > 0) {
      model.expression()
      return
    }
  }
  // Some models have one `Tap` group for every area.
  if (model.motionGroups.includes('Tap')) model.motion('Tap')
}

const LONG_PRESS_MS = 350

function toModel({ x = 0, y = 0, scale = 1 }: Live2DGestureTarget, px: number, py: number) {
  return [(px - x) / scale, (py - y) / scale] as const
}

function topmostHit(targets: Live2DGestureTarget[], px: number, py: number) {
  // Later targets are drawn over earlier ones.
  for (let i = targets.length - 1; i >= 0; i--) {
    const t = targets[i]!
    if (!t.model) continue
    const hitAreas = t.model.hitTest(...toModel(t, px, py))
    if (hitAreas.length > 0) return { target: t, hitAreas }
  }
  return null
}

/**
 * Touch interaction for several `<Live2D>` models in one canvas, for a
 * `<GestureDetector>` around the `<Canvas>`. List targets in drawing order.
 */
export function useLive2DGestures(
  targets: Live2DGestureTarget[],
  { focus = true }: Live2DGesturesOptions = {},
) {
  // The React Compiler miscompiled these callbacks (a `let` shared between them).
  'use no memo'

  // Read at event time, so the gesture is built once. Updated after render.
  const latest = useRef(targets)
  useLayoutEffect(() => {
    latest.current = targets
  })

  // The callbacks only run on touch events; the refs rule can't tell through RNGH's builder API.
  /* eslint-disable react-hooks/refs */
  return useMemo(() => {
    const focusAll = (px: number, py: number) => {
      for (const t of latest.current) t.model?.focus(...toModel(t, px, py))
    }

    const pan = Gesture.Pan()
      .runOnJS(true)
      .enabled(focus)
      .onBegin((e) => focusAll(e.x, e.y))
      .onUpdate((e) => focusAll(e.x, e.y))
      .onFinalize(() => {
        for (const t of latest.current) t.model?.resetFocus()
      })

    // Shorter than a long press, so picking a model up isn't also a tap.
    const tap = Gesture.Tap()
      .runOnJS(true)
      .maxDuration(LONG_PRESS_MS - 50)
      .onEnd((e, success) => {
        if (!success) return
        const hit = topmostHit(latest.current, e.x, e.y)
        if (hit && hit.target.onHit?.(hit.hitAreas) !== true) {
          react(hit.target.model!, hit.hitAreas)
        }
      })

    // The dragged model (found again by model, as targets can change) and the finger's
    // offset from its top-left. On an object so it survives recompilation.
    const drag: {
      current: { model: Live2DModel; dx: number; dy: number } | null
    } = { current: null }
    const dragPan = Gesture.Pan()
      .runOnJS(true)
      .activateAfterLongPress(LONG_PRESS_MS)
      .onStart((e) => {
        const hit = topmostHit(latest.current, e.x, e.y)
        if (!hit?.target.onMove) return
        const { model, x = 0, y = 0 } = hit.target
        drag.current = { model: model!, dx: e.x - x, dy: e.y - y }
      })
      .onUpdate((e) => {
        if (!drag.current) return
        const { model, dx, dy } = drag.current
        latest.current.find((t) => t.model === model)?.onMove?.(e.x - dx, e.y - dy)
      })
      .onFinalize(() => {
        drag.current = null
      })

    return Gesture.Simultaneous(pan, tap, dragPan)
  }, [focus])
  /* eslint-enable react-hooks/refs */
}

/** Touch interaction for one `<Live2D>`. For several models in one canvas, use `useLive2DGestures`. */
export function useLive2DGesture(
  model: Live2DModel | null,
  { focus, ...target }: Live2DGestureOptions = {},
) {
  return useLive2DGestures([{ model, ...target }], { focus })
}
