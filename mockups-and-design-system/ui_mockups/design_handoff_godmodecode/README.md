# Handoff: GOD_MODE_CODE — Speed-Typing App

## Overview
GOD_MODE_CODE is a speed-typing website. Users measure how fast they type across three **disciplines** — motivational **quotes**, short **code** blocks, and profound **prose** passages. The signature experience: Matrix-style **digital rain** falls behind every screen and intensifies as you type. This bundle contains high-fidelity mockups of the complete screen set — 18 frames covering access, the run flow and its states, results, leaderboard, profile, settings, system states, and mobile.

## About the Design Files
The file in this bundle (`Mockups.dc.html`) is a **design reference created in HTML** — a prototype showing intended look and behavior, **not production code to copy directly**. It is authored as a "Design Component" and renders all 18 screens as a single pannable gallery of framed mockups.

Your task is to **recreate these designs in the target codebase's environment** using its established patterns. If no codebase exists yet, **React** is the natural choice — the design system already ships React components (see below).

**Critical:** these mockups are built on an existing **design system** that already provides the real components (Button, Card, TypingField, DigitalRain, ResultPanel, etc.) and design tokens. **Do not re-implement styling from the HTML by hand.** Wire up the design system's components and tokens; the mockups only show how to *compose* them.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, glow/scanline effects, and interaction states are all intended as shown. Recreate pixel-faithfully using the design system's components and token variables (`var(--rain-green)`, `var(--surface-2)`, etc.) rather than hardcoding values.

## The Design System (start here)
The mockups depend on the **GOD_MODE_CODE Design System**. It ships:
- **Tokens** (CSS custom properties): `tokens/colors.css`, `fonts.css`, `typography.css`, `spacing.css`, `effects.css`, `base.css`.
- **React components** under `components/`:
  - `effects/DigitalRain` — the signature full-bleed Matrix rain canvas. Props: `intensity` (0–1), `speed`, `color`, `fontSize`.
  - `core/`: `Button` (variant primary/secondary/ghost/danger, size, block), `IconButton`, `Kbd`, `Badge` (tone, dot), `Card` (glow, scanlines), `Stat`, `ProgressBar` (value, tone, showLabel), `Input` (prefix, type), `Switch` (checked), `Select` (value, options), `Tabs` (value, items), `Dialog`.
  - `typing/`: `TypingField` (text, typed, size — renders per-glyph correct/wrong/caret/untyped), `ChallengeCard` (glyph, title, meta, description, selected), `ResultPanel` (verdict, wpm, accuracy, time, errors, isBest).

Obtain the design system source and consume it as a package/module. Each component has a `.d.ts` (types) and `.prompt.md` (usage) alongside its `.jsx`.

### Known design-system gaps
These were hand-built in the mockups because the DS doesn't yet provide them. Either add them to the DS or build them locally: **Table/ranked-list with row highlight** (leaderboard), **Avatar** tile, **Breadcrumb**, **SettingRow** (label + description + trailing control), **CodeStub/editor** (line-numbered gutter + empty stub with live caret). Also: DS surfaces should be ~90% opacity over the void so rain reads through — the mockups override this locally; prefer fixing it in the tokens.

## Screens / Views
All frames sit on a `DigitalRain` background at ~50% opacity. Chrome header is a fixed translucent bar (`color-mix` over `--void` + `backdrop-filter: blur`) with the `▚ GOD_MODE_CODE` wordmark, nav (Leaderboard, About), and an avatar tile.

**01 Access**
- **Sign in / Jack in** — centered card (~400px), `Input` fields with `>` and `#` prefixes, full-width primary `Button` "Enter the Grid". Calm rain.
- **Signal lost (error)** — full-screen fault: giant pulsing `!` in `--error` red, "SIGNAL LOST", Reconnect / Work Offline buttons. Dimmed rain. The one screen red owns the void.

**02 Home & Selection**
- **Home** — hero "HOW FAST CAN YOU TYPE?", discipline `Tabs`, three `ChallengeCard` tiles (Code selected), primary `Button` "Start Run" + keyboard hint (`⏎` / `Esc`).
- **Code · Problem browser** — breadcrumb, "CODE PROBLEMS" title, **language** `Select`, difficulty **filter** `Tabs` (All / Junior / Senior / Principal), a scrollable problem list (row = name + meta + seniority badge, selected row highlighted), a TWO SUM description card, and a line-numbered **empty stub** (`def two_sum(nums, target):` + `# type your solution` + live caret) — the user types their own solution, never over finished code.
- **Countdown** — oversized `--font-crt` "3" with white-cored shine glow, discipline·seniority badge, dimmed passage preview. Rain steps up.

**03 The Run** (three states, same layout: stats row + `Card`/`TypingField` + `ProgressBar`)
- **Idle** — full passage dim, caret at glyph 1, stats zeroed, "start typing to begin the clock".
- **Mid-type** — correct glyphs glow green, caret mid-passage, live WPM/accuracy/time, `ProgressBar` ~55%, rain hot.
- **Wrong keystroke** — mistyped glyph flashes `--error` red, accuracy + error count in red, `ProgressBar` tone="error", error hint copy.

**04 Results**
- **Complete** — `ResultPanel` four-up `Stat` grid (WPM/accuracy/time/errors) over a top-3 leaderboard snippet, amber "Run logged" `Badge`, Run Again / Change Mode.
- **New personal best** — `ResultPanel` with `isBest`, pulsing amber "New personal best" badge, a delta callout ("↑ 39 · Fastest run yet"), Run Again / Share Run.

