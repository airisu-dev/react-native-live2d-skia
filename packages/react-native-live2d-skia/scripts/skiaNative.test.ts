import { describe, expect, test } from 'bun:test'
import {
  bindingSymbols,
  definedSymbols,
  deprecationsOf,
  describeDrift,
  diffBindings,
  hasDrifted,
  libPackageOf,
  missingFromLib,
} from './skiaNative'

const NM_UNDEFINED = `
                 U SkCanvas::restore()
                 U SkCanvas::saveLayer(SkRect const*, SkPaint const*)
                 U SkPaint::setAlphaf(float)
                 U RNSkia::JsiSkShader::getObject()
                 U __cxa_atexit
                 U operator delete(void*)
                 U std::__ndk1::basic_string<char>::~basic_string()
                 U SkCanvas::restore()
`

describe('bindingSymbols', () => {
  test('keeps the Skia functions, sorted and without duplicates', () => {
    expect(bindingSymbols(NM_UNDEFINED)).toEqual([
      'RNSkia::JsiSkShader::getObject()',
      'SkCanvas::restore()',
      'SkCanvas::saveLayer(SkRect const*, SkPaint const*)',
      'SkPaint::setAlphaf(float)',
    ])
  })

  test('skips the C and C++ runtime, which is not Skia', () => {
    const symbols = bindingSymbols(NM_UNDEFINED)
    expect(
      symbols.some((s) => s.includes('__cxa') || s.includes('std::') || s.includes('operator')),
    ).toBe(false)
  })

  test('is empty for no output', () => {
    expect(bindingSymbols('')).toEqual([])
  })
})

describe('diffBindings', () => {
  const baseline = ['SkCanvas::saveLayer(SkRect const*, SkPaint const*)', 'SkCanvas::restore()']

  test('no change is no drift', () => {
    expect(hasDrifted(diffBindings(baseline, [...baseline].reverse()))).toBe(false)
  })

  test('a call that now binds to another overload is one removed and one added', () => {
    const actual = ['SkCanvas::saveLayer(SkCanvas::SaveLayerRec const&)', 'SkCanvas::restore()']
    const drift = diffBindings(baseline, actual)
    expect(drift.removed).toEqual(['SkCanvas::saveLayer(SkRect const*, SkPaint const*)'])
    expect(drift.added).toEqual(['SkCanvas::saveLayer(SkCanvas::SaveLayerRec const&)'])
    expect(hasDrifted(drift)).toBe(true)
  })

  test('a function we newly call is an addition', () => {
    expect(diffBindings(baseline, [...baseline, 'SkPaint::setColor(unsigned int)']).added).toEqual([
      'SkPaint::setColor(unsigned int)',
    ])
  })

  test('describeDrift names each function', () => {
    const text = describeDrift(diffBindings(baseline, ['SkCanvas::restore()', 'SkCanvas::save()']))
    expect(text).toContain('newly needed: SkCanvas::save()')
    expect(text).toContain('no longer needed')
    expect(text).toContain('SkCanvas::saveLayer(SkRect const*, SkPaint const*)')
  })
})

describe('deprecationsOf', () => {
  const output = [
    "/home/runner/work/r/r/packages/p/cpp/drawing/SkiaDrawer.cpp:83:9: warning: 'saveLayer' is deprecated: use SaveLayerRec [-Wdeprecated-declarations]",
    "/home/runner/work/r/r/node_modules/react-native-skia/cpp/skia/include/core/SkCanvas.h:10:2: warning: 'old' is deprecated [-Wdeprecated-declarations]",
    '/home/runner/work/r/r/packages/p/cpp/drawing/MeshCache.cpp:5:1: warning: unused variable [-Wunused-variable]',
    "/home/runner/work/r/r/packages/p/cpp/drawing/SkiaDrawer.cpp:83:9: warning: 'saveLayer' is deprecated: use SaveLayerRec [-Wdeprecated-declarations]",
  ].join('\n')

  test('keeps the deprecations in our code, without the machine path, once each', () => {
    expect(deprecationsOf(output)).toEqual([
      "cpp/drawing/SkiaDrawer.cpp:83:9: warning: 'saveLayer' is deprecated: use SaveLayerRec",
    ])
  })

  test("ignores warnings inside Skia's own headers, and other kinds of warning", () => {
    const found = deprecationsOf(output).join('\n')
    expect(found).not.toContain('SkCanvas.h')
    expect(found).not.toContain('unused variable')
  })

  test('is empty for a clean build', () => {
    expect(deprecationsOf('')).toEqual([])
  })
})

describe('library check', () => {
  const nm = `
libskia.a(SkCanvas.o):
0000000000000010 T SkCanvas::restore()
0000000000000200 T SkCanvas::saveLayer(SkRect const*, SkPaint const*)
0000000000000300 W SkPaint::setAlphaf(float)
                 U SkCanvas::notDefinedHere()
`

  test('reads the defined functions, including weak ones, and not the undefined', () => {
    const defined = definedSymbols(nm)
    expect(defined.has('SkCanvas::restore()')).toBe(true)
    expect(defined.has('SkPaint::setAlphaf(float)')).toBe(true)
    expect(defined.has('SkCanvas::notDefinedHere()')).toBe(false)
  })

  test('lists what the library lacks, and leaves RNSkia out', () => {
    const missing = missingFromLib(
      [
        'RNSkia::JsiSkShader::getObject()',
        'SkCanvas::restore()',
        'SkCanvas::saveLayer(SkRect const*, SkPaint const*, int)',
      ],
      definedSymbols(nm),
    )
    expect(missing).toEqual(['SkCanvas::saveLayer(SkRect const*, SkPaint const*, int)'])
  })

  test('finds the library package of a v3 and a v2 release', () => {
    expect(
      libPackageOf({
        dependencies: {
          'canvaskit-wasm': '0.41.1',
          'react-native-skia-graphite-android': '157.0.0',
        },
      }),
    ).toEqual({ name: 'react-native-skia-graphite-android', version: '157.0.0' })
    expect(libPackageOf({ dependencies: { 'react-native-skia-android': '154.0.0' } })).toEqual({
      name: 'react-native-skia-android',
      version: '154.0.0',
    })
  })

  test('is null when the release names no library package', () => {
    expect(libPackageOf({ dependencies: { 'canvaskit-wasm': '0.41.1' } })).toBeNull()
    expect(libPackageOf({})).toBeNull()
  })
})
