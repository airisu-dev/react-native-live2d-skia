# react-native-live2d-skia

Live2D Cubism models rendered natively in React Native with Skia. No WebView, a hooks API in the style of `pixi-live2d-display`, and one shared C++ codebase for iOS and Android.

[![Version](https://img.shields.io/npm/v/@airisu-dev/react-native-live2d-skia.svg)](https://www.npmjs.com/package/@airisu-dev/react-native-live2d-skia)
[![Downloads](https://img.shields.io/npm/dm/@airisu-dev/react-native-live2d-skia.svg)](https://www.npmjs.com/package/@airisu-dev/react-native-live2d-skia)
[![License](https://img.shields.io/npm/l/@airisu-dev/react-native-live2d-skia.svg)](https://github.com/airisu-dev/react-native-live2d-skia/blob/main/LICENSE)

Cubism Core and the Cubism Native Framework only run the model (motions, physics, expressions). Each drawable is drawn with Skia's `drawVertices`, so Skia picks the GPU backend: Metal on iOS, Vulkan or OpenGL on Android.

## Requirements

- Expo with development builds (`expo prebuild`). The React Native CLI isn't supported.
- React Native 0.78 or higher (Nitro Views), Node 18 or higher.
- Skia, either version:

| Skia | Package                              | Renderer                 |
| ---- | ------------------------------------ | ------------------------ |
| v3   | `react-native-skia` (3.3+)           | Graphite (Vulkan, Metal) |
| v2   | `@shopify/react-native-skia` (2.10+) | Ganesh (OpenGL, Metal)   |

## Installation

### 1. Install the packages

```bash
npx expo install @airisu-dev/react-native-live2d-skia react-native-nitro-modules react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-asset expo-file-system
```

Install one Skia package, not both. For v2, install `@shopify/react-native-skia` instead of `react-native-skia`, at 2.10 or later: `expo install` can pick an older version (2.6.2 for SDK 57), which hands Skia objects to C++ differently. Pin a newer one, e.g. `npx expo install @shopify/react-native-skia@2.14.0`. The config plugin reads which one the app depends on.

The app needs a `GestureHandlerRootView` at its root.

### 2. Configure Metro

Models are bundled as assets. Add `moc3` to Metro's `assetExts` in `metro.config.js` (create it with `npx expo customize metro.config.js` if the app has none):

```js
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// Bundle Live2D model data as assets.
config.resolver.assetExts.push('moc3')

module.exports = config
```

The model's JSON files (`model3.json`, motions, physics, expressions) and textures bundle with Expo's defaults. Models loaded from a URL don't need this.

### 3. Get the Cubism SDK for Native

The package doesn't include Live2D's Cubism SDK: its Core is proprietary, and each app downloads it from Live2D, accepting
[Live2D's license terms](https://www.live2d.com/eula/live2d-proprietary-software-license-agreement_en.html).
1. Download it (it's checked against a SHA-256):

   ```bash
   npx @airisu-dev/react-native-live2d-skia fetch-sdk --accept-license   # or bunx, yarn, pnpm
   ```

   It extracts to `./vendor/CubismSdkForNative` (change it with `--out`). Add `/vendor/` to `.gitignore`, so it's never in a public repo. On EAS Build, run the same command in an `eas-build-post-install` script.

2. Point the config plugin at it, in `app.json`:

   ```json
   "plugins": [["@airisu-dev/react-native-live2d-skia", { "cubismSdkPath": "./vendor/CubismSdkForNative" }]]
   ```

3. Run `npx expo prebuild`, then build. A missing or unsupported SDK stops the build with the path it looked at.

Publishing an app built on the SDK may also need Live2D's
[Cubism SDK Release License](https://www.live2d.com/en/sdk/license/) (businesses above 10M JPY a year).

## Usage

```tsx
import { Canvas } from '@shopify/react-native-skia' // or 'react-native-skia'
import { GestureDetector } from 'react-native-gesture-handler'
import { Live2D, useLive2DGesture, useLive2DModel } from '@airisu-dev/react-native-live2d-skia'

export function Mao() {
  // A require.context of the model's folder: the files its model3.json lists are loaded from it.
  const { model, error, loading, retry } = useLive2DModel(
    require.context('./Mao', true, /\.(json|moc3|png)$/),
  )
  const gesture = useLive2DGesture(model, { x: 0, y: 0, scale: 0.4 })

  return (
    <GestureDetector gesture={gesture}>
      <Canvas style={{ flex: 1 }}>
        <Live2D model={model} x={0} y={0} scale={0.4} />
      </Canvas>
    </GestureDetector>
  )
}
```

`useLive2DModel` loads once on mount and doesn't throw. The source is read once, so remount the component (e.g. change its `key`) to switch models. The canvas is an ordinary view: size it with styles. Models are drawn at the `x`, `y` and `scale` they're given and clipped to the canvas, so fit them to the measured size.

A tap runs the model's reaction (a `Tap<area>` motion, or an expression for `Head`), and a drag makes it look at the finger.

### Loading from a URL

```tsx
const { model, error, retry } = useLive2DModel(
  'https://example.com/haru/haru_greeter_t03.model3.json',
)
```

A string is the URL of a `model3.json`. The files it lists are resolved relative to it, and spaces in file names are escaped.
- Every file (JSON, moc, textures) is fetched in parallel with `expo/fetch`. The only caching is the platform's HTTP cache, so a persistent offline copy is up to the app.
- Motion sounds are ignored.
- A failed fetch ends up in `error` as `Live2D: failed to fetch <url> (<status>)`, and network errors (e.g. offline) come through the same way. `retry()` tries again. URLs in error messages never include their query, so tokens don't leak into the UI or logs.
- Cubism 2 models (`model.json`, `.moc`) can't be loaded: Cubism Core 5 only reads `.moc3`.

#### Protected models

```tsx
// 1. A token in the query: reused for every file on the same host.
useLive2DModel('https://cdn.example.com/haru/haru.model3.json?token=abc')

// 2. Headers: sent with every request.
useLive2DModel(url, { headers: { Authorization: `Bearer ${token}` } })

// 3. A signature per file (e.g. S3 presigned URLs): sign each one yourself.
useLive2DModel(signedModel3Url, {
  resolveUrl: (url, file) => api.sign(url), // may return a promise
})
```

Options are read once, like the source, and `retry()` reuses them. To load with a fresh token, remount. `resolveUrl` runs on every load, so it can fetch fresh signatures.

### Loading from files

Pass the files yourself as a `Live2DModelSource`:

```tsx
useLive2DModel({
  settings: require('./Mao/Mao.model3.json'),
  moc: require('./Mao/Mao.moc3'),
  textures: [require('./Mao/Mao.2048/texture_00.png')],
  physics: require('./Mao/Mao.physics3.json'),
  motions: { Idle: [require('./Mao/motions/idle.motion3.json')] },
})
```

### Several models in one canvas

```tsx
const gesture = useLive2DGestures([
  { model: hiyori, ...hiyoriPlace, onMove: (x, y) => moveHiyori(x, y) },
  { model: mao, ...maoPlace, onMove: (x, y) => moveMao(x, y) },
])

<GestureDetector gesture={gesture}>
  <Canvas style={{ flex: 1 }}>
    <Rect … />                              {/* behind the models */}
    <Live2D model={hiyori} {...hiyoriPlace} />
    <Live2D model={mao} {...maoPlace} />
    <RoundedRect … />                       {/* over the models */}
  </Canvas>
</GestureDetector>
```

Inside a `<Canvas>`, JSX order is drawing order: a `<Live2D>` is one layer among ordinary Skia shapes. One animation loop updates and draws every shown model each frame, and two `<Live2D>`s showing the same model share its frames.

### Controlling the model

Points are in model pixels: the model's canvas at its native size (`model.width` x `model.height`), origin top-left.

```ts
model.motion('TapBody') // random motion of a group
model.motion('TapBody', 0, 'force') // given motion and priority (idle / normal / force)
model.expression('exp_01') // expression; random without a name
model.resetExpression()
model.setParameter('ParamAngleX', 30) // held over motions until resetParameter
model.resetParameter('ParamAngleX')
model.focus(x, y) // look at a point, easing
model.resetFocus()
model.hitTest(x, y) // → ['Head']
```

Methods can be called from the JS thread while the model animates on its background thread: the native model is locked.

## API

### `useLive2DModel(source, options?)`

`source` is a `require.context` of the model's folder, a `Live2DModelSource`, or the URL of a `model3.json`. It returns:

| Field     | Description                                                      |
| --------- | ---------------------------------------------------------------- |
| `model`   | The loaded model, `null` while loading or after an error         |
| `error`   | Why the last load failed (e.g. a network error for a URL source) |
| `loading` | `true` while a load is in progress                               |
| `retry()` | Loads again                                                      |

| Option       | Description                                                                                                                                                                                                                                        |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `headers`    | Sent with every request for a remote file                                                                                                                                                                                                          |
| `resolveUrl` | `(url, file) => string \| Promise<string>`: the URL to request for each file the `model3.json` lists. `url` is resolved next to it without a query, `file` is the path as listed. Replaces the default, which reuses the `model3.json` URL's query |

### `<Live2D />`

| Prop                  | Description                                                                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `model`               | `model` from `useLive2DModel` (renders nothing while `null`)                                                                                                                         |
| `x`, `y`              | Top-left position on the canvas. Default `0`                                                                                                                                         |
| `scale`               | Uniform scale of the model's native canvas size. Default `1`                                                                                                                         |
| `paused`              | Stops animating, keeps the current frame. Default `false`                                                                                                                            |
| `maxFps`              | Caps the frame rate (e.g. `30` to save battery). Default: the display's refresh rate                                                                                                 |
| `onFrameStats(stats)` | About once a second: `fps`, `targetFps`, per-frame times (`workMs`, `updateMs`, `drawablesMs`, `drawMs`, `meshMs`), `meshesBuilt`, `layers` (mask layers), `models` and `loopWorkMs` |

### `useLive2DGestures(targets, options?)`

Returns one gesture for a `<GestureDetector>` around the `<Canvas>`. Gestures need a native view, so this can't be a prop of `<Live2D>`, which is drawn inside the canvas. List targets in drawing order.
- A drag makes every model look at the finger.
- A tap goes to the topmost model with a hit area under it.
- A long press (350 ms) on a model's hit area picks it up, if it has `onMove`.

| Target field      | Description                                                                                                                                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `model`           | `model` from `useLive2DModel`                                                                                                                                                                                  |
| `x`, `y`, `scale` | Same as its `<Live2D>` props, to map touches to the model                                                                                                                                                      |
| `onHit(hitAreas)` | Called on a tap on its hit areas. Return `true` to skip the default: a random `Tap<Area>` motion (e.g. `TapBody`), else a random expression for `Head`, else a random `Tap` motion (models with one tap group) |
| `onMove(x, y)`    | Makes it draggable. Called with its new top-left position as the finger moves, keeping the point where it was grabbed; the app moves it                                                                        |

| Option  | Description                                              |
| ------- | -------------------------------------------------------- |
| `focus` | Models follow the finger while it's down. Default `true` |

The gesture is built once; targets are read at touch time, so they can change on every render.

### `useLive2DGesture(model, options?)`

The same for one model: `options` is a target (without `model`) plus `focus`.

### `Live2DModel`

| Member                                           | Description                                                                                                                   |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `motion(group, index?, priority?)`               | Plays a motion; `priority` is `'idle'`, `'normal'` or `'force'`. `false` if there is none or a higher priority one is playing |
| `expression(name?)`                              | Fades to an expression, random without a name. `false` if there is none                                                       |
| `resetExpression()`                              | Removes the current expression                                                                                                |
| `setParameter(id, value)` / `resetParameter(id)` | Holds a parameter over motions until reset                                                                                    |
| `focus(x, y)` / `resetFocus()`                   | Looks at a point, easing / looks straight ahead                                                                               |
| `hitTest(x, y)`                                  | Names of the `model3.json` hit areas at a point                                                                               |
| `motionGroups`, `expressionNames`                | What the model has                                                                                                            |
| `width`, `height`                                | The model's native canvas size                                                                                                |

## Troubleshooting

- **Skia 2.6–2.9:** Skia objects reach C++ as JSI host objects instead of native state, which the drawing code doesn't unwrap. Use 2.10 or later.
- **Monorepo apps on Skia v2:** map `react-native-skia` to `@shopify/react-native-skia` in the app's Metro config, otherwise a hoisted v3 is found first.
- **Android build fails after changing Skia's version with Bun:** the old version's folders stay in `node_modules`. Delete the package's folder and reinstall, and delete `android/app/build/generated/autolinking` if autolinking still lists old classes.

## Contributing

Pull requests are welcome. For major changes, please open an issue first. To build and run the repo, see [DEVELOPMENT.md](https://github.com/airisu-dev/react-native-live2d-skia/blob/main/DEVELOPMENT.md).

## License

MIT. The Cubism SDK is not part of this package; it's under [Live2D's license](https://www.live2d.com/eula/live2d-proprietary-software-license-agreement_en.html).

Bootstrapped with [create-nitro-module](https://github.com/patrickkabwe/create-nitro-module).
