import type { SkData, SkImage, SkImageFactory } from './skiaTypes'

/** Null when the data can't be decoded. Throws when this Skia has neither factory method. */
export function decodeImage(factory: SkImageFactory, data: SkData): SkImage | null {
  if ('MakeFromEncoded' in factory && factory.MakeFromEncoded) return factory.MakeFromEncoded(data)
  if ('MakeImageFromEncoded' in factory && factory.MakeImageFromEncoded) {
    return factory.MakeImageFromEncoded(data)
  }
  throw new Error(
    'Live2D: this version of react-native-skia has neither Image.MakeFromEncoded nor Image.MakeImageFromEncoded',
  )
}
