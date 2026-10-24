// The native checks of skiaCompat.ts, as pure functions over compiler and `llvm-nm` output:
//   deprecations  Skia marked something our native drawing code calls as deprecated (a warning
//                 before it is removed)
//   bindings      which Skia functions our two files need, by mangled name, so the exact overload
//                 they bind to; compared with scripts/skia-bindings.json
//   link          each of those functions is defined in that release's prebuilt libskia.a

/** The Skia functions we record. RNSkia's own C++ is compiled into the app, not into libskia.a. */
const SKIA_SYMBOL = /^(Sk|skgpu|sk_)/
const RECORDED_SYMBOL = /^(Sk|skgpu|sk_|RNSkia)/

/** `llvm-nm --undefined-only --demangle` output -> the Skia functions the object file needs. */
export function bindingSymbols(nmOutput: string): string[] {
  const symbols = new Set<string>()
  for (const line of nmOutput.split('\n')) {
    const match = /^\s*U\s+(.+?)\s*$/.exec(line)
    if (match && RECORDED_SYMBOL.test(match[1]!)) symbols.add(match[1]!)
  }
  return [...symbols].sort()
}

export interface BindingDrift {
  /** Needed now, not in the baseline: a new function, or a different overload. */
  added: string[]
  /** In the baseline, not needed now. */
  removed: string[]
}

export function diffBindings(baseline: string[], actual: string[]): BindingDrift {
  const before = new Set(baseline)
  const after = new Set(actual)
  return {
    added: actual.filter((s) => !before.has(s)).sort(),
    removed: baseline.filter((s) => !after.has(s)).sort(),
  }
}

export function hasDrifted(drift: BindingDrift): boolean {
  return drift.added.length > 0 || drift.removed.length > 0
}

/** The text of a binding change, one line per function. */
export function describeDrift(drift: BindingDrift): string {
  return [
    ...drift.removed.map((s) => `no longer needed (the call now binds elsewhere?): ${s}`),
    ...drift.added.map((s) => `newly needed: ${s}`),
  ].join('\n')
}

/**
 * The deprecation warnings that point into our own code (the ones about what we call), as
 * `cpp/drawing/SkiaDrawer.cpp:83:9: warning: ...`, without the machine's path.
 */
export function deprecationsOf(compilerOutput: string, ourCodeMarker = '/cpp/drawing/'): string[] {
  const found = new Set<string>()
  for (const line of compilerOutput.split('\n')) {
    if (!line.includes('-Wdeprecated-declarations') || !line.includes('warning:')) continue
    const at = line.indexOf(ourCodeMarker)
    if (at < 0) continue
    found.add(
      line
        .slice(at + 1)
        .replace(/\s*\[-Wdeprecated-declarations\]\s*$/, '')
        .trim(),
    )
  }
  return [...found].sort()
}

/** `llvm-nm --defined-only --demangle` over an archive -> the names it defines. */
export function definedSymbols(nmOutput: string): Set<string> {
  const defined = new Set<string>()
  for (const line of nmOutput.split('\n')) {
    const match = /^[0-9a-fA-F]+\s+[A-Za-z]\s+(.+?)\s*$/.exec(line)
    if (match) defined.add(match[1]!)
  }
  return defined
}

/** The needed functions that libskia.a does not define. RNSkia's are not expected to be in it. */
export function missingFromLib(bindings: string[], defined: Set<string>): string[] {
  return bindings.filter((s) => SKIA_SYMBOL.test(s) && !defined.has(s))
}

/**
 * The npm package with the prebuilt Skia libraries of a react-native-skia release, from the
 * release's own package.json: `react-native-skia-graphite-android` (v3) or
 * `react-native-skia-android` (v2).
 */
export function libPackageOf(manifest: {
  dependencies?: Record<string, string>
}): { name: string; version: string } | null {
  for (const [name, version] of Object.entries(manifest.dependencies ?? {})) {
    if (/^react-native-skia(-graphite)?-android$/.test(name)) return { name, version }
  }
  return null
}

/** Where the arm64 archive is inside that package's tarball. */
export const LIB_ARCHIVE = 'package/libs/arm64-v8a/libskia.a'
