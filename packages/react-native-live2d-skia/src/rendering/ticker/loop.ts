import { scheduleOnRN } from 'react-native-worklets'
import { now } from '../../utils/clock'
import type { SkPicture } from '../skia'
import {
  CAP_TOLERANCE_MS,
  DEFAULT_FRAME_MS,
  MAX_DELTA_SECONDS,
  MAX_FRAME_MS,
  MAX_FRAMES_AHEAD,
  MIN_FRAME_MS,
  STATS_INTERVAL_MS,
} from './constants'
import { freeFrames, oldestShown, releaseView, stopEntry } from './frames'
import { type Entry, reportError, tickerState } from './state'
import { reportEntry } from './stats'

function drawEntry(entry: Entry, frameStart: number, wantStats: boolean) {
  'worklet'
  const dt = entry.last === null ? 0 : Math.min((frameStart - entry.last) / 1000, MAX_DELTA_SECONDS)
  entry.last = frameStart
  // Timed from here: frameStart is when the whole loop frame began.
  const start = wantStats ? now() : 0
  entry.native.update(dt)
  const updated = wantStats ? now() : 0
  const stats = wantStats ? entry.drawStats : undefined
  let copied = updated
  let picture: SkPicture
  if (entry.nativeDraw) {
    picture = entry.nativeDraw(stats)
  } else {
    const drawables = entry.native.getDrawables()
    copied = wantStats ? now() : 0
    picture = entry.jsDraw!(drawables, stats)
  }
  entry.frame++
  for (const { view } of entry.views) {
    view.target.setBlocking({ frame: entry.frame, picture })
  }
  entry.frames.push({ frame: entry.frame, picture })
  if (wantStats) {
    const end = now()
    entry.statsFrames++
    entry.updateMs += updated - start
    entry.drawablesMs += copied - updated
    entry.drawMs += end - copied
  }
}

/** Updates and draws every model once. Returns the delay until the next frame, or null to stop. */
export function runFrame(): number | null {
  'worklet'
  const ticker = tickerState()
  const frameStart = now()
  let displayMs = 0
  for (const [id, entry] of ticker.entries) {
    const stopped = entry.views.filter((s) => !s.view.running.getDirty())
    if (stopped.length > 0) {
      for (const slot of stopped) releaseView(entry, slot)
      entry.views = entry.views.filter((s) => !stopped.includes(s))
    }
    if (entry.views.length === 0) {
      stopEntry(ticker, id, entry)
      continue
    }
    freeFrames(entry)
    for (const { view } of entry.views) {
      const ms = view.displayMs.getDirty()
      if (ms > 0 && (displayMs === 0 || ms < displayMs)) displayMs = ms
    }
    // The fastest view sets the model's frame rate.
    const capMs = Math.min(...entry.views.map((s) => s.view.capMs))
    if (entry.last !== null && frameStart - entry.last < capMs - CAP_TOLERANCE_MS) {
      continue
    }
    // Wait for a UI thread that's behind, rather than draw frames it won't show.
    if (entry.frame - Math.min(...entry.views.map(oldestShown)) >= MAX_FRAMES_AHEAD) {
      continue
    }
    const wantStats = entry.views.some((s) => s.view.report !== null)
    try {
      drawEntry(entry, frameStart, wantStats)
    } catch (e) {
      // An uncaught error on this runtime aborts the app: drop the model instead.
      for (const slot of entry.views) {
        slot.view.running.setBlocking(false)
        releaseView(entry, slot)
      }
      stopEntry(ticker, id, entry)
      scheduleOnRN(reportError, String((e as Error)?.stack ?? e))
    }
  }

  const end = now()
  ticker.loopWorkMs += end - frameStart
  ticker.loopFrames++
  const interval = Math.min(MAX_FRAME_MS, Math.max(MIN_FRAME_MS, displayMs || DEFAULT_FRAME_MS))
  for (const entry of ticker.entries.values()) {
    const capMs = Math.min(...entry.views.map((s) => s.view.capMs))
    reportEntry(ticker, entry, end, Math.max(interval, capMs))
  }
  if (end - ticker.loopStatsStart >= STATS_INTERVAL_MS) {
    ticker.loopStatsStart = end
    ticker.loopWorkMs = 0
    ticker.loopFrames = 0
  }

  if (ticker.entries.size === 0) {
    ticker.running = false
    return null
  }
  ticker.nextFrameAt += interval
  // More than a frame behind (a stall, or the first frame): start over from now.
  if (ticker.nextFrameAt < end - interval) ticker.nextFrameAt = end + interval
  return Math.max(0, ticker.nextFrameAt - end)
}
