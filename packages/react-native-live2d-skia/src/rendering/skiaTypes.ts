// The part of react-native-skia that this package uses, as structural types, with no import of
// Skia itself. rendering/skia.ts loads the real thing, and scripts/skiaCompat.ts checks every
// supported Skia version against these types.
import type { ComponentType, ReactNode } from 'react'

export interface SkPoint {
  x: number
  y: number
}

export interface SkRect {
  x: number
  y: number
  width: number
  height: number
}

export interface SkShader {
  dispose(): void
}

export interface SkPicture {
  dispose(): void
}

export interface SkVertices {
  dispose(): void
}

export interface SkImage {
  width(): number
  height(): number
  makeShaderOptions(tx: number, ty: number, fm: number, mm: number): SkShader
  dispose(): void
}

export interface SkPaint {
  setAntiAlias(antiAlias: boolean): void
  setAlphaf(alpha: number): void
  setBlendMode(blendMode: number): void
  setShader(shader: SkShader | null): void
}

export interface SkCanvas {
  saveLayer(paint?: SkPaint | null, bounds?: SkRect | null): number
  restore(): void
  drawVertices(vertices: SkVertices, mode: number, paint: SkPaint): void
}

export interface SkPictureRecorder {
  beginRecording(bounds?: SkRect): SkCanvas
  finishRecordingAsPicture(): SkPicture
}

export interface SkData {
  dispose(): void
}

// Skia 3.8 renamed MakeImageFromEncoded to MakeFromEncoded; v2 and older v3 only have the old name.
export type SkImageFactory =
  | { MakeFromEncoded(data: SkData): SkImage | null }
  | { MakeImageFromEncoded(data: SkData): SkImage | null }

export interface SkiaApi {
  XYWHRect(x: number, y: number, width: number, height: number): SkRect
  Paint(): SkPaint
  PictureRecorder(): SkPictureRecorder
  MakeVertices(
    mode: number,
    positions: SkPoint[],
    textures?: SkPoint[] | null,
    colors?: undefined,
    indices?: number[] | null,
  ): SkVertices
  Image: SkImageFactory
  Data: { fromBytes(bytes: Uint8Array): SkData }
}

export interface SkiaModule {
  Skia: SkiaApi
  BlendMode: {
    SrcOver: number
    Dst: number
    DstIn: number
    DstOut: number
    Plus: number
    Multiply: number
  }
  VertexMode: { Triangles: number }
  TileMode: { Clamp: number }
  FilterMode: { Linear: number }
  MipmapMode: { Linear: number }
  Group: ComponentType<{
    transform?: Record<string, number>[]
    children?: ReactNode
  }>
  // A picture or a shared value of one (Reanimated).
  Picture: ComponentType<{ picture: unknown }>
}
