// One animation loop for every <Live2D> on the live2d worklet runtime: each
// frame, every shown model is updated and drawn once, in one pass. Everything
// here runs on that runtime, and its state lives in the runtime's globalThis.
export { addToTicker } from './addToTicker'
export type { Live2DFrameStats, PublishedFrame, TickerModel, TickerView } from './types'
