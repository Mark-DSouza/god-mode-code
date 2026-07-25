// Profile screen — Avatar + streak Badge + CRT Stat readouts + RunChart.
const { Avatar, Badge, Stat, RunChart, Card } = window.GODMODECODEDesignSystem_ca0aa4;

function ProfileScreen() {
  const runs = [96, 104, 88, 118, 110, 126, 121, 133, 119, 140, 131, 148, 129, 136];
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 28px", display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <Avatar initials="YU" size={64} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "var(--font-terminal)", fontSize: "var(--text-xl)", letterSpacing: "0.08em", color: "var(--ink-max)" }}>you</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--ink-2)", marginTop: 2 }}>jacked in 42 days ago · 88 runs logged</div>
        </div>
        <Badge tone="green" dot>7-day streak</Badge>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        <Card padding="var(--space-5)"><Stat value={112} unit="wpm" label="All-time best" size="md" align="left" /></Card>
        <Card padding="var(--space-5)"><Stat value={98} unit="wpm" label="30-day avg" size="md" align="left" /></Card>
        <Card padding="var(--space-5)"><Stat value="98.4" unit="%" label="Best accuracy" size="md" align="left" accent="warning" /></Card>
      </div>
      <RunChart values={runs} label="Last 14 runs · WPM" peakLabel={"peak " + Math.max(...runs)} />
    </div>
  );
}

Object.assign(window, { ProfileScreen });
