# Contributing

## Branching strategy
| Branch | Purpose |
|---|---|
| `main` | Stable, release-ready code. Protected: changes only via Pull Request. |
| `develop` | Integration branch for the current sprint. |
| `feature/<ticket>-<short-name>` | One branch per task, e.g. `feature/SCRUM-5-complaint-form`. |
| `fix/<ticket>-<short-name>` | Bug fixes found during QA. |
| `hotfix/<short-name>` | Urgent fix on `main` (e.g. incident in Week 14). |

Flow: `develop` -> `feature/*` -> Pull Request -> review by 1 teammate -> merge to `develop` -> at release, PR `develop` -> `main`.

## Commit messages
Format: `type: short description (SCRUM-xx)`
Types: `feat`, `fix`, `docs`, `test`, `chore`, `ci`, `refactor`.
Example: `feat: add complaint form validation (SCRUM-5)`

## Pull Request rules
- Use the PR template. Link the Jira ticket.
- CI must be green before merging.
- Do not push directly to `main`.
