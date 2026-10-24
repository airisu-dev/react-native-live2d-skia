import { describe, expect, test } from 'bun:test'
import { type PlanInput, parseVersions, planRelease } from './releasePlan'

const base: PlanInput = {
  type: 'stable',
  packageVersion: '1.4.2',
  published: ['1.0.0', '1.4.2', '2.0.0-rc.1'],
  date: '20261024',
  sha: 'abcdef1234567',
}

describe('stable', () => {
  test('is latest when no higher stable version exists', () => {
    expect(planRelease({ ...base, version: '1.5.0' })).toEqual({
      version: '1.5.0',
      npmTag: 'latest',
      gitTag: 'v1.5.0',
      githubRelease: true,
      prerelease: false,
      latest: true,
    })
  })

  test('goes to legacy, and is not the latest release, when a higher major is out', () => {
    const plan = planRelease({ ...base, version: '1.4.3', published: [...base.published, '2.0.0'] })
    expect(plan.npmTag).toBe('legacy')
    expect(plan.latest).toBe(false)
  })

  test('ignores prereleases when deciding what is highest', () => {
    expect(
      planRelease({ ...base, version: '1.5.0', published: ['1.4.2', '9.0.0-rc.1'] }).npmTag,
    ).toBe('latest')
  })

  test('is latest on a first publish', () => {
    expect(planRelease({ ...base, version: '0.1.0', published: [] }).npmTag).toBe('latest')
  })

  test('compares versions as numbers, not text', () => {
    expect(planRelease({ ...base, version: '1.9.0', published: ['1.10.0'] }).npmTag).toBe('legacy')
    expect(planRelease({ ...base, version: '1.10.0', published: ['1.9.0'] }).npmTag).toBe('latest')
  })

  test('rejects a version that is not X.Y.Z, or already published', () => {
    expect(() => planRelease({ ...base, version: '1.5' })).toThrow("isn't a stable version")
    expect(() => planRelease({ ...base, version: '1.5.0-rc.1' })).toThrow("isn't a stable version")
    expect(() => planRelease({ ...base, version: '1.4.2' })).toThrow('already on npm')
    expect(() => planRelease(base)).toThrow('needs a version')
  })
})

describe('candidates', () => {
  test.each(['rc', 'beta', 'alpha'] as const)('%s goes to next as a GitHub prerelease', (type) => {
    expect(planRelease({ ...base, type, version: `3.0.0-${type}.1` })).toEqual({
      version: `3.0.0-${type}.1`,
      npmTag: 'next',
      gitTag: `v3.0.0-${type}.1`,
      githubRelease: true,
      prerelease: true,
      latest: false,
    })
  })

  test('the version must match the release type', () => {
    expect(() => planRelease({ ...base, type: 'rc', version: '2.0.0' })).toThrow(
      "isn't a rc version",
    )
    expect(() => planRelease({ ...base, type: 'rc', version: '2.0.0-beta.1' })).toThrow(
      "isn't a rc version",
    )
    expect(() => planRelease({ ...base, type: 'beta', version: '2.0.0-rc.1' })).toThrow(
      "isn't a beta version",
    )
  })

  test('refuses a candidate that is already published', () => {
    expect(() => planRelease({ ...base, type: 'rc', version: '2.0.0-rc.1' })).toThrow(
      'already on npm',
    )
  })
})

describe('nightly', () => {
  test('is built on the next patch, with the date and short sha, and has no git tag or release', () => {
    expect(planRelease({ ...base, type: 'nightly' })).toEqual({
      version: '1.4.3-nightly.20261024.abcdef1',
      npmTag: 'nightly',
      gitTag: null,
      githubRelease: false,
      prerelease: true,
      latest: false,
    })
  })

  test('builds on the base of a prerelease version in package.json', () => {
    expect(planRelease({ ...base, type: 'nightly', packageVersion: '2.0.0-rc.3' }).version).toBe(
      '2.0.1-nightly.20261024.abcdef1',
    )
  })
})

describe('npm tag override', () => {
  test('replaces the tag the type would pick', () => {
    expect(planRelease({ ...base, version: '1.5.0', npmTag: 'support-1' }).npmTag).toBe('support-1')
    expect(planRelease({ ...base, type: 'rc', version: '2.0.0-rc.2', npmTag: 'beta' }).npmTag).toBe(
      'beta',
    )
  })

  test('a stable release under another tag is not the latest release', () => {
    expect(planRelease({ ...base, version: '1.5.0', npmTag: 'support-1' }).latest).toBe(false)
  })

  test('refuses a tag npm would reject because it reads as a version or a range', () => {
    for (const tag of ['1.x', 'v1', '2', '1.2.3']) {
      expect(() => planRelease({ ...base, version: '1.5.0', npmTag: tag })).toThrow(
        "can't be an npm dist-tag",
      )
    }
  })
})

describe('parseVersions', () => {
  test('reads a list, a single version and an empty answer', () => {
    expect(parseVersions('["1.0.0","1.1.0"]')).toEqual(['1.0.0', '1.1.0'])
    expect(parseVersions('"1.0.0"')).toEqual(['1.0.0'])
    expect(parseVersions('')).toEqual([])
  })
})
