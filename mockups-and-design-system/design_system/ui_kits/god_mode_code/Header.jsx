// Header chrome + wordmark for the GOD_MODE_CODE site.
const { IconButton, Wordmark, Avatar } = window.GODMODECODEDesignSystem_ca0aa4;

function Header({ nav = "practice", onNav }) {
  const items = [["practice", "Practice"], ["leaderboard", "Leaderboard"], ["about", "Settings"]];
  return (
    <header style={{
      position: "relative", zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "16px 28px", borderBottom: "1px solid var(--line)",
      background: "color-mix(in srgb, var(--void) 72%, transparent)", backdropFilter: "blur(4px)",
    }}>
      <Wordmark size={18} />
      <nav style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {items.map(([id, label]) => (
          <button key={id} onClick={() => onNav?.(id)} style={{
            background: "none", border: "none", cursor: "pointer", padding: "8px 14px",
            fontFamily: "var(--font-terminal)", fontSize: "var(--text-xs)", letterSpacing: "var(--tracking-wide)",
            textTransform: "uppercase", color: nav === id ? "var(--rain-green)" : "var(--ink-2)",
            textShadow: nav === id ? "var(--glow-sm)" : "none",
          }}>{label}</button>
        ))}
        <div style={{ width: 1, height: 22, background: "var(--line)", margin: "0 10px" }} />
        <IconButton label="Settings" onClick={() => onNav?.("about")}><i data-lucide="settings"></i></IconButton>
        <button onClick={() => onNav?.("profile")} style={{ background: "none", border: "none", padding: 0, marginLeft: 4, cursor: "pointer" }} aria-label="Profile">
          <Avatar initials="YU" glow={nav === "profile"} />
        </button>
      </nav>
    </header>
  );
}

Object.assign(window, { Header });
