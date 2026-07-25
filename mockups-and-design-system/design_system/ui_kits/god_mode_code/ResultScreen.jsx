// Results screen — run summary + leaderboard.
const { ResultPanel, Button, Card, Badge } = window.GODMODECODEDesignSystem_ca0aa4;

function Leaderboard() {
  return (
    <Card padding="var(--space-5)">
      <div style={{ fontFamily: "var(--font-terminal)", fontSize: "var(--text-sm)", letterSpacing: "var(--tracking-wide)", textTransform: "uppercase", color: "var(--ink-max)", marginBottom: 16 }}>
        Global Leaderboard
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {window.LEADERBOARD.map((r) => {
          const me = r.user === "you";
          return (
            <div key={r.rank} style={{
              display: "grid", gridTemplateColumns: "28px 1fr auto auto", alignItems: "center", gap: 14,
              padding: "9px 12px", borderRadius: "var(--radius-sm)",
              background: me ? "color-mix(in srgb, var(--rain-green) 10%, transparent)" : "transparent",
              border: me ? "1px solid color-mix(in srgb, var(--rain-green) 40%, transparent)" : "1px solid transparent",
            }}>
              <span style={{ fontFamily: "var(--font-crt)", fontSize: "var(--text-lg)", color: r.rank <= 3 ? "var(--rain-green)" : "var(--ink-3)" }}>{r.rank}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", color: me ? "var(--rain-bright)" : "var(--ink-1)" }}>{r.user}{me && " ←"}</span>
              <span style={{ fontFamily: "var(--font-crt)", fontSize: "var(--text-lg)", color: "var(--ink-max)" }}>{r.wpm}<span style={{ fontSize: "var(--text-xs)", color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}> wpm</span></span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--ink-2)", minWidth: 46, textAlign: "right" }}>{r.acc}%</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ResultScreen({ result, onRetry, onHome }) {
  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "48px 28px" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <Badge tone="warning" style={{ marginBottom: 14 }}>Run logged</Badge>
      </div>
      <ResultPanel wpm={result.wpm} accuracy={result.accuracy} time={result.time} errors={result.errors} isBest={result.wpm >= 110} style={{ marginBottom: 22 }} />
      <div style={{ marginBottom: 26 }}><Leaderboard /></div>
      <div style={{ display: "flex", justifyContent: "center", gap: 14 }}>
        <Button size="lg" onClick={onRetry}>Run Again</Button>
        <Button variant="secondary" size="lg" onClick={onHome}>Change Mode</Button>
      </div>
    </div>
  );
}

Object.assign(window, { ResultScreen, Leaderboard });
