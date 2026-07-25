**FaultState** — a full-screen system fault; giant pulsing glyph in red, title, copy, recovery actions. Place over dimmed rain.

```jsx
<FaultState title="SIGNAL LOST" description="The grid dropped the connection. Your run could not be logged.">
  <Button>Reconnect</Button>
  <Button variant="ghost">Work Offline</Button>
</FaultState>
```
`tone` `error|warning|info` (default error — the one moment red owns the void).
