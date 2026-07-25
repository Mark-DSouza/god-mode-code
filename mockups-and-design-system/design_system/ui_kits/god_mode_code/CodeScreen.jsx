// Code discipline screen — breadcrumb + line-numbered CodeStub the user types into.
const { Breadcrumb, CodeStub, Stat, Card, Button, IconButton, Badge } = window.GODMODECODEDesignSystem_ca0aa4;

const SOLUTION = [
  "function twoSum(nums, target) {",
  "  const seen = new Map();",
  "  for (let i = 0; i < nums.length; i++) {",
  "    const need = target - nums[i];",
  "    if (seen.has(need)) return [seen.get(need), i];",
  "    seen.set(nums[i], i);",
  "  }",
  "}",
];

function CodeScreen({ onExit, onDone }) {
  const flat = SOLUTION.join("\n");
  const [typed, setTyped] = React.useState("");
  const [startAt, setStartAt] = React.useState(null);
  const wrapRef = React.useRef(null);
  React.useEffect(() => { wrapRef.current?.focus(); }, []);

  // Derive rendered lines + active line from typed length.
  const typedLines = typed.split("\n");
  const activeLine = typedLines.length - 1;
  const renderLines = SOLUTION.map((ln, i) => (i < typedLines.length ? typedLines[i] : ""));

  const elapsed = startAt ? (Date.now() - startAt) / 1000 : 0;
  const wpm = elapsed > 0.5 ? Math.round((typed.length / 5 / elapsed) * 60) : 0;
  const pct = Math.round((typed.length / flat.length) * 100);

  function handleKey(e) {
    if (e.key === "Escape") { onExit(); return; }
    if (e.metaKey || e.ctrlKey) return;
    if (e.key === "Backspace") { setTyped((t) => t.slice(0, -1)); e.preventDefault(); return; }
    let ch = null;
    if (e.key === "Enter") ch = "\n";
    else if (e.key === "Tab") { ch = "  "; }
    else if (e.key.length === 1) ch = e.key;
    if (ch == null) return;
    e.preventDefault();
    if (!startAt) setStartAt(Date.now());
    const next = typed + ch;
    setTyped(next);
    if (next.length >= flat.length) onDone?.({ wpm, accuracy: 97.8, time: Math.round(elapsed), errors: 2 });
  }

  return (
    <div ref={wrapRef} tabIndex={0} onKeyDown={handleKey} style={{ outline: "none", maxWidth: 860, margin: "0 auto", padding: "36px 28px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <Breadcrumb items={[{ label: "godmodecode", onClick: onExit }, { label: "code", onClick: onExit }, { label: "two-sum" }]} />
        <IconButton label="Abort (Esc)" variant="outline" onClick={onExit}><i data-lucide="x"></i></IconButton>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <h2 style={{ fontFamily: "var(--font-terminal)", fontSize: "var(--text-xl)", letterSpacing: "0.06em", color: "var(--ink-max)" }}>TWO SUM</h2>
        <Badge tone="neutral">easy</Badge>
        <div style={{ marginLeft: "auto", display: "flex", gap: 28 }}>
          <Stat value={wpm} unit="wpm" label="Speed" size="sm" align="left" />
          <Stat value={pct} unit="%" label="Done" size="sm" align="left" accent="white" />
        </div>
      </div>

      <CodeStub lines={renderLines} activeLine={Math.min(activeLine, SOLUTION.length - 1)} minLines={SOLUTION.length} />
      <div style={{ textAlign: "center", marginTop: 16, fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--ink-3)" }}>
        {startAt ? "⏎ for newline · Tab indents" : "start typing the solution to begin"}
      </div>
    </div>
  );
}

Object.assign(window, { CodeScreen });
