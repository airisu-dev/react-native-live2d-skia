import { useEffect, useState } from 'react'

export interface JsFrameRate {
  /** Frames the JS thread got through in the last second. */
  fps: number
  /** The longest gap between two of those frames, in ms. */
  worstMs: number
}

/**
 * How well the main JS thread keeps up: the rate of `requestAnimationFrame` callbacks, which run
 * on it, and the longest gap between them. A JS thread kept busy shows as a lower rate and a
 * long gap. Updated once a second.
 */
export function useJsFrameRate(): JsFrameRate | null {
  const [rate, setRate] = useState<JsFrameRate | null>(null)

  useEffect(() => {
    let frame = 0
    let last = -1
    let windowStart = -1
    let frames = 0
    let worst = 0
    const tick = (now: number) => {
      if (last < 0) {
        windowStart = now
      } else {
        frames++
        worst = Math.max(worst, now - last)
      }
      last = now
      if (now - windowStart >= 1000) {
        setRate({ fps: (frames * 1000) / (now - windowStart), worstMs: worst })
        frames = 0
        worst = 0
        windowStart = now
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  return rate
}
