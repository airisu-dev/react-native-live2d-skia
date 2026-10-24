import { scheduleOnRN } from 'react-native-worklets'
import { now } from '../../utils/clock'
import { createDrawer, createNativeDrawer } from '../drawer'
import { runFrame } from './loop'
import { reportError, tickerState } from './state'
import type { TickerModel, TickerView } from './types'

/** Starts showing a model's frames in a view (call on the live2d runtime); stop with `view.running = false`. */
export function addToTicker(model: TickerModel, view: TickerView) {
  'worklet'
  const ticker = tickerState()
  let entry = ticker.entries.get(model.id)
  if (!entry) {
    try {
      const nativeDraw = createNativeDrawer(model.native, model.canvas)
      entry = {
        native: model.native,
        nativeDraw,
        jsDraw: nativeDraw ? null : createDrawer(model.textures, model.shaders, model.canvas),
        views: [],
        frames: [],
        frame: 0,
        last: null,
        statsStart: now(),
        statsFrames: 0,
        updateMs: 0,
        drawablesMs: 0,
        drawMs: 0,
        drawStats: { meshMs: 0, meshesBuilt: 0, layers: 0 },
      }
    } catch (e) {
      view.running.setBlocking(false)
      scheduleOnRN(reportError, String((e as Error)?.stack ?? e))
      return
    }
    ticker.entries.set(model.id, entry)
  }
  entry.views.push({ view, since: entry.frame })
  // Joining a model that's already animating: show its newest frame right away.
  const newest = entry.frames[entry.frames.length - 1]
  if (newest) view.target.setBlocking({ frame: newest.frame, picture: newest.picture })
  if (!ticker.running) {
    ticker.running = true
    ticker.nextFrameAt = 0
    ticker.loopStatsStart = now()
    const loop = () => {
      const delay = runFrame()
      if (delay !== null) setTimeout(loop, delay)
    }
    loop()
  }
}
