# .project — Project Bluefin Metadata

This repository contains standardized metadata about [Project Bluefin](https://projectbluefin.io) using the [CNCF `.project` schema](https://github.com/cncf/automation/tree/main/utilities/dot-project).

## Files

| File | Description |
|------|-------------|
| `project.yaml` | Core project metadata (name, repositories, governance, legal) |
| `maintainers.yaml` | Maintainer and Prow triage-command rosters |
| `prow.yaml` | Organization-wide labels and Prow configuration |

## Validation

The metadata is automatically validated on every PR via the GitHub Actions workflow in `.github/workflows/validate.yaml`.

The upstream metadata actions compile current CNCF validator sources. Keep both
`go_version` inputs aligned with `utilities/dot-project/go.mod` in that source
repository (currently Go 1.27.1).

To validate locally:

```bash
# Clone cncf/automation and build the validator
git clone https://github.com/cncf/automation
cd automation/utilities/dot-project
make build
./bin/validator -config /path/to/project.yaml
```

Run the Prow roster authorization and transfer tests with:
`node --test tests/prow-triage.test.cjs tests/prow-transfer.test.cjs`.

The `validate-prow` job uses the production `parseProwConfig`, `mergeProwConfig`
and `resolveTide` exports from `cncf/prow-github-actions` at reviewed commit
`a192ee15687d4ede4d553ff0929b2b296666afd7` (v3.5.0), not a separate schema.
It installs that checkout's lockfile dependencies with `npm ci --ignore-scripts`
and bundles `scripts/validate-prow.mjs` with its existing esbuild. The job parses
this PR's canonical config and the actual `main`-branch `.github/prow.yaml`
overrides fetched read-only from gutenprint-printer-app, hplip-printer-app,
ps-printer-app and ghostscript-printer-app. It checks each effective merged
configuration, including inherited merge gates and the intentional `area: []`
printer overrides. No remote override code is executed. Upstream ignores some
unknown top-level keys, so this is not a strict typo detector.

## Updating

- **Adding a maintainer**: Edit `maintainers.yaml` and open a PR
- **Adding a triager**: Edit the `triage` team in `maintainers.yaml` and open a PR; this grants Prow commands only, not GitHub organization membership or repository permissions
- **Updating project metadata**: Edit `project.yaml` and open a PR
- **Schema reference**: https://github.com/cncf/automation/tree/main/utilities/dot-project

## Prow command authorization

The reusable `.github/workflows/prow-authorize.yml` reads the current `main`
roster for every comment. Each Prow caller enables `/triage`, `/priority` and
generic `/label` for members of `triage` or `project-maintainers`. Additional
`<repository>-triage` teams apply only to the matching Project Bluefin repository:
`hplip-printer-app-triage` grants `jfmongrain` these commands on HPLIP only.
Removal aliases follow the same authorization. Generic `/label` is gated too,
so verbatim label allowlists cannot bypass the triage restriction. Roster
lookup or parsing failures block comment-command execution rather than grant access;
non-comment events and the scheduled merge backstop do not perform roster lookups.

`/area` and `/remove-area` are public where a repository configures area values.
The canonical values are desktop, flatpak, gaming, hardware, installer and dx;
the four printer applications intentionally disable this family with `area: []`.
`/kind` and `/hold` retain their upstream policies. `triage` membership does not grant `/lgtm`, `/approve`, code
write access, or issue-closing permissions, except in `homebrew-tap`, where
`sync-owners.yml` adds `triage` members to `OWNERS` as approvers and reviewers.
Elsewhere it generates approvers from `project-maintainers` only.

`/transfer <repository>` (and `/transfer-issue`) allows triagers and maintainers
to transfer issues between Project Bluefin repositories via the reusable
`.github/workflows/prow-transfer.yml` workflow and the `MERGERAPTOR` GitHub App.

The reusable transfer workflow checks out this repository at the ref supplied
via the required `app-ref` input. Pin `app-ref` to the same commit the workflow
file is pinned to so the parser code that runs (`scripts/prow-transfer.cjs`)
matches the SHA the caller reviewed. Without this, the SHA pin on the workflow
file only pins the caller; the parser still floats on the mutable default
branch (projectbluefin/common#1446).

### Running Prow as the MERGERAPTOR App

The reusable `.github/workflows/prow-run.yml` runs the Prow action
(`cncf/prow-github-actions` v3.5.0) with a `MERGERAPTOR` App token instead of the
job's `GITHUB_TOKEN`. GitHub does not start workflow runs for events caused by
`GITHUB_TOKEN`, so when Prow adds an `lgtm` + `approved` pull request to a merge
queue with that token, the queue's `merge_group` checks never start and the pull
request waits there indefinitely (chairlift#757 on 2026-11-14: 28 minutes in the
queue, no check runs, until a person re-queued it). Events caused by an App token
do start workflow runs.

A caller switches its `prow` job from the upstream reusable workflow to this one
and passes the same two secrets as `transfer`:

```yaml
  prow:
    needs: authorize
    if: ...  # unchanged
    permissions:  # unchanged
      contents: write
      issues: write
      pull-requests: write
      statuses: write
      actions: write
    uses: projectbluefin/.project/.github/workflows/prow-run.yml@<commit>
    with:
      jobs: ...           # unchanged
      prow-commands: ...  # unchanged
    secrets:
      MERGERAPTOR_APP_ID: ${{ secrets.MERGERAPTOR_APP_ID }}
      MERGERAPTOR_PRIVATE_KEY: ${{ secrets.MERGERAPTOR_PRIVATE_KEY }}
```

When the secrets are unavailable to a run (for example a review on a fork pull
request), the workflow falls back to the caller's `GITHUB_TOKEN`, which is what
every caller used before. With the App token, Prow's comments and label changes come from
`mergeraptor[bot]` instead of `github-actions[bot]`.

Deploy this repository's authorization workflow and roster before updating
the Prow callers: common, bluefin-report, chairlift, dakota-iso, gutenprint-printer-app,
hplip-printer-app, ps-printer-app, ghostscript-printer-app, utah, server, homebrew-tap and fsdk-containers.
Then run **Actions → Prow → Run workflow** in each deployed repository for an
immediate `label-sync` after configuration changes. Repositories not yet using
Prow remain unchanged. Deployment exception: leave `projectbluefin/dakota`'s
caller unchanged and do not dispatch it as part of this rollout. Its existing
organization-config inheritance is not removed; the canonical roster and OWNERS
synchronization matrix are unchanged by this rollout.

## Scheduled reconciliation

Deployed callers run `jobs: sweep lgtm` every four hours at staggered minutes;
other Prow events retain `jobs: lgtm`. `sweep.lookback: 6h` covers the four-hour
interval plus two hours of scheduling delay. Sweep recomputes approvals from
current reviews and repairs recently updated PRs, while `lgtm` also considers
older eligible PRs outside that window. GitHub does not guarantee cron timing;
an outage longer than the lookback can still miss a sweep candidate.

This is an intentional latency tradeoff: Actions CI completion does not trigger
the subscribed `check_suite` path, and native fork reviews are read-only to Prow.
CI-green merges and fork-review approval reconciliation can wait nearly four
hours plus GitHub scheduling delay. An authorized `/approve` or `/lgtm` comment
can reevaluate a PR without waiting for cron. Native branch protections remain
the required CI/review enforcement; neither sweep nor reviewer requests replace
them.

Label repair runs separately once a week on Sunday at staggered minutes during
03:00 UTC, using only `jobs: label-sync`. Manual Prow workflow dispatch and
repository-local Prow-config pushes still run label sync; a central `prow.yaml`
change does not push consumer repositories, so use the manual dispatch above
when labels must be reconciled before the weekly repair.

