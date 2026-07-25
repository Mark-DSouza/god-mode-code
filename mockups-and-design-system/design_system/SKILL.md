---
name: god-mode-code-design
description: Use this skill to generate well-branded interfaces and assets for GOD_MODE_CODE, a Matrix-themed speed-typing website, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.
If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.
If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

Quick orientation:
- The whole brand is green phosphor light on a black void, derived from Matrix digital rain. Signature move: the `DigitalRain` canvas behind everything, intensifying as the user types.
- Everything is monospaced. Share Tech Mono (uppercased chrome), JetBrains Mono (body + typing), VT323 (big CRT stat numerals).
- Link `styles.css` for all tokens; mount components from `window.GODMODECODEDesignSystem_<hash>` after loading `_ds_bundle.js`.
- See `components/*/*.prompt.md` for per-component usage, and `ui_kits/god_mode_code/` for a full working example.
