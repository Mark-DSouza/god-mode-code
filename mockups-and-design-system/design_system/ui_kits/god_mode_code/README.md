# GOD_MODE_CODE — Website UI Kit

A high-fidelity, interactive recreation of the GOD_MODE_CODE speed-typing website. The entire experience runs over a live `DigitalRain` canvas that intensifies as you type faster.

## Run it
Open `index.html`. It loads the compiled design-system bundle (`_ds_bundle.js`) plus Google Fonts and Lucide icons from CDN.

## Flow
1. **Home** (`HomeScreen.jsx`) — choose one of three disciplines (Quotes / Code / Prose) via `Tabs` + `ChallengeCard`, then **Start Run**.
2. **Run** (`RunScreen.jsx`) — a real keyboard-driven typing session. `TypingField` shows live per-glyph state; `Stat` readouts track WPM / accuracy / time; `ProgressBar` shows completion. The rain speeds up with your WPM. `Esc` aborts.
3. **Result** (`ResultScreen.jsx`) — `ResultPanel` summary + a global leaderboard.

## Files
- `index.html` — mount + script loading
- `App.jsx` — screen orchestration + rain intensity control
- `Header.jsx` — wordmark + nav chrome
- `HomeScreen.jsx`, `RunScreen.jsx`, `ResultScreen.jsx` — the three screens
- `data.js` — sample passages + leaderboard fixtures

## Notes
Screens compose the published components (`window.GODMODECODEDesignSystem_*`); they do not re-implement primitives. Content (passages, leaderboard) is fixture data, not a real backend.
