// Checks every stable react-native-skia / @shopify/react-native-skia version this package supports
// (the peerDependencies ranges, up to the newest release) against the Skia API it uses:
//   types         the real package's types satisfy src/rendering/skiaTypes.ts (what the JS needs)
//   native        cpp/drawing/SkiaDrawer.cpp and MeshCache.cpp compile against its headers (--native)
//   bindings      the Skia functions those files need, by mangled name (so the exact overload), are
//                 the ones in scripts/skia-bindings.json: a change can still compile (--native)
//   deprecations  nothing our native code calls is marked deprecated by Skia (--native)
//
//   bun scripts/skiaCompat.ts [--native] [--only react-native-skia@3.8.0,...] [--out results.json]
//                             [--fail-on-incompatible] [--update-baseline] [--skip-types]
// --skip-types leaves the type check to a parallel run (the workflow runs the two as separate jobs).
// Failed checks are results, not errors: the exit code is 1 only when the run itself broke, or with
// --fail-on-incompatible when a check other than deprecations failed.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import {
  bindingSymbols,
  deprecationsOf,
  describeDrift,
  diffBindings,
  hasDrifted,
} from './skiaNative'

export type SkiaPackage = 'react-native-skia' | '@shopify/react-native-skia'
export const PACKAGES: SkiaPackage[] = ['react-native-skia', '@shopify/react-native-skia']

export interface CheckResult {
  ok: boolean
  output: string
}

export interface VersionResult {
  pkg: SkiaPackage
  version: string
  /** Not set with --skip-types. */
  types?: CheckResult
  native?: CheckResult
  bindings?: CheckResult
  deprecations?: CheckResult
}

/** The checks that make a version incompatible. A deprecation is a warning: it only opens an issue. */
export function failedChecks(r: VersionResult): string[] {
  const checks: [string, CheckResult | undefined][] = [
    ['types', r.types],
    ['native', r.native],
    ['bindings', r.bindings],
  ]
  return checks.filter(([, c]) => c && !c.ok).map(([name]) => name)
}

const STABLE = /^\d+\.\d+\.\d+$/

const parse = (version: string) => version.split('.').map(Number) as [number, number, number]

export function compareVersions(a: string, b: string): number {
  const [x, y] = [parse(a), parse(b)]
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i]! - y[i]!
  return 0
}

/** `>=3.3.0` -> `3.3.0`. A peer range this script doesn't understand is an error: fix the script. */
export function minVersionOf(range: string): string {
  const match = /^>=\s*(\d+\.\d+\.\d+)$/.exec(range.trim())
  if (!match) throw new Error(`Can't read the Skia peer range "${range}": expected ">=X.Y.Z"`)
  return match[1]!
}

/** The stable versions from `min` up, oldest first. Prereleases are skipped. */
export function selectVersions(all: string[], min: string): string[] {
  return all.filter((v) => STABLE.test(v) && compareVersions(v, min) >= 0).sort(compareVersions)
}

/** `react-native-skia` is the Graphite renderer (v3); `@shopify/react-native-skia` is Ganesh (v2). */
export function nativeFlavor(pkg: SkiaPackage): 'graphite' | 'ganesh' {
  return pkg === 'react-native-skia' ? 'graphite' : 'ganesh'
}

export function parseTarget(target: string): { pkg: SkiaPackage; version: string } {
  const at = target.lastIndexOf('@')
  const pkg = target.slice(0, at)
  if (at <= 0 || !PACKAGES.includes(pkg as SkiaPackage)) {
    throw new Error(`"${target}" isn't <package>@<version> for ${PACKAGES.join(' or ')}`)
  }
  return { pkg: pkg as SkiaPackage, version: target.slice(at + 1) }
}

