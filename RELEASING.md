# Releasing

Run **Actions > Release > Run workflow** (`.github/workflows/release.yml`). There is also an automatic
nightly, and merging a release pull request publishes it. Every run first passes the same checks as CI
(biome, typecheck, tests, `verify:package`). The version and npm tag rules are in
`packages/react-native-live2d-skia/scripts/releasePlan.ts` and its tests.

**Start with the default, `dry-run`**: it does everything except publish, tag, open a pull request and
create the Release, and shows the plan in the run's summary.

## A stable release

1. Run the workflow with `stable`, the version (`1.2.3`) and `dry-run` unticked. Put your own release
   notes in `notes` if you like.
2. It opens a pull request `chore: release v1.2.3` that bumps `package.json` and `bun.lock`, and
   publishes nothing yet. The description is the release notes: write them above the `---` line.
3. **Merge the pull request.** The merge publishes `1.2.3` to npm, tags the merge commit `v1.2.3` and
   creates the GitHub Release (your notes, then the generated list of changes since the last stable tag).

If `package.json` already has that version (the first release, `0.1.0`), there is nothing to merge: step 1
publishes right away. Merge the pull request with its title unchanged (it must still start with
`chore: release v`): that is what makes the merge publish.

## Other release types

| Type                  | Version you enter | npm tag                                                    | What it does                                                                                                                                     |
| --------------------- | ----------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `stable`              | `1.2.3`           | `latest`, or `legacy` if a higher stable version is on npm | As above: a release pull request, then the merge publishes                                                                                       |
| `rc`, `beta`, `alpha` | `1.2.3-rc.1`      | `next`                                                     | Publishes now, tags `v1.2.3-rc.1` and creates a GitHub prerelease. The version is set in CI only, nothing is committed                           |
| `nightly`             | none              | `nightly`                                                  | Runs every night on the default branch as `X.Y.(Z+1)-nightly.DATE.SHA`, and is skipped when that commit is already published. No tag, no Release |

`npm-tag` overrides the tag a type would pick. It can't be a number or look like one (`1.x`, `v1`): npm rejects it.

## Day to day

- **Try the newest code:** `npm i @airisu-dev/react-native-live2d-skia@nightly`
- **Cut a candidate:** run `rc` with `0.2.0-rc.1`, then `0.2.0-rc.2`, and so on. Installs of `@next` get it.
- **Patch an older major** (a 1.x fix while 2.x is current): create a branch from the last 1.x tag
  (`git branch support/1.x v1.4.2`), push it, cherry-pick the fix (`git cherry-pick -x <sha>`), and run
  `stable` with `1.4.3` **from that branch**. The release pull request targets `support/1.x`, and merging it
  publishes. It goes to `legacy`, not `latest`, and isn't marked the latest GitHub Release. The branch needs
  this workflow, so cut it from a tag that has it.

## One-time setup

- **`NPM_TOKEN`** (repo secret): an npm granular access token with read and write on the `@airisu-dev`
  scope, allowed to bypass 2FA (CI can't type a code). Publishing uses provenance (`id-token: write`).
  Trusted publishing can replace the secret once the package exists on npm.
- **Pull requests from Actions:** Settings > Actions > General > "Allow GitHub Actions to create and
  approve pull requests" must be on, for the release pull request.
- **Checks on the release pull request:** a pull request opened by the workflow doesn't start other
  workflows (a GitHub rule for `GITHUB_TOKEN`), so CI won't run on it. The release run repeats the checks
  before it publishes.
- **Labels:** the `native-build` label forces the native builds on a pull request (see `test-build.yml`).

## If a run fails

- **Before "Publish to npm":** nothing was released. Fix it and run again.
- **At "Publish to npm":** a failed publish leaves no tag and no Release. Run again, or for a merged
  release pull request, re-run the failed workflow run.
- **After publishing** (the tag or Release step failed): the version is already on npm and can't be
  reused. Finish by hand: `git tag vX.Y.Z <commit>`, `git push origin vX.Y.Z`, then
  `gh release create vX.Y.Z --generate-notes`.
