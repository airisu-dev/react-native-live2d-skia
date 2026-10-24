import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseArgs, sha256 } from './index'

const packageRoot = path.join(__dirname, '..', '..')
const { cubismSdk } = JSON.parse(
  fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'),
) as {
  cubismSdk: { latest: string; versions: Record<string, unknown> }
}

describe('parseArgs', () => {
  test('defaults to the latest supported SDK and the vendor folder', () => {
    expect(parseArgs(['fetch-sdk'])).toEqual({
      command: 'fetch-sdk',
      acceptLicense: false,
      version: cubismSdk.latest,
      out: 'vendor/CubismSdkForNative',
      keepZip: false,
    })
  })

  test('reads every option', () => {
    expect(
      parseArgs([
        'fetch-sdk',
        '--accept-license',
        '--keep-zip',
        '--sdk-version',
        '5-r.4',
        '--out',
        'sdk',
      ]),
    ).toEqual({
      command: 'fetch-sdk',
      acceptLicense: true,
      version: '5-r.4',
      out: 'sdk',
      keepZip: true,
    })
  })

  test('turns --help and -h into the help command, before or after the command', () => {
    expect(parseArgs(['--help']).command).toBe('help')
    expect(parseArgs(['-h']).command).toBe('help')
    expect(parseArgs(['fetch-sdk', '--help']).command).toBe('help')
    expect(parseArgs(['fetch-sdk', '-h']).command).toBe('help')
  })

  test('has no command without arguments', () => {
    expect(parseArgs([]).command).toBeUndefined()
  })

  test('throws on an unknown option', () => {
    expect(() => parseArgs(['fetch-sdk', '--nope'])).toThrow('unknown option --nope')
  })

  test('throws when a value option has no value', () => {
    expect(() => parseArgs(['fetch-sdk', '--out'])).toThrow('unknown option --out')
    expect(() => parseArgs(['fetch-sdk', '--sdk-version'])).toThrow('unknown option --sdk-version')
  })
})

describe('sha256', () => {
  let dir: string

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'live2d-cli-'))
  })

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  test('hashes a file', () => {
    const file = path.join(dir, 'a.txt')
    fs.writeFileSync(file, 'abc')
    expect(sha256(file)).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})

// The built bin, run like a user would. `bun install` builds it (postinstall), or `bun run build:node`.
describe('built CLI', () => {
  const bin = path.join(packageRoot, 'cli', 'build', 'index.js')

  const run = (...args: string[]) => {
    expect(fs.existsSync(bin), `${bin} is missing: run \`bun run build:node\``).toBe(true)
    const result = spawnSync('node', [bin, ...args], { encoding: 'utf8' })
    return { code: result.status, out: result.stdout, err: result.stderr }
  }

  test('prints the usage with the scoped package name for --help and no arguments', () => {
    for (const args of [['--help'], ['fetch-sdk', '--help'], []]) {
      const { code, out } = run(...args)
      expect(code).toBe(0)
      expect(out).toContain('@airisu-dev/react-native-live2d-skia fetch-sdk --accept-license')
      for (const version of Object.keys(cubismSdk.versions)) expect(out).toContain(version)
    }
  })

  test('exits 1 with the usage for an unknown command', () => {
    const { code, out } = run('bogus')
    expect(code).toBe(1)
    expect(out).toContain('Usage:')
  })

  test('refuses to download without --accept-license, listing the licenses', () => {
    const { code, err } = run('fetch-sdk')
    expect(code).toBe(1)
    expect(err).toContain('Re-run with --accept-license')
    expect(err).toContain('Live2D Proprietary Software License')
  })

  test('rejects an unsupported SDK version before downloading anything', () => {
    const { code, err } = run('fetch-sdk', '--accept-license', '--sdk-version', '0.0.0')
    expect(code).toBe(1)
    expect(err).toContain("0.0.0 isn't supported")
    expect(err).toContain(cubismSdk.latest)
  })

  test('reports an unknown option as an error', () => {
    const { code, err } = run('fetch-sdk', '--nope')
    expect(code).toBe(1)
    expect(err).toContain('error: unknown option --nope')
  })
})
