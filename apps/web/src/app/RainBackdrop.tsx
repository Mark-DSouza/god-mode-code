import { DigitalRain, type DigitalRainProps } from "../design-system/index.ts";

/** The subset of the rain's controls a screen has any business setting. */
export type RainBackdropProps = Pick<DigitalRainProps, "speed" | "intensity" | "enabled">;

/**
 * The rain, fixed behind every screen.
 *
 * Dimmed to ~55% so foreground text stays legible over it, and pinned with
 * `fixed` at the base z layer so no screen has to think about it. Screens that
 * want the rain to react — the Run screen raising `speed` and `intensity` with
 * WPM — pass those through; everything else gets the calm ambient default.
 */
export function RainBackdrop({ speed, intensity, enabled }: RainBackdropProps) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 opacity-55"
      style={{ zIndex: "var(--z-rain)" }}
    >
      <DigitalRain speed={speed} intensity={intensity} enabled={enabled} />
    </div>
  );
}
