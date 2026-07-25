**ResultPanel** — the summary shown when a run ends; a four-up grid of `Stat` readouts (WPM, accuracy, time, errors) with a headline verdict.

```jsx
<ResultPanel wpm={112} accuracy={98.4} time={21} errors={3} isBest />
```
Accuracy/errors auto-recolor (green/amber/red). Composes `Card` + `Stat`.
