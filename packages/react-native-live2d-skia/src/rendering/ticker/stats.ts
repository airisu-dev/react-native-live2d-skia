import { scheduleOnRN } from 'react-native-worklets'
import { STATS_INTERVAL_MS } from './constants'
import type { Entry, Ticker } from './state'
import type { Live2DFrameStats } from './types'

export function reportEntry(ticker: Ticker, entry: Entry, at: number, frameMs: number) {
  'worklet'
  const elapsed = at - entry.statsStart
  if (elapsed < STATS_INTERVAL_MS || entry.statsFrames === 0) return
  const n = entry.statsFrames
  const s = entry.drawStats
  const stats: Live2DFrameStats = {
    fps: (n * 1000) / elapsed,
    targetFps: 1000 / frameMs,
    workMs: (entry.updateMs + entry.drawablesMs + entry.drawMs) / n,
    updateMs: entry.updateMs / n,
    drawablesMs: entry.drawablesMs / n,
    drawMs: entry.drawMs / n,
    meshMs: s.meshMs / n,
    meshesBuilt: s.meshesBuilt / n,
    layers: s.layers / n,
    models: ticker.entries.size,
    loopWorkMs: ticker.loopFrames > 0 ? ticker.loopWorkMs / ticker.loopFrames : 0,
  }
  for (const { view } of entry.views) {
    if (view.report) scheduleOnRN(view.report, stats)
  }
  entry.statsStart = at
  entry.statsFrames = 0
  entry.updateMs = 0
  entry.drawablesMs = 0
  entry.drawMs = 0
  s.meshMs = 0
  s.meshesBuilt = 0
  s.layers = 0
}
