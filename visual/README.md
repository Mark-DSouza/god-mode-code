# Visual regression

Photographs the application and the design system specimen gallery in a real
browser, and compares what it sees against the baselines in `__screenshots__/`.
A difference beyond the threshold fails the build.

Why this exists, and why the rain is seeded rather than switched off, is
[ADR-0012](../docs/adr/0012-design-fidelity-is-checked-against-committed-baselines.md).

## Commands

All three run inside the same container image CI uses. Nothing here should be
run against a locally installed browser — see _Baselines are platform-specific_
below.

```sh
pnpm visual          # run the suite
pnpm visual:update   # regenerate every baseline, then review the diff
pnpm visual:canary   # prove the suite still fails when the design moves
```

They need Docker, and nothing else. The image is pulled on first use.

## What is covered

`tests/specimens.spec.ts` renders every reimplemented design system component in
the states its published specimen card shows, one page per component, at desktop
width. The catalogue is `apps/web/src/specimens/catalogue.tsx`; the list of names
is `apps/web/src/specimens/names.ts`, and it is shared with this suite so a
component with no specimen does not compile.

`tests/screens.spec.ts` renders every product screen at desktop (1280×800) and
mobile (390×844), against a stubbed backend and a stopped clock.

`tests/canary.spec.ts` is not a coverage test — it is the one the canary script
perturbs to check that comparisons are actually being made.

## Updating a baseline

```sh
pnpm visual:update
git add visual/__screenshots__
```

The changed images appear in the pull request as images. That review is the only
thing standing between an intentional redesign and a regression quietly becoming
the new baseline, so look at them: an update that changes files you were not
expecting to change is the signal.

To regenerate one screen rather than all of them, pass Playwright's usual
filters through the package script:

```sh
./visual/run-in-ci-image.sh update --grep "the result screen"
```

## Adding a component

1. Add its name to `apps/web/src/specimens/names.ts`.
2. The catalogue stops compiling. Add the states its `*.card.html` specimen card
   shows to `apps/web/src/specimens/catalogue.tsx`.
3. `pnpm visual:update` to generate the baseline, then open it and check it
   against the card in `mockups-and-design-system/design_system/`.

## Baselines are platform-specific

A screenshot taken on a laptop and a screenshot taken on a GitHub runner differ
in font rasterisation and antialiasing by far more than the comparison
threshold. Both ends therefore happen inside
`mcr.microsoft.com/playwright:v1.61.1-noble`.

That version is pinned in three places, and they have to agree:

- `@playwright/test` in `package.json` / the lockfile
- `IMAGE` in `run-in-ci-image.sh`
- `container.image` in `.github/workflows/ci.yml`

## Debugging a failure

CI uploads `visual-regression-diff` on failure, containing the expected, actual
and difference images plus the HTML report. Locally the same files land in
`test-results/`, and `pnpm --filter @gmc/visual report` opens the report.

If a comparison is failing and the actual image looks correct, the baseline is
stale — regenerate it. If the actual image looks _wrong_, that is the suite doing
its job.