**05 Data**
- **Leaderboard** — header + discipline `Select` + time-range `Tabs` (Today / This Week / All Time), ranked table; "you" row pinned in a green-tinted highlight with a left marker.
- **Profile** — avatar tile + handle + streak `Badge`, three CRT `Stat` readouts (all-time best / 30-day avg / best accuracy), and a phosphor bar chart of the last 14 runs (peak run glows brightest).

**06 System**
- **Settings** — `SettingRow`s with `Switch` toggles (digital rain, live WPM, keystroke sound) and a difficulty `Select`, closing on a red-bordered **danger zone** with a `danger` `Button` "Wipe All Runs".
- **Confirm dialog** — `Dialog`: green-glowing bordered modal over a blurred scrim, rain faintly visible behind. Cancel / Wipe Everything (danger).
- **Empty state** — first-visit profile: single dim `_` caret glyph, whisper-quiet rain, one primary "Start Your First Run".

**07 Mobile** (322×~690 device frames, iOS-style status bar)
- **Home** — discipline tiles stacked, full-width Start Run, a "best played on desktop" note under Code mode.
- **Run** — three-up compact stats over `TypingField` at `md` size, rain hot.
- **New best** — single hero WPM numeral with accuracy + errors beneath, stacked full-width actions.

## Interactions & Behavior
- **Run lifecycle:** idle → (first keystroke starts clock) counting → complete → result. Track typed string vs. target; compute WPM = (correct chars / 5) / minutes, accuracy = correct / total keystrokes, errors = wrong keystrokes.
- **DigitalRain reactivity:** raise `intensity`/`speed` as the run progresses / WPM climbs; calm when idle. Mockup values: idle `intensity≈0.5 speed≈0.75`, active `≈0.72/1.25`, hot `≈0.96/1.9`, faint `≈0.28`.
- **TypingField:** per-glyph state — untyped (dim), correct (green glow), wrong (red flash), caret (blinking block, hard steps `gmc-caret`).
- **Wrong keystroke:** flash red, increment errors, recolor accuracy + `ProgressBar` to error tone; backspace restores.
- **Transitions:** 90–180ms on snappy eases (`--ease-snap`, `--ease-out`). Press = `translateY(1px) scale(0.985)`. Hover = brighten toward `--rain-bright` + intensify glow. No bounce/float.
- **Keyboard:** `⏎` starts a run, `Esc` resets/aborts.
- **New best:** when WPM beats stored best, show `isBest` ResultPanel + pulsing badge + delta callout.

## State Management
- `phase`: idle | counting | running | complete
- `discipline` (quotes/code/prose), `seniority` (junior/senior/principal), `language` (code only)
- `targetText`, `typedText`, `startTime`, `errorCount`
- Derived: `wpm`, `accuracy`, `progress`, `isNewBest`
- Persisted: per-discipline bests, run history (for profile chart), leaderboard entries, settings (rain on/off, live WPM, keystroke sound, default difficulty)
- Countdown timer (3→1) before `running`.

## Design Tokens (from the design system — use the vars, don't hardcode)
- **Color:** `--void #000`; rain scale `--rain-shine` (near-white) → `--rain-bright` → `--rain-green #00FF41` → `--rain-faint`; surfaces `--surface-1/2/3` (black + green tint); lines `--line` / `--line-bright`; semantic `--error #FF2E4C`, `--warning` (amber), `--info` (cyan). Max 1–2 hues on screen.
- **Type:** `--font-terminal` Share Tech Mono (uppercase, wide-tracked — chrome/labels/buttons); `--font-mono` JetBrains Mono (typing surface, code, body); `--font-crt` VT323 (oversized stat numerals). Ligatures off on the typing grid.
- **Spacing:** 4px grid. Container `--container` 1120px.
- **Radius:** `--radius-sm` 3px (controls), `--radius-md` 4px (panels), `--radius-pill` (tags/dots only).
- **Effects:** phosphor bloom `--glow-sm/md/lg` (text-shadow), `--box-glow` (focus ring + bloom), `--glow-shine` (white-cored), `--elev-1/2` (hairline border + soft black shadow), scanline overlay on `Card scanlines`.
- **Keyframes:** `gmc-caret` (hard-step blink), `gmc-flicker`, glow pulse.

## Assets
- **DigitalRain** is generated on `<canvas>` — no image asset needed.
- **Icons:** Lucide (`unpkg.com/lucide`) — thin stroke; e.g. `x` for abort. Plus unicode glyphs used as brand icons: `{ }` (Code), `¶` (Prose), `❝❞` (Quotes), `>` (prompt), `▚` (mark), `▼` (select).
- **Logo:** none — the `GOD_MODE_CODE` wordmark in Share Tech Mono with green glow stands in. Ask the client for a real mark.
- **Fonts:** Google Fonts substitutions (Share Tech Mono / JetBrains Mono / VT323), loaded via `tokens/fonts.css`.
- **No emoji**, ever.

## Screenshots
Rendered PNGs of every frame are in `screenshots/` (2x). Order matches the screens above:
`01-signin` `02-signal-lost` `03-home` `04-code-browser` `05-countdown` `06-run-idle` `07-run-midtype` `08-run-error` `09-result-complete` `10-result-best` `11-leaderboard` `12-profile` `13-settings` `14-dialog` `15-empty` `16-mobile-home` `17-mobile-run` `18-mobile-best`.

## Files
- `Mockups.dc.html` — all 18 design-reference frames. Open in a browser to view; it is a gallery, not the app shell.
- The **GOD_MODE_CODE Design System** (tokens + React components) is the real dependency — obtain and consume it; do not rebuild its components from the mockup markup.
