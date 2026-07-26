import { type CSSProperties, useEffect, useRef } from "react";
import { cn } from "../cn.ts";
import { seededRandom } from "./seeded-random.ts";
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
  /**
   * Draw one reproducible still instead of animating.
   *
   * Undefined — every case but a screenshot — leaves the effect exactly as it
   * was: `Math.random`, wall-clock frame deltas, running until unmounted.
   *
   * A number replaces the global generator with a seeded one and renders
   * {@link FROZEN_FRAMES} frames synchronously, off the clock, so the picture
   * depends on the seed and nothing else. The canvas then carries
   * `data-rain-settled`, which is the signal a visual test waits for before it
   * photographs the page. The rain is the one thing on screen that would
   * otherwise be different in every snapshot, and turning it off for the camera
   * would leave the most animated part of the design as the only part not under
   * test (ADR-0012).
   */
  seed?: number;
  className?: string;
  style?: CSSProperties;
}

const GLYPHS = 'ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾉ0123456789<>=*+-¦｜╌ﾘ:."'.split("");

/**
 * How many frames a seeded render draws before it stops.
 *
 * Columns start above the top of the canvas, spread over a screen's worth of
 * rows, and fall at roughly a fifth to a half a row per frame. Under a hundred
 * frames the picture is still mostly empty sky; past a few hundred it stops
 * changing in any way a reviewer would notice. 180 is comfortably inside the
 * window where the frame looks like the design's rain, and it costs a few
 * milliseconds because none of it waits for a repaint.
 */
const FROZEN_FRAMES = 180;

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
  seed,
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
    // Every draw the effect makes comes from here. Seeded, the stream is fixed
    // and so is the picture; unseeded this is `Math.random` and nothing about
    // the shipped behaviour changes.
    const random = seed === undefined ? Math.random : seededRandom(seed);
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
      drops = Array.from({ length: columns }, () => (random() * -height) / fontSize);
      speeds = Array.from({ length: columns }, () => 0.5 + random() * 0.9);
      ctx!.fillStyle = "#000";
      ctx!.fillRect(0, 0, width, height);
    }

    /**
     * One frame, advanced by `delta` sixtieths of a second.
     *
     * Split out from the animation callback so a still can be composed by
     * calling it a fixed number of times with a fixed delta, which is what
     * takes the wall clock out of the seeded render.
     */
    function draw(delta: number) {
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
        const glyph = GLYPHS[(random() * GLYPHS.length) | 0]!;

        if (random() > 0.975) {
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
        if (y > height && random() > 0.975) {
          drops[i] = random() * -20;
          speeds[i] = 0.5 + random() * 0.9;
        }
      }
    }

    function frame(time: number) {
      const delta = Math.min((time - lastFrameTime) / 16.67, 3) || 1;
      lastFrameTime = time;
      draw(delta);
      frameHandle = requestAnimationFrame(frame);
    }

    resize();

    if (seed === undefined) {
      frameHandle = requestAnimationFrame(frame);
      const observer = new ResizeObserver(resize);
      observer.observe(canvas);
      return () => {
        cancelAnimationFrame(frameHandle);
        observer.disconnect();
      };
    }

    // The seeded path draws once and stops. No `requestAnimationFrame`, because
    // a frame that arrives when the browser feels like it is the thing being
    // designed out; no `ResizeObserver`, because a second `resize` would draw
    // fresh columns from further along the same stream and the seed would no
    // longer decide the picture on its own.
    //
    // The wait is not cosmetic. The glyphs are rasterised by the canvas in
    // Share Tech Mono, and a canvas asked to draw a font the document has not
    // finished loading silently falls back to another one — so drawing early
    // would produce a picture that depends on how fast the font arrived, which
    // is exactly the flake this seed exists to remove.
    let cancelled = false;
    const fontsReady = document.fonts?.ready ?? Promise.resolve();
    void fontsReady.then(() => {
      if (cancelled) return;
      for (let count = 0; count < FROZEN_FRAMES; count++) draw(1);
      canvas.dataset.rainSettled = "true";
    });

    return () => {
      cancelled = true;
    };
  }, [isEnabled, fontSize, color, headColor, fade, seed]);

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
