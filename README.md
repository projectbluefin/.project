# .project — Project Bluefin Metadata

This repository contains standardized metadata about [Project Bluefin](https://projectbluefin.io) using the [CNCF `.project` schema](https://github.com/cncf/automation/tree/main/utilities/dot-project).

## Files

| File | Description |
|------|-------------|
| `project.yaml` | Core project metadata (name, repositories, governance, legal) |
| `maintainers.yaml` | Maintainer roster |

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

## Updating

- **Adding a maintainer**: Edit `maintainers.yaml` and open a PR
- **Updating project metadata**: Edit `project.yaml` and open a PR
- **Schema reference**: https://github.com/cncf/automation/tree/main/utilities/dot-project
