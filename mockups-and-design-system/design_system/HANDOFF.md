# Handing GOD_MODE_CODE to Claude Code

This project is a **design system**, structured to drop straight into Claude Code as an [Agent Skill](https://docs.claude.com/en/docs/claude-code/skills). Everything a developer (or Claude Code) needs to build the real app is here.

## Fidelity
**High-fidelity.** Colors, type, spacing, glow/scanline effects, and interaction states are all final. Recreate pixel-faithfully using the tokens and components below — don't eyeball values.

## What's in the box
- `SKILL.md` — the skill entry point (YAML frontmatter + instructions). Claude Code reads this first.
- `readme.md` — the full design guide: brand context, content voice, visual foundations, iconography, and the component/UI-kit index. **Read this second.**
- `styles.css` + `tokens/` — the token layer (colors, type, spacing, effects, fonts, base). Consumers link `styles.css`; everything else is `@import`ed from it.
- `components/` — 26 React components, each with a `.jsx` (implementation), `.d.ts` (props contract), and `.prompt.md` (usage). Grouped: `effects/`, `core/`, `typing/`, `data/`, `navigation/`, `feedback/`, `brand/`.
- `ui_kits/god_mode_code/` — the full interactive product recreation (auth → home → countdown → run → result, plus leaderboard, profile, settings). This is the reference for *how the screens compose*.
- `templates/god_mode_code/` — a copy-paste starting template.
- `guidelines/` — foundation specimen cards.

## How to use it in Claude Code
1. Copy this whole folder into your project, e.g. `.claude/skills/god-mode-code-design/`.
2. In Claude Code, invoke the skill (`god-mode-code-design`) or just ask it to "build the GOD_MODE_CODE app using the design system in this skill."
3. Claude Code will read `SKILL.md` → `readme.md`, then consume the tokens and components.

## Building the app (recommended path)
- **Framework:** React (the components are already React). Vite + React is the natural fit; adapt to your stack otherwise.
- **Tokens:** ship `styles.css` as-is (or port the CSS custom properties into your token system). Never hardcode hex — use `var(--rain-green)` etc.
- **Components:** the `.jsx` files are production-ready primitives — import them directly, or reimplement against your component conventions using each `.d.ts` as the contract and `.prompt.md` as the usage guide.
- **Screens:** rebuild the real product by composing primitives the way `ui_kits/god_mode_code/` does. The UI kit fakes data and state (fixtures in `data.js`) — wire those to your real backend, run lifecycle, and persistence.
- **Signature behavior:** `DigitalRain` sits fixed behind every screen at ~55% opacity and rises with WPM (`intensity`/`speed`). The run lifecycle is idle → countdown → running → complete; compute WPM = (correct chars / 5) / minutes, accuracy = correct / total keystrokes.

## Caveats to carry over
- **Fonts** are Google Fonts substitutions (Share Tech Mono / JetBrains Mono / VT323) — swap for licensed binaries if acquired.
- **No real logo** — the `Wordmark` component (`▚` + wordmark) stands in.
- **Icons** are Lucide via CDN.
