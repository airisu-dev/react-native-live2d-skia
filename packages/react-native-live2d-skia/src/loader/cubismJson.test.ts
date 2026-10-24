import { describe, expect, test } from 'bun:test'
import { toCubismJson } from './cubismJson'

describe('toCubismJson', () => {
  test('indents with tabs and puts every value on its own line', () => {
    expect(toCubismJson({ a: 1, b: [2, 3] })).toBe('{\n\t"a": 1,\n\t"b": [\n\t\t2,\n\t\t3\n\t]\n}')
  })

  test('never leaves a number followed by a space, `}` or `]` on the same line', () => {
    const json = toCubismJson({ a: 1, list: [1, 2, 3], nested: { x: 0.5 } })
    expect(json).not.toMatch(/\d[ }\]]/)
  })

  test('writes exponent numbers out in full', () => {
    const json = toCubismJson({ small: 1e-7, smaller: 1.5e-9, negative: -1e-7 })
    expect(json).not.toMatch(/\d[eE]/)
    expect(json).toContain('"small": 0.0000001')
    expect(json).toContain('"smaller": 0.0000000015')
    expect(json).toContain('"negative": -0.0000001')
  })

  test('leaves strings that look like exponent numbers alone', () => {
    expect(toCubismJson({ id: '1e-7', name: 'num:5' })).toBe(
      '{\n\t"id": "1e-7",\n\t"name": "num:5"\n}',
    )
  })

  test('round-trips through JSON.parse', () => {
    const value = {
      Version: 3,
      Meta: { Duration: 1.5, Loop: true, Fade: 1e-7 },
      Curves: [{ Target: 'Parameter', Segments: [0, 1, 0.25, 2, 1e-8] }],
      Empty: null,
    }
    expect(JSON.parse(toCubismJson(value))).toEqual(value)
  })

  test('keeps whole numbers and zero as they are', () => {
    expect(toCubismJson([0, -3, 42])).toBe('[\n\t0,\n\t-3,\n\t42\n]')
  })
})
