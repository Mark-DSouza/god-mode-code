# god-mode-code

## Agent skills

### Issue tracker

Issues live as GitHub issues on `Mark-DSouza/god-mode-code`, managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, using their default label strings (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Security controls

One credential detector behind three enforcement points, gates that read the diff, and a sweep that reads everything — what fires, what it means, and what to do about it. See `docs/agents/security-controls.md`.

### Domain docs

Single-context — one `CONTEXT.md` and one `docs/adr/` at the repo root. See `docs/agents/domain.md`.
