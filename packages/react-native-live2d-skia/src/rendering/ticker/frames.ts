import type { Entry, Slot, Ticker } from './state'

// The oldest frame a view may be showing.
export function oldestShown(slot: Slot) {
  'worklet'
  const shown = slot.view.shown.getDirty()
  return shown >= 0 ? shown : slot.since
}

// A view stopped (paused or unmounted) but keeps showing its last frame, and
// its UI thread may still take a newer one already published. Those frames are
// handed over to it: dropped from the entry unfreed, for the GC to collect.
export function releaseView(entry: Entry, slot: Slot) {
  'worklet'
  const oldest = oldestShown(slot)
  entry.frames = entry.frames.filter((f) => f.frame < oldest)
}

// Frees frames older than every view's shown frame, keeping one more: the JS
// thread may have just read the shown picture for a redraw.
export function freeFrames(entry: Entry) {
  'worklet'
  const keepFrom = Math.min(...entry.views.map(oldestShown)) - 1
  while (entry.frames.length > 0 && entry.frames[0]!.frame < keepFrom) {
    entry.frames.shift()!.picture.dispose()
  }
}

export function stopEntry(ticker: Ticker, id: number, entry: Entry) {
  'worklet'
  // Its views are released: no view can show what's left.
  for (const f of entry.frames) f.picture.dispose()
  entry.frames = []
  ticker.entries.delete(id)
}
