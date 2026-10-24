import type { Live2DModel as NativeModel } from '../../specs/react-native-live2d-skia.nitro'
import type { createDrawer, DrawStats } from '../drawer'
import type { SkPicture } from '../skia'
import type { TickerView } from './types'

export interface Slot {
  view: TickerView
  /** The entry's newest frame when the view joined: the oldest it can show before acking one. */
  since: number
}

export interface Frame {
  frame: number
  picture: SkPicture
}

export interface Entry {
  native: NativeModel
  /** Draws the model's current state: in C++ when built with Skia, else in JS. */
  nativeDraw: ((stats?: DrawStats) => SkPicture) | null
  jsDraw: ReturnType<typeof createDrawer> | null
  views: Slot[]
  /**
   * Frames a view may still show, oldest first. Freed explicitly once no view
   * can show them: the GC doesn't see their native memory.
   */
  frames: Frame[]
  frame: number
  last: number | null
  statsStart: number
  statsFrames: number
  updateMs: number
  drawablesMs: number
  drawMs: number
  drawStats: DrawStats
}

export interface Ticker {
  entries: Map<number, Entry>
  running: boolean
  /** When the next frame is due (absolute, so late timer wake-ups don't add up). */
  nextFrameAt: number
  loopStatsStart: number
  loopWorkMs: number
  loopFrames: number
}

export const reportError = (message: string) =>
  console.error('[react-native-live2d-skia] animation stopped:', message)

export function tickerState(): Ticker {
  'worklet'
  const global = globalThis as unknown as { __live2dSkiaTicker?: Ticker }
  if (!global.__live2dSkiaTicker) {
    global.__live2dSkiaTicker = {
      entries: new Map(),
      running: false,
      nextFrameAt: 0,
      loopStatsStart: 0,
      loopWorkMs: 0,
      loopFrames: 0,
    }
  }
  return global.__live2dSkiaTicker
}