/** The TypeScript file that assigns each part of the real package to our structural types. */
export function typeCheckSource(pkg: SkiaPackage, skiaTypesImport: string): string {
  return [
    `import type { ComponentType } from 'react'`,
    `import * as Real from '${pkg}'`,
    `import type { SkiaModule } from '${skiaTypesImport}'`,
    '',
    '// One statement per part: TypeScript reports only the first mismatch of a statement, and one',
    '// would hide the others (and make a later, different break look like a new one).',
    `export const xywhRect: SkiaModule['Skia']['XYWHRect'] = Real.Skia.XYWHRect`,
    `export const paint: SkiaModule['Skia']['Paint'] = Real.Skia.Paint`,
    `export const pictureRecorder: SkiaModule['Skia']['PictureRecorder'] = Real.Skia.PictureRecorder`,
    `export const makeVertices: SkiaModule['Skia']['MakeVertices'] = Real.Skia.MakeVertices`,
    `export const image: SkiaModule['Skia']['Image'] = Real.Skia.Image`,
    `export const data: SkiaModule['Skia']['Data'] = Real.Skia.Data`,
    `export const blendMode: SkiaModule['BlendMode'] = Real.BlendMode`,
    `export const vertexMode: SkiaModule['VertexMode'] = Real.VertexMode`,
    `export const tileMode: SkiaModule['TileMode'] = Real.TileMode`,
    `export const filterMode: SkiaModule['FilterMode'] = Real.FilterMode`,
    `export const mipmapMode: SkiaModule['MipmapMode'] = Real.MipmapMode`,
    '// The components only have to exist: their prop types come from react and reanimated.',
    `export const group: ComponentType<any> = Real.Group`,
    `export const picture: ComponentType<any> = Real.Picture`,
    '',
  ].join('\n')
}

export interface ClangInput {
  lib: string
  cubismSdk: string
  skiaDir: string
  reactNative: string
  flavor: 'graphite' | 'ganesh'
  source: string
  /** The object file to write: it lists the Skia functions the code needs. */
  output: string
  /** Include directories that exist in this Skia version. */
  exists: (dir: string) => boolean
}

/**
 * The compiler arguments, from android/CMakeLists.txt: the same includes and defines, compiled to an
 * object file (not linked). All warnings are off except the deprecated ones.
 */
export function clangArgs(input: ClangInput): string[] {
  const { lib, cubismSdk, skiaDir: s, reactNative: rn, flavor } = input
  const includes = [
    `${lib}/cpp/drawing`,
    `${lib}/cpp/cubism`,
    `${lib}/cpp/hybrid`,
    `${cubismSdk}/Core/include`,
    `${cubismSdk}/Framework/src`,
    `${s}/cpp/skia`,
    `${s}/cpp/api`,
    `${s}/cpp/jsi`,
    `${s}/cpp/rnskia`,
    `${s}/cpp/rnskia/values`,
    `${s}/cpp/utils`,
    `${s}/cpp`,
    `${s}/android/cpp/rnskia-android`,
    `${s}/android/cpp/jni/include`,
    `${rn}/ReactCommon`,
    `${rn}/ReactCommon/callinvoker`,
    `${rn}/ReactCommon/jsi`,
    ...(flavor === 'graphite' ? [`${s}/cpp/dawn/include`] : []),
  ].filter(input.exists)
  const defines = [
    'LIVE2D_SKIA=1',
    'LIVE2D_SKIA_CUBISM_SDK=50500', // 5-r.5, as major * 10000 + release * 100 + patch
    'SK_BUILD_FOR_ANDROID',
    'SK_DISABLE_LEGACY_SHAPER_FACTORY',
    'SK_IMAGE_READ_PIXELS_DISABLE_LEGACY_API',
    'FOLLY_NO_CONFIG=1',
    'FOLLY_HAVE_CLOCK_GETTIME=1',
    'FOLLY_HAVE_MEMRCHR=1',
    'FOLLY_USE_LIBCPP=1',
    'FOLLY_MOBILE=1',
    'ON_ANDROID',
    'ONANDROID',
    ...(flavor === 'graphite' ? ['SK_GRAPHITE'] : ['SK_GL', 'SK_GANESH']),
  ]
  return [
    '--target=aarch64-linux-android24',
    '-std=c++20',
    '-c',
    '-o',
    input.output,
    '-Wno-everything',
    '-Wdeprecated-declarations',
    ...includes.map((dir) => `-I${dir}`),
    ...defines.map((define) => `-D${define}`),
    input.source,
  ]
}

const trimOutput = (text: string, lines = 30) => text.trim().split('\n').slice(0, lines).join('\n')

