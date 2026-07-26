# Design fidelity is checked against committed baselines

Every other test seam in this repository asserts about structure: a token
resolves, a `className` override wins, an ARIA role is present, the backend
answers. All of them were green while the walking skeleton shipped three visible
defects, and all three were mistakes in how the design system was _composed_
rather than in the components themselves.

`RainBackdrop` passed neither `intensity` nor `speed`, inheriting `DigitalRain`'s
own defaults of `0.65 / 1`. No frame in the mockups renders at those values — the
four defined levels are calm `0.5/0.75`, faint `0.28`, mid `0.72/1.25` and hot
`0.96/1.9`, and all eight ambient screens use calm — so the idle screen rendered
as though the user were already typing, with the rain competing against the body
copy in front of it. The status `Card` passed `glow`, which in the design is the
**selected** state and is what separates the chosen Discipline tile from the two
beside it. And `Stat`, the oversized CRT numeral readout, was used for a status
word and a version string, though every use in the design is a number and VT323
is a numeral face.

None of those are catchable by a check that does not look at pixels. `HANDOFF.md`
asks for the design to be recreated "pixel-faithfully" and nothing enforced it.

The suite lives in `visual/`, renders the application and a specimen gallery in a
real browser, and compares what it photographs against images committed to the
repository. Four decisions in it are worth recording, because each has an obvious
cheaper alternative that does not work.

## The reference screenshots are not the baselines

The eighteen frames in
`mockups-and-design-system/ui_mockups/design_handoff_godmodecode/screenshots/`
cannot be diffed against. They are framed inside a fake browser window — titlebar,
traffic lights, a URL bar — and were rendered from the mockup prototype rather
than from this application, so a pixel comparison against them measures mostly
chrome.

They stay what they always were: the reference a person holds our output up
against, once, by eye. What the machine compares is our own rendering against our
own committed baseline, and the specimen gallery is built so that review is
like-for-like — it renders our components in the states the shipped design
system's `*.card.html` specimen cards render theirs, in the same order, against
the same tokens.

## The rain is frozen by a seed, not switched off

`DigitalRain` draws with `Math.random` on every frame — where each column starts,
how fast it falls, which glyph it shows, which one is the bright head — so any
screenshot containing it differs from the last. It already takes an `enabled`
prop, and turning it off for the camera was the cheap option.

That was rejected. The rain is behind every screen in the design, it is the
single most animated thing in the product, and it is where one of the three
defects actually was. Photographing pages with it disabled would leave the most
regression-prone part of the design as the only part not under test, and would
have caught none of the original bug.

Instead `DigitalRain` takes an optional `seed`. Given one, it draws from a
reproducible generator (`seededRandom`, a Mulberry32) instead of `Math.random`,
renders a fixed 180 frames synchronously rather than on `requestAnimationFrame`,
skips the `ResizeObserver` that would draw further from the same stream, waits
for the webfont before rasterising a single glyph, and then marks its canvas
`data-rain-settled`. The seed and the frame count together decide the picture and
nothing else does — not the frame rate, not the wall clock, not how loaded the
machine is.

The seed reaches the application through `VITE_RAIN_SEED`, which Vite replaces
with a literal at build time. An ordinary build compiles it to `undefined`, so
there is no runtime switch in a deployed bundle and no test-only branch shipped
to a visitor.

The Run screen's clock gets the same treatment for the same reason, through
Playwright's fake clock: elapsed seconds and the WPM derived from them are the
largest, most legible numerals on that screen, and a live clock would make them
the one thing that could never be compared.

## Baselines are generated in the image CI compares them in

Font rasterisation, subpixel antialiasing and canvas compositing all differ
between a developer's machine and a GitHub runner — by far more than any
sensible comparison threshold. A baseline generated locally fails in CI for
reasons that have nothing to do with the design, and the usual response to that
is to widen the threshold until the suite has stopped saying anything.

So both happen in `mcr.microsoft.com/playwright:v1.61.1-noble`. CI runs the job
inside it; `visual/run-in-ci-image.sh` runs the same image locally, which is what
`pnpm visual:update` calls. The version is pinned in three places that must
agree: `@playwright/test` in `visual/package.json` — an exact version rather than
a range, so a lockfile refresh cannot move it — `IMAGE` in that script, and
`container.image` in `.github/workflows/ci.yml`. A CI step compares all three and
fails if they have drifted apart, because a client driving a browser the
baselines were never taken with produces failures that look like design drift.

## A test proves the suite can fail

A visual suite that has never gone red is not known to work. Blank baselines, a
threshold wide enough to swallow anything, a comparison that never runs — every
one of those failure modes is indistinguishable from a suite that is passing.

`visual/tests/canary.spec.ts` photographs a real specimen against a real
committed baseline, and `visual/scripts/canary.mjs` runs it twice: once as it
stands, which must pass, and once with the buttons shifted three pixels, which
must fail. CI runs it on every change the suite runs for. Three pixels is
deliberately near the floor of what anyone would file a bug about — a suite that
catches that catches anything worth catching.

## Consequences

The specimen gallery is a second Vite entry point, built only when `VISUAL=1`, so
no deployed bundle carries it. Adding a design system component means adding it
to `apps/web/src/specimens/names.ts`, which does not compile until there is
something to render for it.

Updating a baseline is `pnpm visual:update`, and the changed images land in the
pull request as images, which is the only form in which anybody will actually
look at them. That also means a careless update can launder a regression into the
baseline — the images being reviewable in the diff is the control, and it is a
human one.
