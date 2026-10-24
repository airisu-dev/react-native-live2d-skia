import type { Synchronizable } from 'react-native-worklets'
import type { Live2DModel as NativeModel } from '../../specs/react-native-live2d-skia.nitro'
import type { CanvasInfo } from '../drawer'
import type { SkImage, SkPicture, SkShader } from '../skia'

/** Averages per frame over the last second, in milliseconds unless noted. */
export interface Live2DFrameStats {
  fps: number
  /** The frame rate the loop aims for: the display's refresh rate, or `maxFps`. */
  targetFps: number
  /** All work for this model's frame on the animation thread. */
  workMs: number
  /** Motions, physics and so on in C++ (`update`). */
  updateMs: number
  /** Copying vertex data out of C++ (`getDrawables`). 0 when drawn in C++. */
  drawablesMs: number
  /** Recording the picture, including `meshMs`. */
  drawMs: number
  /** Building Skia vertices for drawables that moved. */
  meshMs: number
  /** Meshes rebuilt per frame (a count). */
  meshesBuilt: number
  /**
   * Mask layers per frame (a count). Their cost is in the UI thread's Skia
   * draw, which these stats don't cover.
   */
  layers: number
  /** Models animated by the loop, this one included (a count). */
  models: number
  /** All work for a frame of the loop, every model included. */
  loopWorkMs: number
}

/** A newly drawn frame, for the UI thread to pick up. */
export type PublishedFrame = { frame: number; picture: SkPicture } | null

export interface TickerView {
  target: Synchronizable<PublishedFrame>
  /** The frame the UI thread shows (-1 before the first). Frames are freed once every view is past them. */
  shown: Synchronizable<number>
  /** Set to false to stop showing frames here. */
  running: Synchronizable<boolean>
  /** The display's frame interval, measured on the UI thread; 0 until known. */
  displayMs: Synchronizable<number>
  /** Shortest frame time for this view (`maxFps`); 0 for no cap. */
  capMs: number
  /** Gets frame stats about once a second; null if not wanted. */
  report: ((stats: Live2DFrameStats) => void) | null
}

export interface TickerModel {
  id: number
  native: NativeModel
  textures: SkImage[]
  shaders: SkShader[]
  canvas: CanvasInfo
}
