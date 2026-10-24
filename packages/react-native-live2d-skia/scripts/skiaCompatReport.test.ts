import { describe, expect, test } from 'bun:test'
import type { VersionResult } from './skiaCompat'
import {
  failuresOf,
  fingerprintOf,
  groupFailures,
  issueBody,
  issueTitle,
  markerOf,
  planIssues,
  splitErrors,
} from './skiaCompatReport'

const ok = { ok: true, output: '' }
const typeError = (property: string, line = 6, dir = 'E:/work/a') =>
  `check.ts(${line},14): error TS2322: Type 'import("${dir}/node_modules/react-native-skia/lib/index")' is not assignable.\n  Property '${property}' is missing in type 'ImageFactory'.`

const result = (
  version: string,
  types = ok,
  native?: typeof ok,
  pkg = 'react-native-skia',
): VersionResult => ({ pkg, version, types, native }) as VersionResult

describe('failuresOf', () => {
  test('lists each failed check of each version, and nothing for compatible versions', () => {
    const failures = failuresOf([
      result('3.3.0'),
      result('3.8.0', { ok: false, output: 'boom' }, { ok: false, output: 'native boom' }),
      result('3.9.0', ok, ok),
    ])
    expect(failures.map((f) => `${f.version}:${f.check}`)).toEqual(['3.8.0:types', '3.8.0:native'])
  })
})

describe('splitErrors', () => {
  const two = `${typeError('A')}\n${typeError('B', 9)}`

  test('splits tsc output at each error, keeping its continuation lines', () => {
    const errors = splitErrors(two)
    expect(errors.length).toBe(2)
    expect(errors[0]).toContain("Property 'A' is missing")
    expect(errors[0]).not.toContain("Property 'B'")
    expect(errors[1]).toContain("Property 'B' is missing")
  })

  test('splits native output into one entry per error, with its source file', () => {
    expect(
      splitErrors(
        'SkiaDrawer.cpp\nx.cpp:1:1: error: a\nx.cpp:2:1: error: b\n\nMeshCache.cpp\ny.cpp:3:1: error: c',
      ),
    ).toEqual([
      'SkiaDrawer.cpp: x.cpp:1:1: error: a',
      'SkiaDrawer.cpp: x.cpp:2:1: error: b',
      'MeshCache.cpp: y.cpp:3:1: error: c',
    ])
  })

  test('is empty for no output', () => {
    expect(splitErrors('  \n')).toEqual([])
  })

  test('a version that breaks in two ways is two failures, and each way is its own issue', () => {
    const groups = groupFailures(
      failuresOf([
        result('3.4.3', { ok: false, output: typeError('A') }),
        result('3.8.0', { ok: false, output: two }),
      ]),
    )
    expect(groups.map((g) => g.versions.join(','))).toEqual(['3.4.3,3.8.0', '3.8.0'])
    expect(groups[1]!.output).toContain("Property 'B'")
    expect(groups[1]!.output).not.toContain("Property 'A'")
  })
})

describe('fingerprintOf', () => {
  test('is the same for the same error on another machine, version or line', () => {
    const a = fingerprintOf(typeError('MakeImageFromEncoded', 6, 'E:/work/a'))
    const b = fingerprintOf(typeError('MakeImageFromEncoded', 9, '/home/runner/work/b'))
    expect(a).toBe(b)
  })

  test('differs for a different error', () => {
    expect(fingerprintOf(typeError('MakeImageFromEncoded'))).not.toBe(
      fingerprintOf(typeError('SomethingElse')),
    )
  })

  test('ignores clang line and column numbers', () => {
    const clang = (line: number) =>
      `/x/y/cpp/drawing/SkiaDrawer.cpp:${line}:7: error: no member named 'foo' in 'SkCanvas'`
    expect(fingerprintOf(clang(12))).toBe(fingerprintOf(clang(80)))
  })
})

describe('groupFailures', () => {
  test('joins the versions that fail in the same way, per package and check', () => {
    const output = typeError('MakeImageFromEncoded')
    const groups = groupFailures(
      failuresOf([
        result('3.8.0', { ok: false, output }),
        result('3.8.1', { ok: false, output: typeError('MakeImageFromEncoded', 7, '/other') }),
        result('3.9.0', { ok: false, output: typeError('Another') }),
        result('2.14.0', { ok: false, output }, undefined, '@shopify/react-native-skia'),
      ]),
    )
    expect(groups.map((g) => `${g.pkg}:${g.versions.join(',')}`)).toEqual([
      'react-native-skia:3.8.0,3.8.1',
      'react-native-skia:3.9.0',
      '@shopify/react-native-skia:2.14.0',
    ])
  })
})

