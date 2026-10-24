import { describe, expect, mock, test } from 'bun:test'
import { decodeImage } from './decodeImage'
import type { SkData, SkImage } from './skiaTypes'

const data = { dispose() {} } as SkData
const image = { width: () => 1 } as unknown as SkImage

describe('decodeImage', () => {
  test('uses MakeFromEncoded (Skia 3.8 and later)', () => {
    const MakeFromEncoded = mock(() => image)
    expect(decodeImage({ MakeFromEncoded }, data)).toBe(image)
    expect(MakeFromEncoded).toHaveBeenCalledWith(data)
  })

  test('uses MakeImageFromEncoded (Skia v2 and v3 before 3.8)', () => {
    const MakeImageFromEncoded = mock(() => image)
    expect(decodeImage({ MakeImageFromEncoded }, data)).toBe(image)
    expect(MakeImageFromEncoded).toHaveBeenCalledWith(data)
  })

  test('prefers MakeFromEncoded when both exist', () => {
    const MakeFromEncoded = mock(() => image)
    const MakeImageFromEncoded = mock(() => null)
    expect(decodeImage({ MakeFromEncoded, MakeImageFromEncoded }, data)).toBe(image)
    expect(MakeImageFromEncoded).not.toHaveBeenCalled()
  })

  test('a failed decode is null, not a reason to try the other method', () => {
    const MakeFromEncoded = mock(() => null)
    const MakeImageFromEncoded = mock(() => image)
    expect(decodeImage({ MakeFromEncoded, MakeImageFromEncoded }, data)).toBeNull()
    expect(MakeImageFromEncoded).not.toHaveBeenCalled()
  })

  test('says what is missing when Skia has neither method', () => {
    expect(() => decodeImage({} as never, data)).toThrow(
      'neither Image.MakeFromEncoded nor Image.MakeImageFromEncoded',
    )
  })

  test('calls the method on its factory, as the Skia host functions expect', () => {
    const factory = {
      marker: 'factory',
      MakeFromEncoded(this: { marker: string }) {
        return this.marker === 'factory' ? image : null
      },
    }
    expect(decodeImage(factory as never, data)).toBe(image)
  })
})
