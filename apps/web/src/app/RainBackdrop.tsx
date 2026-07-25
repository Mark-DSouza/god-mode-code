import { DigitalRain, type DigitalRainProps } from "../design-system/index.ts";

/** The subset of the rain's controls a screen has any business setting. */
export type RainBackdropProps = Pick<DigitalRainProps, "speed" | "intensity" | "enabled">;

/**
 * The rain's resting state, taken from the mockups rather than from the
 * component's own defaults.
 *
 * `DigitalRain` defaults to `intensity 0.65, speed 1`, but no screen in the
 * design is rendered at those values — every frame passes an explicit level.
 * The mockups define four: calm 0.5/0.75, faint 0.28, mid 0.72/1.25 and hot
 * 0.96/1.9, and the eight ambient screens all use calm. Inheriting the
 * component default therefore renders every idle screen somewhere between the
 * design's mid and calm — the rain reads as if the user were already typing,
 * and it competes with the body copy it sits behind.
 */
const CALM = { intensity: 0.5, speed: 0.75 } as const;

/**
 * The rain, fixed behind every screen.
 *
 * Pinned with `fixed` at the base z layer so no screen has to think about it,
 * and dimmed to 50% to match the mockups' `.rain { opacity: .5 }` — the effect
 * has to sit far enough back that foreground text stays crisp over it.
 *
 * Screens that want the rain to react — the Run screen raising `speed` and
 * `intensity` toward mid and hot as WPM climbs — pass those through; everything
 * else gets calm.
 */
export function RainBackdrop({ speed, intensity, enabled }: RainBackdropProps) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 opacity-50"
      style={{ zIndex: "var(--z-rain)" }}
    >
      <DigitalRain
        speed={speed ?? CALM.speed}
        intensity={intensity ?? CALM.intensity}
        enabled={enabled}
      />
    </div>
  );
}
