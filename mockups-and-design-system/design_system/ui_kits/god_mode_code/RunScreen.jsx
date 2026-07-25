// Active typing run — real keyboard input drives the TypingField + live stats.
const { TypingField, Stat, ProgressBar, Button, Card, IconButton } = window.GODMODECODEDesignSystem_ca0aa4;

function RunScreen({ category, onDone, onExit, onIntensity }) {
  const passages = window.CHALLENGES[category].passages;
  const [text] = React.useState(() => passages[Math.floor(Math.random() * passages.length)]);
  const [typed, setTyped] = React.useState("");
  const [startAt, setStartAt] = React.useState(null);
  const [now, setNow] = React.useState(0);
  const [errors, setErrors] = React.useState(0);
  const wrapRef = React.useRef(null);

  const elapsed = startAt ? (now - startAt) / 1000 : 0;
  const words = typed.length / 5;
  const wpm = elapsed > 0.5 ? Math.round((words / elapsed) * 60) : 0;
  const correctCount = typed.split("").filter((ch, i) => ch === text[i]).length;
  const accuracy = typed.length ? Math.round((correctCount / typed.length) * 1000) / 10 : 100;

  React.useEffect(() => { wrapRef.current?.focus(); }, []);
  React.useEffect(() => {
    if (!startAt) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [startAt]);

  // Feed the rain: faster typing -> higher intensity.
  React.useEffect(() => { onIntensity?.(startAt ? Math.min(1, 0.6 + wpm / 220) : 0.7); }, [wpm, startAt]);

  function handleKey(e) {
    if (e.key === "Escape") { onExit(); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "Backspace") { setTyped((t) => t.slice(0, -1)); e.preventDefault(); return; }
    if (e.key.length !== 1) return;
    e.preventDefault();
    if (!startAt) setStartAt(Date.now());
    const next = typed + e.key;
    if (e.key !== text[typed.length]) setErrors((n) => n + 1);
    setTyped(next);
    if (next.length >= text.length) {
      const secs = Math.max(0.1, (Date.now() - (startAt || Date.now())) / 1000);
      onDone({ wpm: Math.round((text.length / 5 / secs) * 60), accuracy, time: Math.round(secs), errors });
    }
  }

  const pct = Math.round((typed.length / text.length) * 100);
  return (
    <div ref={wrapRef} tabIndex={0} onKeyDown={handleKey} style={{ outline: "none", maxWidth: 900, margin: "0 auto", padding: "40px 28px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 26 }}>
        <div style={{ display: "flex", gap: 40 }}>
          <Stat value={wpm} unit="wpm" label="Speed" size="sm" align="left" />
          <Stat value={accuracy} unit="%" label="Accuracy" size="sm" align="left" accent={accuracy >= 97 ? "green" : "warning"} />
          <Stat value={Math.floor(elapsed)} unit="s" label="Time" size="sm" align="left" accent="white" />
        </div>
        <IconButton label="Abort (Esc)" variant="outline" onClick={onExit}><i data-lucide="x"></i></IconButton>
      </div>

      <Card scanlines padding="var(--space-6)" style={{ minHeight: 200, display: "flex", alignItems: "center" }}>
        <TypingField text={text} typed={typed} />
      </Card>

      <div style={{ marginTop: 22 }}><ProgressBar value={pct} showLabel /></div>
      <div style={{ textAlign: "center", marginTop: 18, fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--ink-3)" }}>
        {startAt ? "keep going — the rain is with you" : "start typing to begin the clock"}
      </div>
    </div>
  );
}

Object.assign(window, { RunScreen });
