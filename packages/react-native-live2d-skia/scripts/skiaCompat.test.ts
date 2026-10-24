import { describe, expect, test } from 'bun:test'
import {
  clangArgs,
  compareVersions,
  minVersionOf,
  nativeFlavor,
  parseTarget,
  selectVersions,
  typeCheckSource,
} from './skiaCompat'

describe('compareVersions', () => {
  test('compares numbers, not text', () => {
    expect(compareVersions('3.10.0', '3.9.0')).toBeGreaterThan(0)
    expect(compareVersions('2.14.0', '2.9.9')).toBeGreaterThan(0)
    expect(compareVersions('3.3.0', '3.3.0')).toBe(0)
    expect(compareVersions('2.99.99', '3.0.0')).toBeLessThan(0)
  })
})

describe('minVersionOf', () => {
  test('reads a >= range', () => {
    expect(minVersionOf('>=3.3.0')).toBe('3.3.0')
    expect(minVersionOf(' >= 2.10.0 ')).toBe('2.10.0')
  })

  test('refuses a range it does not understand, so the check never silently covers nothing', () => {
    for (const range of ['*', '^3.3.0', '3.3.0', '>=3.3', '>3.3.0']) {
      expect(() => minVersionOf(range)).toThrow("Can't read the Skia peer range")
    }
  })
})

describe('selectVersions', () => {
  const all = [
    '0.0.1',
    '2.15.2',
    '3.2.0',
    '3.3.0',
    '3.10.0',
    '3.4.0',
    '3.5.0-beta.1',
    '4.0.0',
    '4.0.0-rc.1',
  ]

  test('keeps the stable versions from the minimum up, oldest first', () => {
    expect(selectVersions(all, '3.3.0')).toEqual(['3.3.0', '3.4.0', '3.10.0', '4.0.0'])
  })

  test('includes releases of a later major, which the peer range also allows', () => {
    expect(selectVersions(all, '3.3.0')).toContain('4.0.0')
  })

  test('skips prereleases and versions below the minimum', () => {
    const picked = selectVersions(all, '3.3.0')
    expect(picked).not.toContain('3.5.0-beta.1')
    expect(picked).not.toContain('4.0.0-rc.1')
    expect(picked).not.toContain('3.2.0')
  })

  test('is empty when nothing qualifies', () => {
    expect(selectVersions(['1.0.0'], '3.3.0')).toEqual([])
  })
})

describe('packages', () => {
  test('react-native-skia is the Graphite renderer and @shopify/react-native-skia is Ganesh', () => {
    expect(nativeFlavor('react-native-skia')).toBe('graphite')
    expect(nativeFlavor('@shopify/react-native-skia')).toBe('ganesh')
  })

  test('parseTarget splits package and version, including a scoped package', () => {
    expect(parseTarget('react-native-skia@3.8.0')).toEqual({
      pkg: 'react-native-skia',
      version: '3.8.0',
    })
    expect(parseTarget('@shopify/react-native-skia@2.14.0')).toEqual({
      pkg: '@shopify/react-native-skia',
      version: '2.14.0',
    })
    expect(() => parseTarget('left-pad@1.0.0')).toThrow("isn't <package>@<version>")
    expect(() => parseTarget('react-native-skia')).toThrow("isn't <package>@<version>")
  })
})

describe('typeCheckSource', () => {
  const source = typeCheckSource('react-native-skia', '../../src/rendering/skiaTypes')

  test('imports the real package and our types', () => {
    expect(source).toContain("import * as Real from 'react-native-skia'")
    expect(source).toContain("import type { SkiaModule } from '../../src/rendering/skiaTypes'")
  })

  test('assigns every part Skia must provide, one statement each', () => {
    for (const part of [
      'Skia',
      'BlendMode',
      'VertexMode',
      'TileMode',
      'FilterMode',
      'MipmapMode',
    ]) {
      expect(source).toContain(`SkiaModule['${part}'] = Real.${part}`)
    }
    expect(source).toContain('Real.Group')
    expect(source).toContain('Real.Picture')
  })
})

describe('clangArgs', () => {
  const base = {
    lib: '/repo/lib',
    cubismSdk: '/sdk',
    skiaDir: '/skia',
    reactNative: '/rn',
    source: '/repo/lib/cpp/drawing/SkiaDrawer.cpp',
    exists: () => true,
  }

  test('compiles for Android, syntax only, with the Cubism version the code requires', () => {
    const args = clangArgs({ ...base, flavor: 'graphite' })
    expect(args).toContain('--target=aarch64-linux-android24')
    expect(args).toContain('-fsyntax-only')
    expect(args).toContain('-DLIVE2D_SKIA=1')
    expect(args).toContain('-DLIVE2D_SKIA_CUBISM_SDK=50500')
    expect(args.at(-1)).toBe(base.source)
  })

  test('Graphite (react-native-skia) defines SK_GRAPHITE and includes Dawn', () => {
    const args = clangArgs({ ...base, flavor: 'graphite' })
    expect(args).toContain('-DSK_GRAPHITE')
    expect(args).not.toContain('-DSK_GANESH')
    expect(args).toContain('-I/skia/cpp/dawn/include')
  })

  test('Ganesh (@shopify/react-native-skia) defines SK_GL and SK_GANESH, with no Dawn', () => {
    const args = clangArgs({ ...base, flavor: 'ganesh' })
    expect(args).toContain('-DSK_GL')
    expect(args).toContain('-DSK_GANESH')
    expect(args).not.toContain('-DSK_GRAPHITE')
    expect(args).not.toContain('-I/skia/cpp/dawn/include')
  })

  test('takes the Skia, React Native and Cubism headers, and skips include folders a version lacks', () => {
    const args = clangArgs({
      ...base,
      flavor: 'graphite',
      exists: (dir) => !dir.endsWith('rnskia-android'),
    })
    expect(args).toContain('-I/skia/cpp/api')
    expect(args).toContain('-I/rn/ReactCommon/jsi')
    expect(args).toContain('-I/sdk/Core/include')
    expect(args).not.toContain('-I/skia/android/cpp/rnskia-android')
  })
})
