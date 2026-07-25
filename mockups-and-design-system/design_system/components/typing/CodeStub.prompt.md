**CodeStub** — a line-numbered editor surface for the Code discipline; gutter + monospace lines with a blinking caret on the active line.

```jsx
<CodeStub lines={["function twoSum(nums, target) {", "  const seen = new Map();", ""]} activeLine={2} />
```
Leave `lines={[""]}` for a bare start. `minLines` pads out short stubs so the panel has body.
