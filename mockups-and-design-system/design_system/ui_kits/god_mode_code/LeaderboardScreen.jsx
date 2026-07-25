// Leaderboard screen — full ranked table with your-row pinned.
const { Table, Avatar, Tabs, Card, Badge } = window.GODMODECODEDesignSystem_ca0aa4;

const FULL_BOARD = [
  { rank: 1, user: "neo_anderson", wpm: 148, acc: 99.2, runs: 1204 },
  { rank: 2, user: "trinity", wpm: 141, acc: 98.7, runs: 903 },
  { rank: 3, user: "morpheus", wpm: 133, acc: 99.9, runs: 1560 },
  { rank: 4, user: "cypher", wpm: 128, acc: 94.1, runs: 421 },
  { rank: 5, user: "you", wpm: 112, acc: 98.4, runs: 88 },
  { rank: 6, user: "tank", wpm: 109, acc: 96.0, runs: 210 },
  { rank: 7, user: "dozer", wpm: 104, acc: 97.3, runs: 143 },
  { rank: 8, user: "switch", wpm: 98, acc: 95.5, runs: 77 },
];

function LeaderboardScreen() {
  const [scope, setScope] = React.useState("code");
  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "48px 28px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <h1 style={{ fontFamily: "var(--font-terminal)", fontSize: "var(--text-2xl)", letterSpacing: "0.08em", color: "var(--ink-max)", textShadow: "var(--glow-sm)" }}>GLOBAL LEADERBOARD</h1>
        <Badge tone="green" dot>live</Badge>
      </div>
      <Tabs value={scope} onChange={setScope} style={{ marginBottom: 20 }}
        items={[{ id: "quotes", label: "Quotes" }, { id: "code", label: "Code" }, { id: "prose", label: "Prose" }]} />
      <Table
        columns={[
          { key: "rank", label: "#", width: "52px", align: "center" },
          { key: "user", label: "User", render: (v) => (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              <Avatar initials={v.slice(0, 2)} size={26} glow={false} />{v}
            </span>) },
          { key: "wpm", label: "WPM", width: "90px", align: "right" },
          { key: "acc", label: "Acc", width: "80px", align: "right", muted: true, render: (v) => v + "%" },
          { key: "runs", label: "Runs", width: "80px", align: "right", muted: true },
        ]}
        rows={FULL_BOARD}
        getRowKey={(r) => r.rank}
        getHighlight={(r) => r.user === "you"} />
    </div>
  );
}

Object.assign(window, { LeaderboardScreen });
