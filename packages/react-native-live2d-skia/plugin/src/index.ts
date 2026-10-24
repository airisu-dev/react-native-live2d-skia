// Expo config plugin: tells the native builds where the Cubism SDK for Native is.
//
//   "plugins": [["@airisu-dev/react-native-live2d-skia", { "cubismSdkPath": "./vendor/CubismSdkForNative" }]]
//
// Cubism Core is proprietary and not shipped: download the SDK with
// `@airisu-dev/react-native-live2d-skia fetch-sdk`, accepting Live2D's license. The path is relative to the app's root.

import {
  type ConfigPlugin,
  createRunOncePlugin,
  withGradleProperties,
  withPodfileProperties,
} from 'expo/config-plugins'
import fs from 'fs'
import path from 'path'

export interface Live2dSkiaPluginProps {
  /** Cubism SDK for Native folder (the one with `cubism-info.yml`), relative to the app's root. */
  cubismSdkPath: string
}

// Read by android/build.gradle and Live2dSkia.podspec.
const SDK_PROPERTY = 'live2dSkia.cubismSdkPath'
const SKIA_PROPERTY = 'live2dSkia.skiaPackage'

// The Skia packages react-native-live2d-skia can draw with in C++, by preference.
const SKIA_PACKAGES = ['react-native-skia', '@shopify/react-native-skia']

const FETCH_HINT =
  'Download it with `@airisu-dev/react-native-live2d-skia fetch-sdk --accept-license` (through npx, bunx, yarn or pnpm).'

const pkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8'),
) as { name: string; version: string }

// Paths are written relative to the native folder, so a prebuilt project
// still builds after it's moved or checked out somewhere else.
const relativeTo = (dir: string, target: string) =>
  path.relative(dir, target).split(path.sep).join('/')

const withLive2dSkia: ConfigPlugin<Live2dSkiaPluginProps | undefined> = (config, props) => {
  const sdkPath = props?.cubismSdkPath
  if (!sdkPath) {
    throw new Error(
      '[react-native-live2d-skia] Set the Cubism SDK for Native folder: ' +
        '["@airisu-dev/react-native-live2d-skia", { "cubismSdkPath": "./vendor/CubismSdkForNative" }]. ' +
        FETCH_HINT,
    )
  }

  const properties = (projectRoot: string, platformProjectRoot: string) => {
    const sdkDir = path.resolve(projectRoot, sdkPath)
    return {
      [SDK_PROPERTY]: relativeTo(platformProjectRoot, sdkDir),
      [SKIA_PROPERTY]: skiaPackageOf(projectRoot),
    }
  }

  config = withGradleProperties(config, (c) => {
    const { projectRoot, platformProjectRoot } = c.modRequest
    warnIfMissing(path.resolve(projectRoot, sdkPath))
    const values = properties(projectRoot, platformProjectRoot)
    c.modResults = c.modResults.filter((item) => !(item.type === 'property' && item.key in values))
    for (const [key, value] of Object.entries(values)) {
      c.modResults.push({ type: 'property', key, value })
    }
    return c
  })

  config = withPodfileProperties(config, (c) => {
    const { projectRoot, platformProjectRoot } = c.modRequest
    Object.assign(c.modResults, properties(projectRoot, platformProjectRoot))
    return c
  })

  return config
}

// The Skia package the app depends on, by its own package.json: in a monorepo
// both can be installed, but an app uses one. Empty when it has neither: the
// native build then leaves out the C++ drawer.
function skiaPackageOf(projectRoot: string): string {
  const appPackage = JSON.parse(
    fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'),
  ) as { dependencies?: Record<string, string> }
  const found = SKIA_PACKAGES.filter((name) => appPackage.dependencies?.[name])
  if (found.length > 1) {
    console.warn(
      `[react-native-live2d-skia] The app depends on both ${found.join(' and ')}: drawing with ${found[0]}. Skia says not to install both.`,
    )
  }
  if (found.length === 0) {
    console.warn(
      `[react-native-live2d-skia] The app depends on neither ${SKIA_PACKAGES.join(' nor ')}. Install one: react-native-live2d-skia draws with Skia.`,
    )
  }
  return found[0] ?? ''
}

// Not an error: CI may fetch the SDK after prebuild. The native build checks again.
function warnIfMissing(sdkDir: string) {
  if (!fs.existsSync(path.join(sdkDir, 'cubism-info.yml'))) {
    console.warn(
      `[react-native-live2d-skia] Cubism SDK for Native not found at ${sdkDir}. ${FETCH_HINT}`,
    )
  }
}

export default createRunOncePlugin(withLive2dSkia, pkg.name, pkg.version)
