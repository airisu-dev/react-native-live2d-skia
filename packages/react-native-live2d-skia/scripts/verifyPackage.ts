// Packs the library like `npm publish` and checks the tarball and the unpacked package.
//   bun run verify:package
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const packageRoot = path.join(import.meta.dir, '..')
const problems: string[] = []
const check = (ok: boolean, message: string) => {
  if (!ok) problems.push(message)
}

function run(
  command: string,
  args: string[],
  options: { cwd?: string; env?: Record<string, string> } = {},
) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? packageRoot,
    env: { ...process.env, ...options.env },
    encoding: 'utf8',
    // bun and npm are .cmd shims on Windows; the shell would mangle `node -e "..."`.
    shell: process.platform === 'win32' && (command === 'bun' || command === 'npm'),
  })
  return { code: result.status, out: result.stdout ?? '', err: result.stderr ?? '' }
}

// The plugin and the CLI are published as built JS: build them the way `prepack` does.
const build = run('bun', ['run', 'build:node'])
if (build.code !== 0) {
  console.error(build.out + build.err)
  console.error('verify:package: building the plugin and the CLI failed')
  process.exit(1)
}

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'live2d-package-'))
try {
  const pack = run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', workDir])
  if (pack.code !== 0) {
    console.error(pack.out + pack.err)
    console.error('verify:package: npm pack failed')
    process.exit(1)
  }
  const [packed] = JSON.parse(pack.out) as [{ filename: string; files: { path: string }[] }]
  const files = packed.files.map((f) => f.path.replace(/\\/g, '/'))
  const has = (file: string) => files.includes(file)

  const required = [
    'package.json',
    'README.md',
    'LICENSE',
    'app.plugin.js',
    'plugin/build/index.js',
    'cli/build/index.js',
    'nitro.json',
    'Live2dSkia.podspec',
    'android/build.gradle',
    'android/CMakeLists.txt',
    'src/index.ts',
    'src/specs/react-native-live2d-skia.nitro.ts',
    'cpp/hybrid/HybridLive2DModel.cpp',
    'cpp/cubism/Live2DUserModel.cpp',
    'cpp/drawing/SkiaDrawer.cpp',
    'nitrogen/generated/shared/c++/HybridLive2DModelSpec.hpp',
  ]
  for (const file of required) check(has(file), `missing from the package: ${file}`)

  const forbidden: [RegExp, string][] = [
    [/\.test\.tsx?$/, 'test file'],
    [/(^|\/)tsconfig[^/]*\.json$/, 'tsconfig'],
    [/\.tsbuildinfo$/, 'tsbuildinfo'],
    [/^scripts\//, 'repo script'],
    [/(^|\/)node_modules\//, 'node_modules'],
    [/^android\/(\.cxx|build)\//, 'Android build output'],
    [/(^|\/)vendor\//, 'vendored SDK'],
    [/CubismSdkForNative|cubism-sdk\//, 'Cubism SDK'],
    [/^(plugin|cli)\/src\//, 'plugin/CLI TypeScript source (only the build is published)'],
  ]
  for (const file of files) {
    for (const [pattern, what] of forbidden) {
      check(!pattern.test(file), `${what} in the package: ${file}`)
    }
  }

  const unpacked = path.join(workDir, 'unpacked')
  fs.mkdirSync(unpacked)
  // Relative paths: GNU tar reads a Windows drive letter (C:) as a remote host.
  const tar = run('tar', ['-xzf', packed.filename, '-C', 'unpacked'], { cwd: workDir })
  if (tar.code !== 0) {
    console.error(`verify:package: couldn't unpack the tarball: ${tar.err}`)
    process.exit(1)
  }
  const root = path.join(unpacked, 'package')

  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
    name: string
    main: string
    bin: Record<string, string>
  }
  check(
    manifest.name === '@airisu-dev/react-native-live2d-skia',
    `unexpected name ${manifest.name}`,
  )
  for (const entry of [manifest.main, ...Object.values(manifest.bin)]) {
    const exists = [entry, `${entry}.ts`, `${entry}.tsx`].some((e) =>
      fs.existsSync(path.join(root, e)),
    )
    check(exists, `package.json points at ${entry}, which isn't in the package`)
  }

  const cmake = fs.readFileSync(path.join(root, 'android', 'CMakeLists.txt'), 'utf8')
  const sources = cmake.match(/\.\.\/cpp\/[\w/.+-]+\.cpp/g) ?? []
  check(sources.length > 0, 'found no ../cpp sources in android/CMakeLists.txt')
  for (const source of new Set(sources)) {
    check(
      fs.existsSync(path.join(root, 'android', source)),
      `android/CMakeLists.txt lists ${source}, which isn't in the package`,
    )
  }

  const cli = run('node', [path.join(root, 'cli', 'build', 'index.js'), '--help'])
  check(cli.code === 0, `the CLI exited ${cli.code} for --help`)
  check(cli.out.includes(manifest.name), 'the CLI usage does not name the scoped package')

  // Loaded the way Expo CLI does, through app.plugin.js.
  const repoModules = path.join(packageRoot, '..', '..', 'node_modules')
  const plugin = run(
    'node',
    [
      '-e',
      "const plugin = require('./app.plugin.js'); if (typeof plugin !== 'function') throw new Error('app.plugin.js does not export a function')",
    ],
    { cwd: root, env: { NODE_PATH: repoModules } },
  )
  check(
    plugin.code === 0,
    `app.plugin.js failed to load: ${plugin.err.trim().split('\n').slice(-3).join(' | ')}`,
  )

  console.log(`${manifest.name}: ${files.length} files in ${packed.filename}`)
} finally {
  fs.rmSync(workDir, { recursive: true, force: true })
}

if (problems.length > 0) {
  console.error(`verify:package found ${problems.length} problem(s):`)
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}
console.log('verify:package: ok')