describe('issue text', () => {
  const [group] = groupFailures(
    failuresOf([result('3.8.0', { ok: false, output: typeError('MakeImageFromEncoded') })]),
  )

  test('the title names the package, the first version and the check', () => {
    expect(issueTitle(group!)).toBe('Skia react-native-skia@3.8.0 fails the types check')
    const many = { ...group!, versions: ['3.8.0', '3.8.1', '3.9.0'] }
    expect(issueTitle(many)).toBe('Skia react-native-skia@3.8.0 and 2 later fails the types check')
  })

  test('the body has the error, how to reproduce it, the run and the hidden marker', () => {
    const body = issueBody(group!, 'https://github.com/o/r/actions/runs/1')
    expect(body).toContain("Property 'MakeImageFromEncoded' is missing")
    expect(body).toContain('skiaCompat.ts --only react-native-skia@3.8.0')
    expect(body).toContain('https://github.com/o/r/actions/runs/1')
    expect(body).toContain(`<!-- ${markerOf(group!)} -->`)
  })

  test('a native failure is reproduced with --native', () => {
    const [native] = groupFailures(failuresOf([result('3.8.0', ok, { ok: false, output: 'x' })]))
    expect(issueBody(native!, null)).toContain('--only react-native-skia@3.8.0 --native')
  })

  test('a long error is cut', () => {
    const [long] = groupFailures(
      failuresOf([result('3.8.0', { ok: false, output: 'e'.repeat(10_000) })]),
    )
    expect(issueBody(long!, null).length).toBeLessThan(4000)
  })
})

describe('planIssues: never the same one twice', () => {
  const groups = groupFailures(
    failuresOf([
      result('3.8.0', { ok: false, output: typeError('A') }),
      result('3.9.0', { ok: false, output: typeError('B') }),
      result('3.10.0', { ok: false, output: typeError('C') }),
      result('3.11.0', { ok: false, output: typeError('D') }),
    ]),
  )

  test('opens an issue for each new failure, up to the limit', () => {
    const plan = planIssues(groups, [], 3)
    expect(plan.create.length).toBe(3)
    expect(plan.overLimit).toBe(1)
    expect(plan.skippedKnown).toBe(0)
  })

  test('skips a failure that an existing issue already carries, open or closed', () => {
    const existing = [issueBody(groups[0]!, null), 'an unrelated issue body']
    const plan = planIssues(groups, existing, 10)
    expect(plan.create.map((g) => g.fingerprint)).not.toContain(groups[0]!.fingerprint)
    expect(plan.skippedKnown).toBe(1)
    expect(plan.create.length).toBe(3)
  })

  test('a later version with the same failure is not a new issue', () => {
    const first = groupFailures(
      failuresOf([result('3.8.0', { ok: false, output: typeError('A') })]),
    )
    const later = groupFailures(
      failuresOf([
        result('3.8.0', { ok: false, output: typeError('A') }),
        result('3.8.1', { ok: false, output: typeError('A', 9, '/elsewhere') }),
      ]),
    )
    expect(planIssues(later, [issueBody(first[0]!, null)]).create).toEqual([])
  })

  test('running again after the issues exist opens nothing', () => {
    const existing = groups.map((g) => issueBody(g, null))
    const plan = planIssues(groups, existing)
    expect(plan.create).toEqual([])
    expect(plan.skippedKnown).toBe(4)
  })

  test('the same error on the other package is its own issue', () => {
    const both = groupFailures(
      failuresOf([
        result('3.8.0', { ok: false, output: typeError('A') }),
        result(
          '2.14.0',
          { ok: false, output: typeError('A') },
          undefined,
          '@shopify/react-native-skia',
        ),
      ]),
    )
    expect(planIssues(both, [issueBody(both[0]!, null)]).create.map((g) => g.pkg)).toEqual([
      '@shopify/react-native-skia',
    ])
  })
})
