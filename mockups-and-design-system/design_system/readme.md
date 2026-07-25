# GOD_MODE_CODE — Design System

The design system for **GOD_MODE_CODE**, a speed-typing website where users measure how fast they can type across three disciplines: **motivational quotes**, **short coding blocks**, and **profound paragraphs from famous literature**. The signature experience: as you type any challenge, **digital rain** falls across the screen — the falling green code of *The Matrix*.

## Sources provided
- `uploads/Digital_rain_animation_medium_letters_shine.gif` — the sole brand reference: 500×400, 150 frames of Matrix digital rain. Pure black void, phosphor-green glyphs (half-width katakana + Latin + symbols) falling in vertical columns, each column led by a near-white glowing "shine" glyph with a fading green trail behind it. **The entire visual language is derived from this GIF.** No codebase, Figma, logo, or brand guide was supplied.

---

## CONTENT FUNDAMENTALS
How GOD_MODE_CODE writes.

- **Voice:** terse, confident, a little mythic — the calm certainty of Morpheus. Short imperative sentences. Never corporate, never cute.
- **Person:** address the user directly as **you** ("How fast can you type?", "Beat your best WPM"). The system refers to itself impersonally ("System online", "Run logged").
- **Casing:** two registers. **UI chrome, labels, nav, and buttons are UPPERCASE** with wide letter-spacing (`START RUN`, `ACCURACY`, `PRACTICE`). **Body copy and typing content are sentence case.** Headlines are uppercase for impact (`HOW FAST CAN YOU TYPE?`).
- **Terminology:** a typing session is a **run**. The three categories are **disciplines** or **modes**. A completed run is **logged**. Personal record is a **best**. Speed is **WPM**, correctness is **accuracy**.
- **Numbers:** front and center. WPM, accuracy %, time, error count are the reward — always shown large in the CRT numeral face.
- **Emoji:** **none.** The brand vocabulary is glyphs, not emoji — katakana, `{ }`, `¶`, `❝❞`, `>`, `▚`, block/box-drawing characters. Where a symbol is needed, prefer a monospace glyph or a Lucide icon.
- **Vibe:** you are jacked into a terminal. Hacker-cool, focused, high-stakes but playful. Copy examples: *"the rain is with you"*, *"start typing to begin the clock"*, *"System online"*.

---

## VISUAL FOUNDATIONS

**Palette.** One idea: **green phosphor light on a black void.** The background is pure/near-pure black (`--void #000`). Everything luminous is a step on the green **rain scale** — from the near-white `--rain-shine` (leading glyph) through `--rain-green #00FF41` (the core Matrix green) down to `--rain-faint` (a dying trail). Neutrals are black surfaces that lift with a faint green tint (`--surface-1/2/3`). Semantic accents are minimal: **green = correct**, **red `--error #FF2E4C` = a wrong keystroke** (the "red pill"), amber `--warning` for alerts, a rare cyan `--info`. Max one or two hues on screen at once — green does almost all the work.

**Typography.** Fully monospaced — everything sits on a fixed-width grid, echoing both falling code and the act of typing. Three faces: **Share Tech Mono** (`--font-terminal`) for brand, nav, labels, buttons — always uppercase, wide-tracked; **JetBrains Mono** (`--font-mono`) for the typing surface, code, and all body copy; **VT323** (`--font-crt`) for oversized stat numerals (WPM, timers). Ligatures are disabled on the typing grid so every glyph is discrete.

**Backgrounds.** The `DigitalRain` canvas is the universal background — full-bleed, fixed behind content, dimmed to ~55% opacity so foreground text stays legible. It runs calm when idle and **intensifies + speeds up while the user types**. No gradients, no photography, no illustration — just rain on black.

**Animation.** Mechanical and fast. Transitions are 90–180ms on snappy eases (`--ease-snap`, `--ease-out`). Signatures: the blinking **block caret** (`gmc-caret`, hard steps), occasional CRT **flicker** (`gmc-flicker`), and **glow pulsing**. Motion never bounces or floats — it settles like a key bottoming out.

