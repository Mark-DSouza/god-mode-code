// Access gate — "Jack in". Composes Wordmark + Input + Button.
const { Wordmark, Input, Button } = window.GODMODECODEDesignSystem_ca0aa4;

function AuthScreen({ onEnter }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
      <div style={{ width: 400, background: "color-mix(in srgb, var(--surface-2) 80%, transparent)", border: "1px solid var(--line-bright)", borderRadius: "var(--radius-md)", boxShadow: "var(--box-glow)", padding: "38px 34px", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}><Wordmark size={18} /></div>
        <div style={{ fontFamily: "var(--font-terminal)", fontSize: "var(--text-xl)", letterSpacing: "0.1em", color: "var(--ink-max)", textShadow: "var(--glow-sm)", marginBottom: 6 }}>JACK IN</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--ink-2)", marginBottom: 26 }}>enter the grid — the rain is waiting</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, textAlign: "left" }}>
          <Input prefix=">" defaultValue="neo_anderson" placeholder="operator handle" />
          <Input prefix="#" type="password" defaultValue="········" placeholder="access key" />
          <div style={{ marginTop: 6 }}><Button size="lg" block onClick={onEnter}>Enter the Grid</Button></div>
          <div style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: "var(--text-2xs)", color: "var(--ink-3)", marginTop: 4 }}>no identity yet? <a href="#" onClick={(e) => { e.preventDefault(); onEnter(); }}>create one</a></div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AuthScreen });
