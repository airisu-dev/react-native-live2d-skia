import { describe, expect, test } from 'bun:test'
import { affectedAreas, packageJsonAffectsBuild } from './changedAreas'

const LIB = 'packages/react-native-live2d-skia'
const noManifest = () => null

const areas = (...files: string[]) => {
  const { android, ios } = affectedAreas(files, noManifest)
  return { android: android.length > 0, ios: ios.length > 0 }
}

describe('platform code', () => {
  test('Android sources need only the Android build', () => {
    for (const file of [
      `${LIB}/android/build.gradle`,
      `${LIB}/android/CMakeLists.txt`,
      `${LIB}/android/src/main/java/com/live2dskia/Live2dSkiaPackage.kt`,
      `${LIB}/nitrogen/generated/android/Live2dSkiaOnLoad.cpp`,
    ]) {
      expect(areas(file)).toEqual({ android: true, ios: false })
    }
  })

  test('iOS sources and the podspec need only the iOS build', () => {
    for (const file of [
      `${LIB}/ios/Bridge.h`,
      `${LIB}/Live2dSkia.podspec`,
      `${LIB}/nitrogen/generated/ios/Live2dSkiaAutolinking.swift`,
    ]) {
      expect(areas(file)).toEqual({ android: false, ios: true })
    }
  })
})

describe('shared native code', () => {
  test('C++, the Nitro config and specs, the plugin and the CLI need both', () => {
    for (const file of [
      `${LIB}/cpp/drawing/SkiaDrawer.cpp`,
      `${LIB}/cpp/hybrid/HybridLive2DModel.hpp`,
      `${LIB}/nitro.json`,
      `${LIB}/nitrogen/generated/shared/c++/HybridLive2DModelSpec.hpp`,
      `${LIB}/src/specs/react-native-live2d-skia.nitro.ts`,
      `${LIB}/plugin/src/index.ts`,
      `${LIB}/app.plugin.js`,
      `${LIB}/cli/src/index.ts`,
      'apps/app/app.json',
      'apps/app-skia2/app.json',
      'bun.lock',
      'scripts/fetch-cubism-sdk.sh',
      '.github/workflows/test-build.yml',
    ]) {
      expect(areas(file)).toEqual({ android: true, ios: true })
    }
  })
})

describe('changes that need no native build', () => {
  test('JavaScript, tests, docs and other workflows', () => {
    for (const file of [
      `${LIB}/src/components/Live2D.tsx`,
      `${LIB}/src/loader/loadModel.ts`,
      `${LIB}/src/rendering/ticker/loop.ts`,
      `${LIB}/src/loader/cubismJson.test.ts`,
      `${LIB}/plugin/src/index.test.ts`,
      `${LIB}/cli/src/index.test.ts`,
      `${LIB}/scripts/verifyPackage.ts`,
      `${LIB}/tsconfig.json`,
      `${LIB}/README.md`,
      'packages/demo/src/DemoScreen.tsx',
      'apps/app/src/app/index.tsx',
      'apps/app/metro.config.js',
      'README.md',
      'RELEASING.md',
      '.github/workflows/check.yml',
      '.github/workflows/release.yml',
    ]) {
      expect(areas(file)).toEqual({ android: false, ios: false })
    }
  })

  test('a mix is decided file by file, and lists the files that need each build', () => {
    const { android, ios } = affectedAreas(
      [`${LIB}/android/build.gradle`, `${LIB}/src/index.ts`, `${LIB}/ios/Bridge.h`],
      noManifest,
    )
    expect(android).toEqual([`${LIB}/android/build.gradle`])
    expect(ios).toEqual([`${LIB}/ios/Bridge.h`])
  })
})

describe('package.json', () => {
  const manifest = {
    name: '@airisu-dev/react-native-live2d-skia',
    version: '0.1.0',
    scripts: { test: 'bun test' },
    dependencies: { a: '1.0.0', b: '2.0.0' },
    cubismSdk: { latest: '5-r.5', versions: { '5-r.5': { sha256: 'x' } } },
  }

  test('scripts, version and metadata do not matter', () => {
    expect(
      packageJsonAffectsBuild(manifest, {
        ...manifest,
        version: '0.2.0',
        scripts: { test: 'bun test', 'verify:package': 'bun scripts/verifyPackage.ts' },
        description: 'new',
        files: ['src'],
      }),
    ).toBe(false)
  })

  test('the order of keys does not matter', () => {
    expect(
      packageJsonAffectsBuild(manifest, {
        cubismSdk: manifest.cubismSdk,
        dependencies: { b: '2.0.0', a: '1.0.0' },
        name: manifest.name,
        version: manifest.version,
        scripts: manifest.scripts,
      }),
    ).toBe(false)
  })

  test('a dependency, the name or the supported SDK versions do matter', () => {
    expect(
      packageJsonAffectsBuild(manifest, { ...manifest, dependencies: { a: '1.1.0', b: '2.0.0' } }),
    ).toBe(true)
    expect(packageJsonAffectsBuild(manifest, { ...manifest, name: 'other' })).toBe(true)
    expect(
      packageJsonAffectsBuild(manifest, {
        ...manifest,
        cubismSdk: { latest: '5-r.6', versions: manifest.cubismSdk.versions },
      }),
    ).toBe(true)
  })

  test('an added or deleted package.json matters', () => {
    expect(packageJsonAffectsBuild(null, manifest)).toBe(true)
    expect(packageJsonAffectsBuild(manifest, null)).toBe(true)
  })

  test('is read for the root, library and app package.json files', () => {
    const changed = (file: string) =>
      affectedAreas([file], (_f, side) =>
        side === 'before' ? manifest : { ...manifest, name: 'x' },
      )
    const same = (file: string) =>
      affectedAreas([file], (_f, side) =>
        side === 'before' ? manifest : { ...manifest, version: '9.9.9' },
      )
    for (const file of [
      'package.json',
      `${LIB}/package.json`,
      'apps/app/package.json',
      'packages/demo/package.json',
    ]) {
      expect(changed(file).android).toEqual([file])
      expect(changed(file).ios).toEqual([file])
      expect(same(file)).toEqual({ android: [], ios: [] })
    }
  })
})
