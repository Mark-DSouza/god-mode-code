**DigitalRain** — the signature Matrix falling-code canvas; use as a full-bleed background behind any GOD_MODE_CODE surface, dialed up while the user is actively typing.

```jsx
<div style={{ position: "relative", height: "100vh", background: "#000" }}>
  <DigitalRain intensity={typing ? 1 : 0.55} speed={typing ? 1.8 : 1}
    style={{ position: "absolute", inset: 0 }} />
  <div style={{ position: "relative", zIndex: 10 }}>{children}</div>
</div>
```

Props: `speed`, `intensity` (0–1, raise while typing), `fontSize`, `color`, `headColor`, `fade` (higher = shorter trails). Always layer real content above it at a higher `z-index` and darken that content's own background so text stays legible over the rain.
