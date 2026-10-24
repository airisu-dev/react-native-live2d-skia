import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { nativeProperties, skiaPackageOf, warnIfMissing, withLive2dSkia } from './index'

let dir: string
let warn: ReturnType<typeof spyOn<typeof console, 'warn'>>

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'live2d-plugin-'))
  warn = spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  warn.mockRestore()
  fs.rmSync(dir, { recursive: true, force: true })
})

function appWith(dependencies: Record<string, string>) {
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ dependencies }))
  return dir
}

describe('skiaPackageOf', () => {
  test('finds react-native-skia (v3)', () => {
    expect(skiaPackageOf(appWith({ 'react-native-skia': '^3.0.0' }))).toBe('react-native-skia')
    expect(warn).not.toHaveBeenCalled()
  })

  test('finds @shopify/react-native-skia (v2)', () => {
    expect(skiaPackageOf(appWith({ '@shopify/react-native-skia': '^2.10.0' }))).toBe(
      '@shopify/react-native-skia',
    )
    expect(warn).not.toHaveBeenCalled()
  })

  test('prefers v3 and warns when the app depends on both', () => {
    const root = appWith({ 'react-native-skia': '^3.0.0', '@shopify/react-native-skia': '^2.10.0' })
    expect(skiaPackageOf(root)).toBe('react-native-skia')
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('depends on both')
  })

  test('returns an empty string and warns when the app has neither', () => {
    expect(skiaPackageOf(appWith({ react: '19.0.0' }))).toBe('')
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('depends on neither')
  })

  test('ignores devDependencies-free apps with no dependencies field', () => {
    fs.writeFileSync(path.join(dir, 'package.json'), '{}')
    expect(skiaPackageOf(dir)).toBe('')
  })
})

describe('nativeProperties', () => {
  test('writes the SDK folder relative to the native project, with forward slashes', () => {
    const root = appWith({ 'react-native-skia': '^3.0.0' })
    expect(
      nativeProperties(root, path.join(root, 'android'), './vendor/CubismSdkForNative'),
    ).toEqual({
      'live2dSkia.cubismSdkPath': '../vendor/CubismSdkForNative',
      'live2dSkia.skiaPackage': 'react-native-skia',
    })
  })

  test('works for an SDK folder outside the app, as in a monorepo', () => {
    const root = appWith({ '@shopify/react-native-skia': '^2.10.0' })
    expect(
      nativeProperties(root, path.join(root, 'ios'), '../shared/vendor/CubismSdkForNative'),
    ).toEqual({
      'live2dSkia.cubismSdkPath': '../../shared/vendor/CubismSdkForNative',
      'live2dSkia.skiaPackage': '@shopify/react-native-skia',
    })
  })
})

describe('warnIfMissing', () => {
  test('warns when the folder has no cubism-info.yml', () => {
    warnIfMissing(dir)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('not found')
    expect(String(warn.mock.calls[0]?.[0])).toContain('fetch-sdk')
  })

  test('is quiet when the SDK is there', () => {
    fs.writeFileSync(path.join(dir, 'cubism-info.yml'), 'version: 5-r.5\n')
    warnIfMissing(dir)
    expect(warn).not.toHaveBeenCalled()
  })
})

describe('withLive2dSkia', () => {
  test('throws without cubismSdkPath, naming the scoped package', () => {
    for (const props of [undefined, { cubismSdkPath: '' }]) {
      expect(() => withLive2dSkia({ name: 'app', slug: 'app' }, props)).toThrow(
        /@airisu-dev\/react-native-live2d-skia/,
      )
    }
  })

  test('registers the Android and iOS mods', () => {
    const config = withLive2dSkia(
      { name: 'app', slug: 'app' },
      { cubismSdkPath: './vendor/CubismSdkForNative' },
    ) as { mods?: { android?: Record<string, unknown>; ios?: Record<string, unknown> } }
    expect(typeof config.mods?.android?.gradleProperties).toBe('function')
    expect(typeof config.mods?.ios?.podfileProperties).toBe('function')
  })
})
