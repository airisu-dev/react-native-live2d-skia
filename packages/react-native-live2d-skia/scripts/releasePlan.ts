// What a release run publishes: the version, the npm dist-tag and the git and GitHub steps.
// Run by release.yml with TYPE, VERSION, NPM_TAG, DATE and SHA in the environment.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export type ReleaseType = 'stable' | 'rc' | 'beta' | 'alpha' | 'nightly'

export interface PlanInput {
  type: ReleaseType
  /** Not for a nightly: 0.2.0, or 0.2.0-rc.1 for a candidate. */
  version?: string
  npmTag?: string
  /** A nightly is built on top of the version in package.json. */
  packageVersion: string
  published: string[]
  /** YYYYMMDD, for a nightly. */
  date: string
  sha: string
}

export interface ReleasePlan {
  version: string
  npmTag: string
  /** A nightly has none. */
  gitTag: string | null
  githubRelease: boolean
  prerelease: boolean
  latest: boolean
}

const STABLE = /^\d+\.\d+\.\d+$/
// npm rejects a dist-tag that reads as a version or range (1.x, v1).
const TAG_NAME = /^(?![vV]?\d)[A-Za-z][\w.-]*$/

const parse = (version: string) => version.split('.').map(Number) as [number, number, number]

function isHigher(a: string, b: string) {
  const [x, y] = [parse(a), parse(b)]
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i]! > y[i]!
  return false
}

function nextPatch(version: string) {
  const [major, minor, patch] = parse(version.split('-')[0]!)
  return `${major}.${minor}.${patch + 1}`
}

export function planRelease(input: PlanInput): ReleasePlan {
  const { type, npmTag, published } = input
  if (npmTag !== undefined && npmTag !== '' && !TAG_NAME.test(npmTag)) {
    throw new Error(`"${npmTag}" can't be an npm dist-tag: it must start with a letter`)
  }

  if (type === 'nightly') {
    const version = `${nextPatch(input.packageVersion)}-nightly.${input.date}.${input.sha.slice(0, 7)}`
    return {
      version,
      npmTag: npmTag || 'nightly',
      gitTag: null,
      githubRelease: false,
      prerelease: true,
      latest: false,
    }
  }

  const version = input.version
  if (!version) throw new Error(`A ${type} release needs a version`)
  const expected = type === 'stable' ? STABLE : new RegExp(`^\\d+\\.\\d+\\.\\d+-${type}\\.\\d+$`)
  if (!expected.test(version)) {
    throw new Error(
      `"${version}" isn't a ${type} version: use ${type === 'stable' ? 'X.Y.Z' : `X.Y.Z-${type}.N`}`,
    )
  }
  if (published.includes(version)) throw new Error(`${version} is already on npm`)

  if (type !== 'stable') {
    return {
      version,
      npmTag: npmTag || 'next',
      gitTag: `v${version}`,
      githubRelease: true,
      prerelease: true,
      latest: false,
    }
  }

  // A stable release is `latest` only while no higher stable version exists: a patch for an
  // older major goes to `legacy`, so it doesn't take `latest` away from the newest one.
  const highest = !published.some((v) => STABLE.test(v) && isHigher(v, version))
  return {
    version,
    npmTag: npmTag || (highest ? 'latest' : 'legacy'),
    gitTag: `v${version}`,
    githubRelease: true,
    prerelease: false,
    latest: highest && (npmTag === undefined || npmTag === '' || npmTag === 'latest'),
  }
}

// What `npm view <name> versions --json` prints: a list, a single string, or nothing.
export function parseVersions(output: string): string[] {
  if (!output.trim()) return []
  const parsed = JSON.parse(output) as string | string[]
  return Array.isArray(parsed) ? parsed : [parsed]
}

function publishedVersions(name: string): string[] {
  const result = spawnSync('npm', ['view', name, 'versions', '--json'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
  if (result.status === 0) return parseVersions(result.stdout)
  // Never published yet.
  if (/E404|404 Not Found/.test(result.stderr + result.stdout)) return []
  throw new Error(`npm view ${name} failed: ${result.stderr}`)
}

if (import.meta.main) {
  const env = process.env
  const manifest = JSON.parse(
    fs.readFileSync(path.join(import.meta.dir, '..', 'package.json'), 'utf8'),
  ) as {
    name: string
    version: string
  }
  const published = publishedVersions(manifest.name)
  const sha = env.SHA ?? ''
  const plan = planRelease({
    type: (env.TYPE ?? 'stable') as ReleaseType,
    version: env.VERSION,
    npmTag: env.NPM_TAG,
    packageVersion: manifest.version,
    published,
    date: env.DATE ?? '',
    sha,
  })
  // The nightly of a commit that is already published: nothing new to release.
  const skip = plan.gitTag === null && published.some((v) => v.endsWith(`.${sha.slice(0, 7)}`))
  console.log(JSON.stringify({ ...plan, skip }, null, 2))
  if (env.GITHUB_OUTPUT) {
    const lines = Object.entries({ ...plan, skip }).map(([key, value]) => `${key}=${value ?? ''}`)
    fs.appendFileSync(env.GITHUB_OUTPUT, `${lines.join('\n')}\n`)
  }
}
