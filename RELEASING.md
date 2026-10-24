# Releasing

Releases are made by hand from GitHub: **Actions > Release > Run workflow** (`.github/workflows/release.yml`),
plus an automatic nightly. Every run first passes the same checks as CI (biome, typecheck, tests,
`verify:package`). The version and npm tag rules are in
`packages/react-native-live2d-skia/scripts/releasePlan.ts` and its tests.

**Start with the default, `dry-run`**: it does everything except publishing, tagging and creating the
Release, and shows the plan in the run's summary.

## Release types

| Type                  | Version you enter | npm tag                                                    | What it does                                                                                                                                     |
| --------------------- | ----------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `stable`              | `1.2.3`           | `latest`, or `legacy` if a higher stable version is on npm | Commits the version bump (and `bun.lock`) to the branch you ran it from, tags `v1.2.3`, creates the GitHub Release                               |
| `rc`, `beta`, `alpha` | `1.2.3-rc.1`      | `next`                                                     | Tags `v1.2.3-rc.1` and creates a GitHub prerelease. The version is set in CI only, nothing is committed                                          |
| `nightly`             | none              | `nightly`                                                  | Runs every night on the default branch as `X.Y.(Z+1)-nightly.DATE.SHA`, and is skipped when that commit is already published. No tag, no Release |

`npm-tag` overrides the tag a type would pick. It can't be a number or look like one (`1.x`, `v1`): npm rejects it.

## Day to day

- **Try the newest code:** `npm i @airisu-dev/react-native-live2d-skia@nightly`
- **Cut a candidate:** run `rc` with `0.2.0-rc.1`, then `0.2.0-rc.2`, and so on. Installs of `@next` get it.
- **Release:** run `stable` with `0.2.0` from `main`.
- **Patch an older major** (a 1.x fix while 2.x is current): create a branch from the last 1.x tag
  (`git branch support/1.x v1.4.2`), cherry-pick the fix (`git cherry-pick -x <sha>`), and run `stable`
  with `1.4.3` from that branch. It goes to `legacy`, not `latest`, and it isn't marked the latest GitHub Release.

## Release notes

The GitHub Release body is generated from the commits since the previous tag: the last stable tag for a
stable release, the nearest earlier tag for a candidate. Type your own text in the `notes` input and it
appears above the generated list. You can also edit the Release on GitHub afterwards. There is no
`CHANGELOG.md`.

## One-time setup

- **`NPM_TOKEN`** (repo secret): an npm granular access token with publish rights on the `@airisu-dev`
  scope. Publishing uses provenance (`id-token: write`). Moving to npm trusted publishing later removes the
  secret; it can be set up once the package exists on npm.
- **Branch protection:** a stable release pushes a `chore: release vX.Y.Z` commit to the branch it was run
  from, so Actions must be allowed to push there (or bypass the rule).

## If a run fails

- **Before "Publish to npm":** nothing was released. Fix it and run again.
- **At "Publish to npm":** a failed publish leaves no tag, commit or Release. Run again.
- **After publishing** (the push, tag or Release step failed): the version is already on npm and can't be
  reused. Finish by hand: push the tag (`git tag vX.Y.Z <commit>`, `git push origin vX.Y.Z`) and create the
  Release with `gh release create vX.Y.Z --generate-notes`.
