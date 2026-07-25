**Dialog** — a centered modal with a glowing green border and scanline overlay over a blurred scrim.

```jsx
<Dialog open={open} onClose={close} title="Reset Progress?"
  footer={<><Button variant="ghost" onClick={close}>Cancel</Button><Button variant="danger">Wipe</Button></>}>
  This clears every recorded run.
</Dialog>
```
