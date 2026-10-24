// Longest step per frame, so returning from the background doesn't jump motions and physics.
export const MAX_DELTA_SECONDS = 0.1
// How far drawing may run ahead of the slowest view's UI thread. Beyond it the
// model waits, e.g. while the app is in the background and the UI thread doesn't draw.
export const MAX_FRAMES_AHEAD = 4
export const DEFAULT_FRAME_MS = 1000 / 60
export const MIN_FRAME_MS = 1000 / 144
export const MAX_FRAME_MS = 1000 / 30
export const STATS_INTERVAL_MS = 1000
// A capped model draws on the first tick at least this close to its interval.
export const CAP_TOLERANCE_MS = 1
