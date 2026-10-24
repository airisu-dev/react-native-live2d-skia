// Opens a GitHub issue for each new Skia incompatibility found by skiaCompat.ts, never twice for
// the same one: an issue carries a hidden marker made of the package and a fingerprint of the
// error, and a marker already in any issue (open or closed) is skipped.
//
//   bun scripts/skiaCompatReport.ts results.json [more-results.json ...] [--dry-run]
// Uses the gh CLI: GH_TOKEN, and GITHUB_REPOSITORY and GITHUB_RUN_ID for the link to the run.

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { CheckResult, VersionResult } from './skiaCompat'

export const LABEL = 'skia-compat'
/** New issues per run: a Skia release that breaks everything is one issue, not a flood. */
export const MAX_NEW_ISSUES = 3

export type CheckName = 'types' | 'native' | 'bindings' | 'link' | 'deprecations'

export interface Failure {
  pkg: string
  version: string
  check: CheckName
  output: string
}

/** The failures of one kind (same package, check and error), over every version it affects. */
export interface Group {
  pkg: string
  check: CheckName
  fingerprint: string
  versions: string[]
  output: string
}

/**
 * One entry per error: a version that breaks in two ways is two failures, so each way gets its own
 * issue with only its own text. tsc errors start at `check.ts(`; native output is `<unit>.cpp`
 * followed by its error lines.
 */
