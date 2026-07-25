// Home / challenge-selection screen.
const { ChallengeCard, Tabs, Button, Kbd, Badge } = window.GODMODECODEDesignSystem_ca0aa4;

function HomeScreen({ onStart }) {
  const [cat, setCat] = React.useState("code");
  const cats = window.CHALLENGES;
  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "56px 28px 40px" }}>
      <div style={{ textAlign: "center", marginBottom: 44 }}>
        <Badge tone="green" dot style={{ marginBottom: 18 }}>System online</Badge>
        <h1 style={{ fontFamily: "var(--font-terminal)", fontSize: "var(--text-4xl)", letterSpacing: "0.06em", color: "var(--ink-max)", textShadow: "var(--glow-md)", marginBottom: 14 }}>
          HOW FAST CAN YOU TYPE?
        </h1>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-md)", color: "var(--ink-2)", maxWidth: 560, margin: "0 auto", lineHeight: "var(--leading-snug)" }}>
          Pick a discipline. The rain falls while you type. Beat your best WPM.
        </p>
      </div>

      <Tabs value={cat} onChange={setCat} style={{ justifyContent: "center", marginBottom: 26 }}
        items={Object.values(cats).map((c) => ({ id: c.id, label: c.title }))} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18, marginBottom: 34 }}>
        {Object.values(cats).map((c) => (
          <ChallengeCard key={c.id} glyph={c.glyph} title={c.title} description={c.description}
            meta={c.meta} selected={c.id === cat} onClick={() => setCat(c.id)} />
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <Button size="lg" onClick={() => onStart(cat)}>Start Run</Button>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--ink-3)" }}>
          or hit <Kbd>⏎</Kbd> to begin · <Kbd wide>Esc</Kbd> to reset
        </span>
      </div>
    </div>
  );
}

Object.assign(window, { HomeScreen });