function run(command: string, args: string[], cwd?: string) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32' && command === 'npm',
    maxBuffer: 64 * 1024 * 1024,
  })
  const stdout = result.stdout ?? ''
  return { code: result.status, stdout, output: `${stdout}${result.stderr ?? ''}` }
}

function findClang(): string | null {
  const ext = process.platform === 'win32' ? '.exe' : ''
  const host = { win32: 'windows-x86_64', darwin: 'darwin-x86_64', linux: 'linux-x86_64' }[
    process.platform as string
  ]
  const roots = [process.env.ANDROID_NDK_HOME, process.env.ANDROID_NDK_LATEST_HOME]
  for (const sdk of [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT]) {
    if (!sdk || !fs.existsSync(path.join(sdk, 'ndk'))) continue
    for (const version of fs.readdirSync(path.join(sdk, 'ndk')).sort().reverse()) {
      roots.push(path.join(sdk, 'ndk', version))
    }
  }
  for (const root of roots) {
    if (!root) continue
    const clang = path.join(
      root,
      'toolchains',
      'llvm',
      'prebuilt',
      host ?? '',
      'bin',
      `clang++${ext}`,
    )
    if (fs.existsSync(clang)) return clang
  }
  return null
}

function npmVersions(pkg: string): string[] {
  const { code, stdout, output } = run('npm', ['view', pkg, 'versions', '--json'])
  if (code !== 0) throw new Error(`npm view ${pkg} failed: ${trimOutput(output, 5)}`)
  return JSON.parse(stdout) as string[]
}

/** Downloads one version into <dir>/node_modules/<pkg> without installing anything. */
function fetchPackage(pkg: SkiaPackage, version: string, dir: string) {
  const target = path.join(dir, 'node_modules', pkg)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(target, { recursive: true })
  const pack = run('npm', ['pack', `${pkg}@${version}`, '--silent', '--pack-destination', dir])
  if (pack.code !== 0)
    throw new Error(`npm pack ${pkg}@${version} failed: ${trimOutput(pack.output, 5)}`)
  const tgz = pack.stdout.trim().split('\n').pop()!
  // Relative paths: GNU tar reads a Windows drive letter (C:) as a remote host.
  const tar = run('tar', ['-xzf', tgz, '-C', `node_modules/${pkg}`, '--strip-components=1'], dir)
  if (tar.code !== 0) throw new Error(`couldn't unpack ${tgz}: ${trimOutput(tar.output, 5)}`)
  return target
}

const posix = (p: string) => p.split(path.sep).join('/')

function checkTypes(pkg: SkiaPackage, dir: string, packageRoot: string): CheckResult {
  const skiaTypes = path.join(packageRoot, 'src', 'rendering', 'skiaTypes')
  fs.writeFileSync(
    path.join(dir, 'check.ts'),
    typeCheckSource(pkg, posix(path.relative(dir, skiaTypes))),
  )
  fs.writeFileSync(
    path.join(dir, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        // Our types are a minimal subset of Skia's: only the shapes must line up, not the variance of
        // parameters (Skia 3.8 declares saveLayer as a property, which TypeScript compares strictly).
        strictFunctionTypes: false,
        noEmit: true,
        skipLibCheck: true,
        target: 'esnext',
        module: 'esnext',
        moduleResolution: 'bundler',
        lib: ['esnext'],
        jsx: 'react',
        types: [],
      },
      files: ['check.ts'],
    }),
  )
  const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc')
  const { code, output } = run(
    process.execPath,
    [tsc, '-p', 'tsconfig.json', '--pretty', 'false'],
    dir,
  )
  return {
    ok: code === 0,
    output: code === 0 ? '' : trimOutput(output.split(posix(dir)).join('.')),
  }
}

const UNITS = ['SkiaDrawer', 'MeshCache']

interface NativeResult {
  native: CheckResult
  /** Not set when the code did not compile. */
  deprecations?: CheckResult
  /** The Skia functions the two files need. Not set when the code did not compile. */
  symbols?: string[]
}

