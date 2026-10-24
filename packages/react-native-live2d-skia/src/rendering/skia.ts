// The Skia package in use: react-native-skia (v3) or @shopify/react-native-skia (v2).
// Types are declared structurally rather than imported: the app type-checks these
// sources and may have only one of the two packages.
import type { SkiaModule } from './skiaTypes'

export type * from './skiaTypes'

// Guarded requires: Metro (Expo enables optional dependencies) bundles the
// missing one as a require that throws. v3 first: in a monorepo both can be
// installed, and an app on v2 maps react-native-skia to it in its Metro config.
function loadSkia(): SkiaModule {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-skia') as SkiaModule
  } catch {}
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@shopify/react-native-skia') as SkiaModule
  } catch {}
  throw new Error(
    'react-native-live2d-skia needs react-native-skia (v3) or @shopify/react-native-skia (v2).',
  )
}

export const { Skia, BlendMode, VertexMode, TileMode, FilterMode, MipmapMode, Group, Picture } =
  loadSkia()