**Glow / shadow system.** The defining effect is **phosphor bloom** — green `text-shadow` layers (`--glow-sm/md/lg`) on lit glyphs, and `--box-glow` (a green ring + outer bloom) on focused/active controls. Elevation is minimal: terminals barely lift — a hairline border plus a soft black outer shadow (`--elev-1/2`). The leading-glyph "shine" gets a white-cored `--glow-shine`.

**Hover / press.** Hover = brighten toward `--rain-bright` + add/intensify glow (buttons, links, cards). Ghost controls fill to `--surface-2` on hover. Press = a 1px downward nudge + slight scale-down (`translateY(1px) scale(0.985)`) — a physical keypress. Links brighten and glow on hover.

**Borders & radius.** Near-square. Default control radius is **3px** (`--radius-sm`), panels **4px** (`--radius-md`); pills (`--radius-pill`) are reserved for tags and status dots. Borders are hairline green-tinted lines (`--line`) that brighten to `--line-bright`/`--rain-green` on focus. This is a screen, not a stack of soft cards.

**Cards / surfaces.** Flat black-green panels with a 1px border and faint outer shadow. Optional `glow` (green edge bloom) and `scanlines` (a faint CRT `repeating-linear-gradient` overlay). No rounded-corner-with-colored-left-border motif; no drop-shadow float. The typing surface is veiled harder than default panels (~72% over the void) so the rain reads strongly through it while typed glyphs stay crisp.

**Difficulty / seniority badges.** Code problems carry a seniority tier rendered as an outline `Badge`, tone-mapped to the semantic palette: **JUNIOR → green** (`--rain-green`), **SENIOR → amber** (`--warning`), **PRINCIPAL → red** (`--error`). The same green/amber/red ramp signals difficulty everywhere (accuracy readouts, filters).

**Transparency & blur.** Core to the look: surfaces are **veiled** — `--surface-1/2/3` (and `--bg-card`, which inherits) resolve to ~90% over `--void`, so the digital rain reads faintly through every panel while text stays crisp. The header and modal scrims sit on `color-mix(... var(--void) ...)` with a light `backdrop-filter: blur`. Use the `--surface-*-solid` tokens only for the rare fully-opaque block.

**Layout.** Centered, contained (`--container` 1120px), generous vertical rhythm. The header is a fixed translucent bar. The typing surface breathes — `--leading-loose` on the passage. 4px spacing grid throughout.

**Imagery vibe.** Cool, high-contrast, black & green, luminous, slightly grainy (scanlines). No warm tones, no photography.

---

