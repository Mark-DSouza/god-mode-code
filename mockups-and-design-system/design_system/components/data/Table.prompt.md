**Table** — a terminal data grid / ranked list; supports a pinned "your row" highlight (used on the leaderboard).

```jsx
<Table
  columns={[
    { key: "rank", label: "#", width: "48px", align: "center" },
    { key: "user", label: "User" },
    { key: "wpm", label: "WPM", width: "80px", align: "right" },
    { key: "acc", label: "Acc", width: "72px", align: "right", muted: true, render: v => v + "%" },
  ]}
  rows={rows}
  getRowKey={r => r.rank}
  getHighlight={r => r.user === "you"} />
```
Each column: `key`, `label`, optional `width`, `align`, `mono`, `muted`, `render(value,row)`.
