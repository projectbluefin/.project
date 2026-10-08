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

To validate locally:

```bash
# Clone cncf/automation and build the validator
git clone https://github.com/cncf/automation
cd automation/utilities/dot-project
make build
./bin/validator -config /path/to/project.yaml
```

Run the Prow roster authorization tests with `node --test tests/prow-triage.test.cjs`.

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

`/area` and `/remove-area` are public for the configured desktop, flatpak,
gaming, hardware, installer and dx areas. `/kind` and `/hold` retain their
upstream policies. `triage` membership does not grant `/lgtm`, `/approve`, code
write access, or issue-closing permissions. `sync-owners.yml` continues to
generate approvers from `project-maintainers` only.

Deploy this repository's authorization workflow and roster before updating
the six existing Prow callers: common, chairlift, gutenprint-printer-app,
hplip-printer-app, ps-printer-app and ghostscript-printer-app. Then run
**Actions → Prow → Run workflow** in each to sync area labels. Repositories
not yet using Prow, including Dakota, are unchanged.
