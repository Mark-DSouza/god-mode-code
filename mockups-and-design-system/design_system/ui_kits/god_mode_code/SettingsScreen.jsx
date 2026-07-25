// Settings screen — SettingRow rows with mixed controls.
const { Card, SettingRow, Switch, Select, Avatar, Button, Badge } = window.GODMODECODEDesignSystem_ca0aa4;

function SettingsScreen() {
  const [rain, setRain] = React.useState(true);
  const [sound, setSound] = React.useState(false);
  const [scan, setScan] = React.useState(true);
  const [diff, setDiff] = React.useState("hard");
  const [caret, setCaret] = React.useState("block");

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 28px" }}>
      <h1 style={{ fontFamily: "var(--font-terminal)", fontSize: "var(--text-2xl)", letterSpacing: "0.08em", color: "var(--ink-max)", textShadow: "var(--glow-sm)", marginBottom: 26 }}>SETTINGS</h1>

      <Card padding="var(--space-5)" style={{ marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, paddingBottom: 18, borderBottom: "1px solid var(--line-faint)", marginBottom: 6 }}>
          <Avatar initials="YU" size="lg" />
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-md)", color: "var(--ink-max)" }}>you</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--ink-2)" }}>rank #5 · 88 runs logged</div>
          </div>
          <Badge tone="warning" style={{ marginLeft: "auto" }}>Best 112 wpm</Badge>
        </div>
        <SettingRow label="Digital rain" description="Falling code behind the typing surface.">
          <Switch checked={rain} onChange={setRain} />
        </SettingRow>
        <SettingRow label="Scanlines" description="Faint CRT overlay on panels.">
          <Switch checked={scan} onChange={setScan} />
        </SettingRow>
        <SettingRow label="Keystroke sound" description="Mechanical click on every key.">
          <Switch checked={sound} onChange={setSound} />
        </SettingRow>
        <SettingRow label="Caret style" description="Shape of the typing cursor.">
          <Select value={caret} onChange={setCaret} options={[{ value: "block", label: "BLOCK" }, { value: "line", label: "LINE" }, { value: "underline", label: "UNDERLINE" }]} />
        </SettingRow>
        <SettingRow label="Difficulty" description="Passage length and complexity." divider={false}>
          <Select value={diff} onChange={setDiff} options={[{ value: "easy", label: "EASY" }, { value: "med", label: "STANDARD" }, { value: "hard", label: "NIGHTMARE" }]} />
        </SettingRow>
      </Card>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Button variant="danger">Wipe Progress</Button>
        <Button variant="primary">Save</Button>
      </div>
    </div>
  );
}

Object.assign(window, { SettingsScreen });
