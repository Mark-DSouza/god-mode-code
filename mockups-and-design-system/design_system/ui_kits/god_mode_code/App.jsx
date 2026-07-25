// App orchestrator — ties screens together over the digital rain.
const { DigitalRain, Countdown } = window.GODMODECODEDesignSystem_ca0aa4;

function App() {
  const [screen, setScreen] = React.useState("auth"); // auth | home | countdown | run | code | result | leaderboard | settings | profile
  const [nav, setNav] = React.useState("practice");
  const [category, setCategory] = React.useState("code");
  const [result, setResult] = React.useState(null);
  const [count, setCount] = React.useState(3);
  const [intensity, setIntensity] = React.useState(0.5);
  const [speed, setSpeed] = React.useState(1);

  React.useEffect(() => {
    const active = screen === "run" || screen === "code";
    setIntensity(active ? 0.75 : screen === "countdown" ? 0.72 : screen === "result" ? 0.4 : screen === "auth" ? 0.4 : 0.5);
    setSpeed(active ? 1.5 : screen === "countdown" ? 1.25 : 1);
  }, [screen]);

  // Countdown 3 → 1 then into the run.
  React.useEffect(() => {
    if (screen !== "countdown") return;
    setCount(3);
    let n = 3;
    const id = setInterval(() => {
      n -= 1;
      if (n <= 0) { clearInterval(id); setScreen(category === "code" ? "code" : "run"); }
      else setCount(n);
    }, 800);
    return () => clearInterval(id);
  }, [screen, category]);

  function start(cat) { setCategory(cat); setScreen("countdown"); }
  function done(r) { setResult(r); setScreen("result"); }

  function goNav(id) {
    setNav(id === "profile" ? "profile" : id);
    setScreen(id === "leaderboard" ? "leaderboard" : id === "about" ? "settings" : id === "profile" ? "profile" : "home");
  }

  React.useEffect(() => {
    window.lucide && window.lucide.createIcons();
  });

  if (screen === "auth") {
    return (
      <div style={{ position: "relative", minHeight: "100vh", background: "var(--void)" }}>
        <DigitalRain intensity={0.4} speed={0.9} style={{ position: "fixed", inset: 0, zIndex: 0, opacity: 0.55 }} />
        <div style={{ position: "relative", zIndex: 10 }}><AuthScreen onEnter={() => setScreen("home")} /></div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", minHeight: "100vh", background: "var(--void)" }}>
      <DigitalRain intensity={intensity} speed={speed} style={{ position: "fixed", inset: 0, zIndex: 0, opacity: 0.55 }} />
      <div style={{ position: "relative", zIndex: 10, minHeight: "100vh" }}>
        <Header nav={nav} onNav={goNav} />
        {screen === "home" && <HomeScreen onStart={start} />}
        {screen === "countdown" && (
          <div style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Countdown count={count} tag={category.toUpperCase()} />
          </div>
        )}
        {screen === "run" && (
          <RunScreen category={category} onDone={done} onExit={() => setScreen("home")}
            onIntensity={setIntensity} />
        )}
        {screen === "code" && <CodeScreen onDone={done} onExit={() => setScreen("home")} />}
        {screen === "leaderboard" && <LeaderboardScreen />}
        {screen === "settings" && <SettingsScreen />}
        {screen === "profile" && <ProfileScreen />}
        {screen === "result" && (
          <ResultScreen result={result} onRetry={() => start(category)} onHome={() => setScreen("home")} />
        )}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
