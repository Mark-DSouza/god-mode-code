import React, { useRef, useEffect } from "react";

/**
 * DigitalRain — the signature GOD_MODE_CODE background.
 * Falling columns of glyphs: a near-white glowing head, a fading green trail.
 * `speed` scales fall rate; `intensity` (0–1) drives density + brightness and
 * is meant to be raised while the user is actively typing.
 */
export function DigitalRain({
  speed = 1,
  intensity = 0.65,
  fontSize = 16,
  color = "#00FF41",
  headColor = "#E9FFEE",
  fade = 0.06,
  className = "",
  style = {},
}) {
  const canvasRef = useRef(null);
  const stateRef = useRef({ speed, intensity });
  stateRef.current = { speed, intensity };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const glyphs =
      "ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾉ0123456789<>=*+-¦｜╌ﾘ:.\"".split("");
    let cols = 0, drops = [], speeds = [], raf = 0, last = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(rect.width / fontSize);
      drops = new Array(cols).fill(0).map(() => Math.random() * -rect.height / fontSize);
      speeds = new Array(cols).fill(0).map(() => 0.5 + Math.random() * 0.9);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, rect.width, rect.height);
    }

    function frame(t) {
      const dt = Math.min((t - last) / 16.67, 3) || 1;
      last = t;
      const { speed: sp, intensity: it } = stateRef.current;
      const rect = canvas.getBoundingClientRect();
      // fade previous frame to black — this is what creates the trailing tail
      ctx.fillStyle = `rgba(0,0,0,${fade})`;
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.font = `${fontSize}px 'Share Tech Mono', monospace`;
      ctx.textBaseline = "top";

      const activeCols = Math.floor(cols * (0.35 + it * 0.65));
      for (let i = 0; i < cols; i++) {
        if (i > activeCols) continue;
        const x = i * fontSize;
        const y = drops[i] * fontSize;
        const g = glyphs[(Math.random() * glyphs.length) | 0];
        // head glyph: near-white with heavy bloom
        if (Math.random() > 0.975) {
          ctx.fillStyle = headColor;
          ctx.shadowColor = headColor;
          ctx.shadowBlur = 12;
        } else {
          const bright = 0.55 + it * 0.45;
          ctx.fillStyle = color;
          ctx.globalAlpha = bright;
          ctx.shadowColor = color;
          ctx.shadowBlur = 6;
        }
        if (y > -fontSize) ctx.fillText(g, x, y);
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;

        drops[i] += speeds[i] * sp * dt * 0.55;
        if (y > rect.height && Math.random() > 0.975) {
          drops[i] = Math.random() * -20;
          speeds[i] = 0.5 + Math.random() * 0.9;
        }
      }
      raf = requestAnimationFrame(frame);
    }

    resize();
    raf = requestAnimationFrame(frame);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [fontSize, color, headColor, fade]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden="true"
      style={{ display: "block", width: "100%", height: "100%", background: "#000", ...style }}
    />
  );
}