function checkNative(
  pkg: SkiaPackage,
  skiaDir: string,
  packageRoot: string,
  clang: string,
  dir: string,
): NativeResult {
  const repoRoot = path.join(packageRoot, '..', '..')
  const cubismSdk =
    process.env.CUBISM_SDK_DIR ?? path.join(repoRoot, 'apps/app/vendor/CubismSdkForNative')
  const nm = path.join(path.dirname(clang), `llvm-nm${path.extname(clang)}`)
  const failures: string[] = []
  const deprecations: string[] = []
  const symbols = new Set<string>()
  for (const unit of UNITS) {
    const object = path.join(dir, `${unit}.o`)
    const args = clangArgs({
      lib: posix(packageRoot),
      cubismSdk: posix(cubismSdk),
      skiaDir: posix(skiaDir),
      reactNative: posix(path.join(repoRoot, 'node_modules', 'react-native')),
      flavor: nativeFlavor(pkg),
      source: posix(path.join(packageRoot, 'cpp', 'drawing', `${unit}.cpp`)),
      output: posix(object),
      exists: (include) => fs.existsSync(include),
    })
    const { code, output } = run(clang, args)
    if (code !== 0) {
      const errors = output
        .split('\n')
        .filter((l) => /error|fatal/.test(l))
        .slice(0, 6)
      failures.push(`${unit}.cpp\n${errors.join('\n')}`)
      continue
    }
    deprecations.push(...deprecationsOf(output))
    const listed = run(nm, ['--undefined-only', '--demangle', posix(object)])
    if (listed.code !== 0)
      throw new Error(`llvm-nm failed on ${unit}.o: ${trimOutput(listed.output, 5)}`)
    for (const symbol of bindingSymbols(listed.stdout)) symbols.add(symbol)
  }
  if (failures.length > 0) return { native: { ok: false, output: failures.join('\n\n') } }
  const found = [...new Set(deprecations)].sort()
  return {
    native: { ok: true, output: '' },
    deprecations: { ok: found.length === 0, output: found.join('\n') },
    symbols: [...symbols].sort(),
  }
}

export type Baseline = Partial<Record<SkiaPackage, string[]>>

const baselinePath = (packageRoot: string) =>
  path.join(packageRoot, 'scripts', 'skia-bindings.json')

function loadBaseline(packageRoot: string): Baseline {
  const file = baselinePath(packageRoot)
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as Baseline) : {}
}

/** The Skia functions our native code needs, now, against the baseline: any difference is reported. */
export function checkBindings(
  pkg: SkiaPackage,
  symbols: string[],
  baseline: Baseline,
): CheckResult {
  const expected = baseline[pkg]
  if (!expected) {
    return {
      ok: false,
      output: `scripts/skia-bindings.json has no baseline for ${pkg}: run bun scripts/skiaCompat.ts --native --update-baseline`,
    }
  }
  const drift = diffBindings(expected, symbols)
  return { ok: !hasDrifted(drift), output: hasDrifted(drift) ? describeDrift(drift) : '' }
}

function summaryTable(results: VersionResult[], native: boolean): string {
  const mark = (c?: CheckResult, warn = false) =>
    c === undefined ? '-' : c.ok ? 'ok' : warn ? 'warning' : '**FAIL**'
  const rows = results.map(
    (r) =>
      `| ${r.pkg} | ${r.version} | ${mark(r.types)} |${
        native ? ` ${mark(r.native)} | ${mark(r.bindings)} | ${mark(r.deprecations, true)} |` : ''
      }`,
  )
  return [
    '### Skia compatibility',
    '',
    `| package | version | types |${native ? ' native | bindings | deprecations |' : ''}`,
    `|---|---|---|${native ? '---|---|---|' : ''}`,
    ...rows,
    '',
  ].join('\n')
}

/** Records what our native code binds to in the oldest supported release of each package. */
function updateBaseline(
  packageRoot: string,
  workRoot: string,
  targets: { pkg: SkiaPackage; version: string }[],
  clang: string,
) {
  const baseline: Baseline = loadBaseline(packageRoot)
  for (const { pkg, version } of targets) {
    const dir = path.join(workRoot, `${pkg.replace('/', '__')}@${version}`)
    const result = checkNative(pkg, fetchPackage(pkg, version, dir), packageRoot, clang, dir)
    fs.rmSync(dir, { recursive: true, force: true })
    if (!result.symbols)
      throw new Error(`${pkg}@${version} doesn't compile:\n${result.native.output}`)
    baseline[pkg] = result.symbols
    console.log(`${pkg}@${version}: ${result.symbols.length} Skia functions`)
  }
  fs.writeFileSync(baselinePath(packageRoot), `${JSON.stringify(baseline, null, 2)}\n`)
  console.log(`Wrote ${baselinePath(packageRoot)}`)
}

