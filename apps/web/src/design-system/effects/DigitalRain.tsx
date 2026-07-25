import { type CSSProperties, useEffect, useRef } from "react";
import { cn } from "../cn.ts";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion.ts";

export interface DigitalRainProps {
  /** Fall-rate multiplier. 1 = calm ambient; raise to ~2 while typing fast. */
  speed?: number;
  /** 0–1. Column density + glyph brightness. Raise while the user types. */
  intensity?: number;
  /** Glyph size in px (also the column width). */
  fontSize?: number;
  /** Trail colour. Defaults to Matrix green (--rain-green). */
  color?: string;
  /** Leading-glyph "shine" colour. Defaults to near-white (--rain-shine). */
  headColor?: string;
  /** Per-frame black fade (0–1). Higher = shorter trails. */
  fade?: number;
  /**
   * Explicit on/off, overriding the reduced-motion default.
   *
   * Extends the shipped contract. `undefined` means "nobody has expressed a
   * preference", and the effect follows the operating system. A boolean is a
   * decision the user made in Settings and always wins — someone who turns the
   * rain back on after seeing it off should get rain (ADR-0010).
   */
  enabled?: boolean;
  className?: string;
  style?: CSSProperties;
}

const GLYPHS = 'ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾉ0123456789<>=*+-¦｜╌ﾘ:."'.split("");

/**
 * The signature GOD_MODE_CODE background: falling glyph columns, a near-white
 * glowing head over a fading green trail.
 *
 * Renders a full-bleed `<canvas>`. Place it behind content — it is decorative
 * and marked `aria-hidden`.
 *
 * Off by default when the operating system requests reduced motion. The effect
 * animates continuously behind every screen and intensifies with WPM, which is
 * a genuine problem for anyone with vestibular sensitivity (ADR-0010).
 */
export function DigitalRain({
  speed = 1,
  intensity = 0.65,
  fontSize = 16,
  color = "var(--rain-green)",
  headColor = "var(--rain-shine)",
  fade = 0.06,
  enabled,
  className,
  style,
}: DigitalRainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const isEnabled = enabled ?? !prefersReducedMotion;

  // `speed` and `intensity` change on almost every keystroke during a run.
  // Routing them through a ref keeps the animation effect from tearing down and
  // restarting the loop — which would reset every column mid-fall.
  const liveRef = useRef({ speed, intensity });
  liveRef.current = { speed, intensity };

  useEffect(() => {
    if (!isEnabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // The caller passes CSS custom properties; canvas cannot resolve those, so
    // they are read off the element once here.
    const computed = getComputedStyle(canvas);
    const resolve = (value: string): string => {
      const match = /^var\((--[\w-]+)\)$/.exec(value.trim());
      return match?.[1] ? computed.getPropertyValue(match[1]).trim() || value : value;
    };
    const trailColor = resolve(color);
    const shineColor = resolve(headColor);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let columns = 0;
    let drops: number[] = [];
    let speeds: number[] = [];
    let frameHandle = 0;
    let lastFrameTime = 0;

    function resize() {
      const { width, height } = canvas!.getBoundingClientRect();
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      columns = Math.ceil(width / fontSize);
      drops = Array.from({ length: columns }, () => (Math.random() * -height) / fontSize);
      speeds = Array.from({ length: columns }, () => 0.5 + Math.random() * 0.9);
      ctx!.fillStyle = "#000";
      ctx!.fillRect(0, 0, width, height);
    }

    function frame(time: number) {
      const delta = Math.min((time - lastFrameTime) / 16.67, 3) || 1;
      lastFrameTime = time;
      const { speed: liveSpeed, intensity: liveIntensity } = liveRef.current;
      const { width, height } = canvas!.getBoundingClientRect();

      // Fading the previous frame toward black is what draws the trailing tail.
      ctx!.fillStyle = `rgba(0,0,0,${fade})`;
      ctx!.fillRect(0, 0, width, height);
      ctx!.font = `${fontSize}px 'Share Tech Mono', monospace`;
      ctx!.textBaseline = "top";

      const activeColumns = Math.floor(columns * (0.35 + liveIntensity * 0.65));
      for (let i = 0; i <= Math.min(activeColumns, columns - 1); i++) {
        const x = i * fontSize;
        const y = drops[i]! * fontSize;
        const glyph = GLYPHS[(Math.random() * GLYPHS.length) | 0]!;

        if (Math.random() > 0.975) {
          ctx!.fillStyle = shineColor;
          ctx!.shadowColor = shineColor;
          ctx!.shadowBlur = 12;
        } else {
          ctx!.fillStyle = trailColor;
          ctx!.globalAlpha = 0.55 + liveIntensity * 0.45;
          ctx!.shadowColor = trailColor;
          ctx!.shadowBlur = 6;
        }
        if (y > -fontSize) ctx!.fillText(glyph, x, y);
        ctx!.globalAlpha = 1;
        ctx!.shadowBlur = 0;

        drops[i] = drops[i]! + speeds[i]! * liveSpeed * delta * 0.55;
        if (y > height && Math.random() > 0.975) {
          drops[i] = Math.random() * -20;
          speeds[i] = 0.5 + Math.random() * 0.9;
        }
      }
      frameHandle = requestAnimationFrame(frame);
    }

    resize();
    frameHandle = requestAnimationFrame(frame);
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    return () => {
      cancelAnimationFrame(frameHandle);
      observer.disconnect();
    };
  }, [isEnabled, fontSize, color, headColor, fade]);

  // Nothing rendered at all when disabled — a hidden canvas would still be a
  // canvas the browser has to composite, and there is no visual to preserve.
  if (!isEnabled) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-testid="digital-rain"
      className={cn("block h-full w-full bg-void", className)}
      style={style}
    />
  );
}