export function splitErrors(output: string, check: CheckName = 'native'): string[] {
  const text = output.trim()
  if (!text) return []
  // A binding change or a deprecation is one finding, not a list of independent errors.
  if (check === 'bindings' || check === 'link' || check === 'deprecations') return [text]
  if (/^check\.ts\(/m.test(text)) {
    return text
      .split(/\n(?=check\.ts\()/)
      .map((error) => error.trim())
      .filter(Boolean)
  }
  return text.split('\n\n').flatMap((block) => {
    const [unit, ...lines] = block.split('\n')
    return lines.length > 0 ? lines.map((line) => `${unit}: ${line}`) : [block]
  })
}

export function failuresOf(results: VersionResult[]): Failure[] {
  const failures: Failure[] = []
  for (const r of results) {
    const checks: [CheckName, CheckResult | undefined][] = [
      ['types', r.types],
      ['native', r.native],
      ['bindings', r.bindings],
      ['link', r.link],
      ['deprecations', r.deprecations],
    ]
    for (const [check, result] of checks) {
      if (!result || result.ok) continue
      const errors = splitErrors(result.output, check)
      for (const output of errors.length > 0 ? errors : [result.output]) {
        failures.push({ pkg: r.pkg, version: r.version, check, output })
      }
    }
  }
  return failures
}

/** What identifies an error across versions and machines: no paths, line numbers or versions. */
export function fingerprintOf(output: string): string {
  const lines = output
    .split('\n')
    .map((line) =>
      line
        .replace(/\(\d+,\d+\)/g, '') // tsc: check.ts(6,14)
        .replace(/:\d+:\d+:/g, ':') // clang: file.cpp:12:3:
        .replace(/import\("[^"]*"\)/g, 'import(...)') // tsc: import("E:/.../index")
        .replace(/[A-Za-z]:[^\s'"]*|\/[^\s'"]*\/[^\s'"]*/g, '<path>') // absolute paths
        .replace(/\.\/node_modules\/[^\s'"]*/g, '<path>')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean)
  return createHash('sha1')
    .update([...new Set(lines)].sort().join('\n'))
    .digest('hex')
    .slice(0, 10)
}

export function groupFailures(failures: Failure[]): Group[] {
  const groups = new Map<string, Group>()
  for (const f of failures) {
    const fingerprint = fingerprintOf(f.output)
    const key = `${f.pkg}:${f.check}:${fingerprint}`
    const group = groups.get(key) ?? {
      pkg: f.pkg,
      check: f.check,
      fingerprint,
      versions: [],
      output: f.output,
    }
    if (!group.versions.includes(f.version)) group.versions.push(f.version)
    groups.set(key, group)
  }
  return [...groups.values()]
}

export const markerOf = (group: Pick<Group, 'pkg' | 'check' | 'fingerprint'>) =>
  `skia-compat:${group.pkg.replace('/', '_')}:${group.check}:${group.fingerprint}`

export function issueTitle(group: Group): string {
  const first = group.versions[0]
  const more = group.versions.length > 1 ? ` and ${group.versions.length - 1} later` : ''
  return `Skia ${group.pkg}@${first}${more} fails the ${group.check} check`
}

export function issueBody(group: Group, runUrl: string | null): string {
  const checks = {
    types:
      "The package's types no longer satisfy `src/rendering/skiaTypes.ts`, the part of Skia this package uses.",
    native:
      '`cpp/drawing/SkiaDrawer.cpp` or `MeshCache.cpp` no longer compiles against its headers.',
    bindings:
      'The Skia functions `SkiaDrawer.cpp` and `MeshCache.cpp` bind to differ from `scripts/skia-bindings.json`. It still compiles, but a call may now resolve to another overload with other behavior. If the change is harmless, refresh the baseline with `--native --update-baseline`.',
    link: "A Skia function the native code needs is missing from the release's prebuilt `libskia.a` (arm64): the headers declare it, but an app would fail to link.",
    deprecations:
      'Skia marked something our native drawing code calls as deprecated. It still works; replace it before Skia removes it.',
  }
  const output = group.output.length > 3000 ? `${group.output.slice(0, 3000)}\n...` : group.output
  return [
    `\`${group.pkg}\` fails the **${group.check}** check on: ${group.versions.map((v) => `\`${v}\``).join(', ')}.`,
    '',
    checks[group.check],
    '',
    '```',
    output,
    '```',
    '',
    `Reproduce: \`bun packages/react-native-live2d-skia/scripts/skiaCompat.ts --only ${group.pkg}@${group.versions[0]}${group.check === 'types' ? '' : ' --native'}\``,
    ...(runUrl ? ['', `Found by ${runUrl}`] : []),
    '',
    'This issue is opened once per failure. Later versions that fail in the same way are not reported again.',
    '',
    `<!-- ${markerOf(group)} -->`,
  ].join('\n')
}

/** The groups to open an issue for: not already in an existing issue, at most `limit`. */
export function planIssues(groups: Group[], existingBodies: string[], limit = MAX_NEW_ISSUES) {
  const known = (group: Group) => existingBodies.some((body) => body.includes(markerOf(group)))
  const fresh = groups.filter((g) => !known(g))
  return {
    create: fresh.slice(0, limit),
    skippedKnown: groups.length - fresh.length,
    overLimit: Math.max(0, fresh.length - limit),
  }
}

function gh(args: string[]) {
  const result = spawnSync('gh', args, { encoding: 'utf8', shell: process.platform === 'win32' })
  if (result.status !== 0)
    throw new Error(`gh ${args.slice(0, 2).join(' ')} failed: ${result.stderr || result.stdout}`)
  return result.stdout
}

function main() {
  const files = process.argv.slice(2).filter((arg) => !arg.startsWith('--'))
  if (files.length === 0)
    throw new Error('usage: skiaCompatReport.ts <results.json>... [--dry-run]')
  const dryRun = process.argv.includes('--dry-run')
  // One file per parallel job (types, native): each result holds only the checks that job ran.
  const results = files.flatMap(
    (file) => JSON.parse(fs.readFileSync(file, 'utf8')) as VersionResult[],
  )
  const groups = groupFailures(failuresOf(results))
  if (groups.length === 0) {
    console.log('All Skia versions are compatible: nothing to report.')
    return
  }

  const existing = dryRun
    ? []
    : (
        JSON.parse(
          gh([
            'issue',
            'list',
            '--state',
            'all',
            '--label',
            LABEL,
            '--limit',
            '1000',
            '--json',
            'body',
          ]),
        ) as { body: string }[]
      ).map((i) => i.body)
  const plan = planIssues(groups, existing)
  const repo = process.env.GITHUB_REPOSITORY
  const runUrl =
    repo && process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL ?? 'https://github.com'}/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : null

  console.log(
    `${groups.length} kind(s) of failure: ${plan.create.length} new, ${plan.skippedKnown} already reported, ${plan.overLimit} left for the next run.`,
  )
  if (plan.create.length > 0 && !dryRun) {
    // A label that exists is fine: ignore that error.
    spawnSync(
      'gh',
      [
        'label',
        'create',
        LABEL,
        '--color',
        'B60205',
        '--description',
        'A Skia release does not work with this package',
      ],
      { shell: process.platform === 'win32' },
    )
  }
  for (const group of plan.create) {
    const title = issueTitle(group)
    if (dryRun) {
      console.log(`\n[dry run] would open: ${title}\n${issueBody(group, runUrl)}`)
      continue
    }
    const bodyFile = path.join(os.tmpdir(), `skia-compat-${group.fingerprint}.md`)
    fs.writeFileSync(bodyFile, issueBody(group, runUrl))
    console.log(
      `opened ${gh(['issue', 'create', '--title', title, '--label', LABEL, '--body-file', bodyFile]).trim()}`,
    )
    fs.rmSync(bodyFile, { force: true })
  }
}

if (import.meta.main) main()
