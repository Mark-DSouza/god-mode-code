**TypingField** — the heart of GOD_MODE_CODE; renders a passage with live per-glyph typing state. Presentational: you own the keystroke state and pass `typed`.

```jsx
<TypingField text="the quick brown fox" typed="the qui" />
```
Correct = green glow, wrong = red flash (spaces show ␣), current glyph = blinking caret, untyped = dim. Pair with `DigitalRain` behind it and a `Stat` for WPM.
