# Development

Notes for working on this repo. For usage, see the [README](./README.md).

## Layout

A Bun workspace:
- `packages/react-native-live2d-skia/`: the library, published to npm as `@airisu-dev/react-native-live2d-skia`.
- `packages/demo/`: the demo screens (private), shared by the apps.
- `apps/app/`: the demo on Skia v3 (`react-native-skia`). It uses the library like any other app: a `workspace:*` dependency and the `@airisu-dev/react-native-live2d-skia` config plugin in its `app.json`.
- `apps/app-skia2/`: the same demo on Skia v2 (`@shopify/react-native-skia`). It shares the first app's EAS project, bundle id and Cubism SDK folder, so installing one replaces the other on a device.
- `scripts/`: shared.

Run installs and the shared scripts (`lint`, `typecheck`, `codegen`, `fetch:cubism`) from the root, and Expo commands from an app's folder. To run both apps' Metro at once, give one `--port 8082` (on an emulator, also `adb reverse tcp:8082 tcp:8082`). CI builds `apps/app` only.

## Setup

1. Fetch **Cubism SDK for Native** 5-r.5 from Live2D. This means accepting Live2D's license, which ships in the SDK as `LICENSE.md`.

   ```bash
   bun run fetch:cubism
   ```

   It runs `@airisu-dev/react-native-live2d-skia fetch-sdk`, which downloads the official zip, checks its SHA-256, and extracts it to `apps/app/vendor/CubismSdkForNative/`. That gives the proprietary Core and the Cubism Native Framework source, which the native builds compile; the demo's `app.json` points the `@airisu-dev/react-native-live2d-skia` config plugin at that folder. It also copies the Hiyori and Mao samples to `apps/app/assets/live2d/`. Both folders are gitignored and never committed. CI runs the same script.

2. Install and run on Android (development build; Expo Go won't work):

   ```bash
   bun install
   cd apps/app
   bunx expo prebuild --platform android
   bunx expo run:android
   ```

## Architecture

### Layers

1. **C++ core (shared)**
   - Cubism Core (`.a` on iOS / `.so` on Android) — proprietary, supplied by the user (see [Licensing](./README.md#licensing)).
   - Open-source **CubismNativeFramework**. Its motion, physics, expression, pose, eye-blink and lip-sync modules don't depend on a renderer, so they are used as-is. Its renderer is **not** used.
2. **JSI binding**
   - Expose a `Live2DModel` host object via **Nitro Modules** or a **C++ TurboModule**.
   - Must be callable from the UI/worklet runtime so updates can run inside `useFrameCallback`.
3. **Rendering** — react-native-skia `<Canvas>`.

### Per-frame flow

1. `model.update(dt)` in C++ (motions → expressions → eye blink / breath → physics → pose → `csmUpdateModel`).
2. Read each drawable's:
   - vertex positions, UVs, indices
   - opacity, render order (draw order)
   - blend mode, constant flags (double-sided, inverted mask)
   - mask list
   - multiply / screen colors
   - dynamic flags (visibility, vertex positions changed, etc.)
3. Draw with Skia, sorted by render order.

### Skia drawing mapping

| Cubism                  | Skia                                                                                     |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| Drawable mesh           | `Vertices` (triangles) + image shader of its texture                                     |
| Blend: Normal           | `BlendMode.SrcOver`                                                                      |
| Blend: Additive         | `BlendMode.Plus`                                                                         |
| Blend: Multiplicative   | `BlendMode.Modulate` / `Multiply`                                                        |
| Clipping mask           | `saveLayer` → draw drawable → draw mask(s) with `DstIn` (inverted: `DstOut`) → `restore` |
| Multiply / screen color | small `RuntimeEffect` (SkSL) shader                                                      |
| Opacity                 | paint alpha / color in shader                                                            |

## Internals and gotchas

### Premultiplied alpha

Cubism expects premultiplied alpha. Make sure texture loading and the shader agree, otherwise edges get dark halos.

### Moc consistency

Call `csmHasMocConsistency` on the `.moc3` before loading untrusted models.

### Coordinates

Cubism uses a unit space centered on the origin. Map to canvas pixels with a canvas-size / pixels-per-unit transform.

### Cubism JSON parser

The Cubism Native Framework parses its JSON files (model3, physics3, pose3, motion3, ...) with its own `Utils::CubismJson`, which only handles the layout Cubism Editor writes:
- A number must be followed by a newline or a comma (`CubismJson::ParseNumeric`). `{"A":1}`, `[1,2]` and `{"A": 1, "B": 2}` all fail.
- Exponents (`1e-7`) aren't supported.

`JSON.stringify(x)` breaks both rules. Send files through `toCubismJson` (`packages/react-native-live2d-skia/src/loader/cubismJson.ts`): tab-indented, one value per line, exponents written out in full. Its loaders also don't check for parse errors and crash on bad JSON, so `Live2DUserModel` test-parses every input first and throws instead.

### Android release assets

In Android release builds, assets are embedded in the APK. For images, `expo-asset` skips the download and sets `localUri` to a bare drawable name (enough for `<Image>`), which `expo-file-system` rejects ("URI is not absolute"). `readAsset` in `loader/loadModel.ts` clears that and calls `downloadAsync()`, which copies the resource into the cache. Debug builds never hit this: Metro serves assets over HTTP. Always check a release build before calling a loading change done.

### Worklet captures

A worklet copies everything it captures to its runtime. Capturing `globalThis` (even through a module constant) fails with "Trying to convert a cyclic object to a serializable". Reference `globalThis` inside the worklet body instead (see `src/utils/clock.ts`).

### React Compiler and gesture callbacks

The React Compiler is on, and it compiles the workspace package too. A `let` reassigned in one gesture callback and read in another (both made in the same `useMemo`) wasn't seen by the other callback: the long-press drag set it in `onStart`, and `onUpdate` still read `null`. Keep such state on a mutable object (`{ current }`) or a ref (see `useLive2DGesture.ts`).

### Gesture handler events

- `Pan().activateAfterLongPress`: `onBegin` doesn't run before `onStart` the way you'd expect, so don't save the press position in `onBegin` for `onStart`. Read it from `onStart`'s own event; the finger has barely moved by then.
- Combining separate per-model gestures with `Gesture.Simultaneous` doesn't make their inner gestures simultaneous with each other. Use one gesture for all models (`useLive2DGestures`).