function main() {
  const args = process.argv.slice(2)
  const flag = (name: string) => args.includes(name)
  const value = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined)
  const packageRoot = path.join(import.meta.dir, '..')
  const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8')) as {
    peerDependencies: Record<string, string>
  }
  const updateBaselineOnly = flag('--update-baseline')
  const native = flag('--native') || updateBaselineOnly
  const workRoot = path.join(packageRoot, '.skia-compat')
  const out = value('--out') ?? path.join(workRoot, 'results.json')

  let targets: { pkg: SkiaPackage; version: string }[]
  if (flag('--only')) {
    targets = value('--only')!.split(',').map(parseTarget)
  } else if (updateBaselineOnly) {
    // The baseline is what the oldest supported release of each package needs.
    targets = PACKAGES.map((pkg) => {
      const range = manifest.peerDependencies[pkg]
      if (!range) throw new Error(`package.json has no peerDependency on ${pkg}`)
      return { pkg, version: minVersionOf(range) }
    })
  } else {
    targets = PACKAGES.flatMap((pkg) => {
      const range = manifest.peerDependencies[pkg]
      if (!range) throw new Error(`package.json has no peerDependency on ${pkg}`)
      return selectVersions(npmVersions(pkg), minVersionOf(range)).map((version) => ({
        pkg,
        version,
      }))
    })
  }

  let clang: string | null = null
  if (native) {
    clang = process.env.CLANGXX ?? findClang()
    if (!clang) throw new Error('--native needs the Android NDK: set ANDROID_NDK_HOME or CLANGXX')
    const sdk =
      process.env.CUBISM_SDK_DIR ??
      path.join(packageRoot, '../../apps/app/vendor/CubismSdkForNative')
    if (!fs.existsSync(path.join(sdk, 'Core/include'))) {
      throw new Error(`--native needs the Cubism SDK at ${sdk}: run bun run fetch:cubism`)
    }
  }

  if (updateBaselineOnly) {
    updateBaseline(packageRoot, workRoot, targets, clang!)
    return
  }

  console.log(
    `Checking ${targets.length} Skia versions (${[flag('--skip-types') ? '' : 'types', native ? 'native' : ''].filter(Boolean).join(' + ')})`,
  )
  fs.mkdirSync(path.dirname(out), { recursive: true })
  const baseline = loadBaseline(packageRoot)
  const results: VersionResult[] = []
  for (const { pkg, version } of targets) {
    const dir = path.join(workRoot, `${pkg.replace('/', '__')}@${version}`)
    const skiaDir = fetchPackage(pkg, version, dir)
    const result: VersionResult = { pkg, version }
    if (!flag('--skip-types')) result.types = checkTypes(pkg, dir, packageRoot)
    if (native && clang) {
      const checked = checkNative(pkg, skiaDir, packageRoot, clang, dir)
      result.native = checked.native
      result.deprecations = checked.deprecations
      if (checked.symbols) result.bindings = checkBindings(pkg, checked.symbols, baseline)
    }
    results.push(result)
    const failures = failedChecks(result)
    const warnings = result.deprecations && !result.deprecations.ok ? ' (deprecated APIs)' : ''
    console.log(`${failures.length === 0 ? 'ok  ' : 'FAIL'} ${pkg}@${version}${warnings}`)
    fs.rmSync(dir, { recursive: true, force: true })
  }
  fs.writeFileSync(out, `${JSON.stringify(results, null, 2)}\n`)
  const table = summaryTable(results, native)
  console.log(`\n${table}`)
  if (process.env.GITHUB_STEP_SUMMARY)
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${table}\n`)
  const failed = results.filter((r) => failedChecks(r).length > 0)
  console.log(`${results.length - failed.length} compatible, ${failed.length} not. Results: ${out}`)
  if (flag('--fail-on-incompatible') && failed.length > 0) process.exit(1)
}

if (import.meta.main) main()