## ICONOGRAPHY
- **Primary icon set:** [Lucide](https://lucide.dev) (CDN: `unpkg.com/lucide`), chosen for its thin, consistent stroke that matches the terminal-line aesthetic. Used for chrome and controls (`settings`, `rotate-ccw`, `x`). **Substitution flag:** no icon set was provided with the brand, so Lucide is a substitution — swap if the brand adopts a house set.
- **Glyphs as icons:** the brand leans on monospace/unicode glyphs more than drawn icons — `{ }` (Code), `¶` (Prose), `❝❞` (Quotes), `>` (prompt), `▚` (mark), `▼` (select), `␣` (a mistyped space). These are first-class brand symbols.
- **Brand mark:** the `▚` half-block glyph rendered in VT323 (green, glowing) is the stand-in mark, always paired with the wordmark via the `Wordmark` component. It is a glyph, not a drawn logo.
- **Logo / brand mark:** **none was provided.** The brand is rendered as the **wordmark `GOD_MODE_CODE`** in Share Tech Mono with green glow, optionally preceded by a `▚` block glyph (see `Header.jsx` / `thumbnail.html`). No logo was drawn or invented — per policy, the name stands in for a mark. *Ask the user for a real logo if one exists.*
- **Emoji:** never used.
- **No hand-drawn SVG icons** live in this system; iconography is Lucide (CDN) + unicode glyphs.

---

## Components
Reusable primitives live under `components/`. Public API is `window.GODMODECODEDesignSystem_<hash>.<Name>`.

**effects/**
- `DigitalRain` — the signature Matrix falling-code canvas; full-bleed background, intensifies while typing.

**brand/**
- `Wordmark` — the `▚` mark + `GOD_MODE_CODE` lockup; stands in for a real logo.

**core/**
- `Button` — primary / secondary / ghost / danger action control.
- `IconButton` — square icon-only control (ghost / outline).
- `Kbd` — a keycap glyph for keystrokes/shortcuts.
- `Badge` — status/label pill (green / neutral / error / warning / info; solid; dot).
- `Card` — the terminal surface panel (glow / scanlines / interactive).
- `Stat` — oversized CRT numeral readout (WPM, accuracy, streak).
- `ProgressBar` — segmented phosphor progress track.
- `Input` — terminal text field with prompt prefix + focus glow.
- `Switch` — boxy terminal toggle.
- `Select` — compact terminal dropdown.
- `Tabs` — underlined terminal tab bar.
- `Dialog` — centered modal over a blurred scrim.

**typing/** (domain components)
- `TypingField` — the core typing surface; live per-glyph correct/wrong/caret/untyped state.
- `ChallengeCard` — a selectable discipline tile (Quotes / Code / Prose); `size` sm/md, strong selected ring.
- `ResultPanel` — end-of-run summary; four-up grid of `Stat` readouts.
- `CodeStub` — line-numbered editor surface for the Code discipline, with a live caret.
- `Countdown` — the pre-run "GET READY" screen; giant white-cored shine numeral over a dimmed preview.

**data/**
- `Table` — terminal data grid / ranked list with a pinned "your row" highlight (leaderboard).
- `Avatar` — square terminal identity tile (initials or image) with green glow.
- `RunChart` — phosphor bar chart of recent runs; the peak bar glows brightest (profile).

**navigation/**
- `Breadcrumb` — terminal path trail (godmodecode / code / two-sum).
- `SettingRow` — labeled row + description + trailing control; the Settings workhorse.

**feedback/**
- `EmptyState` — centered no-data placeholder (dim glyph + title + copy + action).
- `FaultState` — full-screen system fault; giant pulsing glyph in red, title, copy, recovery actions.

### Intentional additions
Because no source defined a component inventory, a standard primitive set was authored, plus domain components essential to the typing product and its loved mockups: `DigitalRain` (the brand's defining motif), `TypingField` / `CodeStub` / `Countdown` (the core run interaction and its pre-state), `ChallengeCard` / `ResultPanel` (the two key surfaces), `Table` / `Avatar` / `RunChart` (leaderboard + profile), `Breadcrumb` / `SettingRow` (navigation + settings), `EmptyState` / `FaultState` (system states), and `Wordmark` (the brand lockup — used on every screen).

---

## UI Kits
- `ui_kits/god_mode_code/` — the full interactive speed-typing website (Home → Run → Result) with real keyboard input and live rain. See its `README.md`.

---

## Index / manifest
- `styles.css` — global entry point (the file consumers link); `@import` manifest only.
- `tokens/` — `colors.css`, `fonts.css`, `typography.css`, `spacing.css`, `effects.css`, `base.css`.
- `components/` — `effects/`, `core/`, `typing/` (each `.jsx` + `.d.ts` + `.prompt.md`, and a `@dsCard` HTML per directory).
- `guidelines/` — foundation specimen cards (Colors, Type, Spacing, Brand).
- `ui_kits/god_mode_code/` — the website recreation.
- `thumbnail.html` — homepage tile.
- `SKILL.md` — Agent-Skills-compatible entry point.
- `_ds_bundle.js`, `_ds_manifest.json`, `_adherence.oxlintrc.json` — generated; do not edit.

---

## CAVEATS / SUBSTITUTIONS
- **Fonts are Google Fonts substitutions.** The Matrix films use a proprietary custom glyph face ("Matrix Code NFC") that isn't licensable; a typing product needs a crisp legible monospace anyway. Share Tech Mono / JetBrains Mono / VT323 are loaded via `@import` in `tokens/fonts.css`. **Provide licensed binaries** to self-host if desired.
- **No logo** was provided — the wordmark stands in. Supply a real mark to replace it.
- **Lucide icons** are a substitution (no house icon set given).
