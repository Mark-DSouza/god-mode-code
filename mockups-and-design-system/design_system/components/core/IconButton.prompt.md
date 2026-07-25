**IconButton** — square, icon-only control for toolbars and chrome; pass a Lucide glyph or SVG as children.

```jsx
<IconButton label="Restart" onClick={reset}><i data-lucide="rotate-ccw"></i></IconButton>
<IconButton variant="outline" label="Settings"><i data-lucide="settings"></i></IconButton>
```
Variants `ghost|outline`; sizes `sm|md|lg`. Always pass `label`.
