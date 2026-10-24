// Which native builds a pull request needs (test-build.yml), from the files it changes. JS-only
// changes need none: debug builds don't bundle the JS.
// Run by test-build.yml with EVENT, ACTION, LABEL, LABELS, DRAFT, BASE_SHA, HEAD_SHA, ANDROID, IOS.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'

export type Area = 'android' | 'ios'

const LIB = 'packages/react-native-live2d-skia'
const BOTH: Area[] = ['android', 'ios']

// The first rule that matches a file decides. A file that matches none needs no build.
const RULES: [RegExp, Area[]][] = [
  [/\.test\.tsx?$/, []],
  [new RegExp(`^${LIB}/android/`), ['android']],
  [new RegExp(`^${LIB}/nitrogen/generated/android/`), ['android']],
  [new RegExp(`^${LIB}/ios/`), ['ios']],
  [new RegExp(`^${LIB}/[^/]+\\.podspec$`), ['ios']],
  [new RegExp(`^${LIB}/nitrogen/generated/ios/`), ['ios']],
  [
    new RegExp(
      `^${LIB}/(cpp/|nitro\\.json$|nitrogen/generated/shared/|src/specs/|plugin/|app\\.plugin\\.js$|cli/src/)`,
    ),
    BOTH,
  ],
  [/^apps\/[^/]+\/app\.json$/, BOTH],
  [/^(bun\.lock|scripts\/fetch-cubism-sdk\.sh|\.github\/workflows\/test-build\.yml)$/, BOTH],
]

// package.json files only matter when more than the fields below changed. Dependency changes also
// show up in bun.lock, which is its own rule.
const PACKAGE_JSON = /^(package\.json|(packages|apps)\/[^/]+\/package\.json)$/
const IRRELEVANT_PACKAGE_FIELDS = [
  'scripts',
  'version',
  'description',
  'keywords',
  'author',
  'license',
  'homepage',
  'bugs',
  'repository',
  'publishConfig',
  'files',
  'prettier',
  'react-native-builder-bob',
]

const stripped = (manifest: unknown) => {
  const copy = { ...(manifest as Record<string, unknown>) }
  for (const field of IRRELEVANT_PACKAGE_FIELDS) delete copy[field]
  return JSON.stringify(copy, (_key, value) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
      : value,
  )
}

export function packageJsonAffectsBuild(before: unknown, after: unknown): boolean {
  // Added or deleted: it can't be told apart from a real change.
  if (!before || !after) return true
  return stripped(before) !== stripped(after)
}

export interface Reasons {
  android: string[]
  ios: string[]
}

/** `manifestOf` reads a package.json as it was before and after the change. */
export function affectedAreas(
  files: string[],
  manifestOf: (file: string, side: 'before' | 'after') => unknown,
): Reasons {
  const reasons: Reasons = { android: [], ios: [] }
  for (const file of files) {
    let areas: Area[] = []
    if (PACKAGE_JSON.test(file)) {
      if (packageJsonAffectsBuild(manifestOf(file, 'before'), manifestOf(file, 'after'))) {
        areas = BOTH
      }
    } else {
      areas = RULES.find(([pattern]) => pattern.test(file))?.[1] ?? []
    }
    for (const area of areas) reasons[area].push(file)
  }
  return reasons
}

if (import.meta.main) {
  const env = process.env
  const git = (...args: string[]) => {
    const result = spawnSync('git', args, { encoding: 'utf8' })
    return result.status === 0 ? result.stdout : null
  }

  const labels = (JSON.parse(env.LABELS || '[]') as string[]).map((l) => l.toLowerCase())
  const reasons: Reasons = { android: [], ios: [] }
  let why = ''

  if (env.EVENT === 'workflow_dispatch') {
    if (env.ANDROID !== 'false') reasons.android.push('run by hand')
    if (env.IOS !== 'false') reasons.ios.push('run by hand')
    why = 'Run by hand: the platforms you picked.'
  } else if (
    env.EVENT === 'pull_request' &&
    env.ACTION === 'labeled' &&
    env.LABEL?.toLowerCase() !== 'native-build'
  ) {
    // Adding some other label must not rebuild what the last push already built.
    why = `The label "${env.LABEL}" was added: nothing to build.`
  } else if (labels.includes('native-build')) {
    reasons.android.push('label native-build')
    reasons.ios.push('label native-build')
    why = 'The `native-build` label forces both platforms.'
  } else if (env.DRAFT === 'true') {
    why = 'Draft pull request: add the `native-build` label, or mark it ready for review.'
  } else {
    const diff = git('diff', '--name-only', `${env.BASE_SHA}...${env.HEAD_SHA}`)
    if (diff === null) throw new Error(`git diff ${env.BASE_SHA}...${env.HEAD_SHA} failed`)
    const files = diff.split('\n').filter(Boolean)
    const read = (file: string, side: 'before' | 'after') => {
      const text =
        side === 'before'
          ? git('show', `${env.BASE_SHA}:${file}`)
          : git('show', `${env.HEAD_SHA}:${file}`)
      return text === null ? null : JSON.parse(text)
    }
    Object.assign(reasons, affectedAreas(files, read))
    why = `${files.length} changed file(s).`
  }

  const android = reasons.android.length > 0
  const ios = reasons.ios.length > 0
  const list = (items: string[]) =>
    items.length ? items.map((f) => `- \`${f}\``).join('\n') : '- none'
  const summary = [
    '### Native builds',
    '',
    why,
    '',
    `**Android: ${android ? 'build' : 'skip'}**`,
    list(reasons.android),
    '',
    `**iOS: ${ios ? 'build' : 'skip'}**`,
    list(reasons.ios),
    '',
  ].join('\n')
  console.log(summary)
  if (env.GITHUB_STEP_SUMMARY) fs.appendFileSync(env.GITHUB_STEP_SUMMARY, `${summary}\n`)
  if (env.GITHUB_OUTPUT) fs.appendFileSync(env.GITHUB_OUTPUT, `android=${android}\nios=${ios}\n`)
}
