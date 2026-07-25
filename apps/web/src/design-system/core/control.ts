/**
 * Class fragments shared by the pressable controls.
 *
 * Only the behaviour that must feel identical across every control lives here.
 * Sizing deliberately does not: `Button` sizes by height and horizontal
 * padding, `IconButton` is square, and folding those into one scale would mean
 * one of them carrying padding it does not want.
 */

/**
 * Settles down and in, the way a key bottoms out — never a bounce or a float.
 *
 * `:active` rather than a React state flag, so it costs no re-render and works
 * for a keyboard user pressing Space, who never fires a mouse event at all.
 */
export const PRESSABLE = "active:not-disabled:translate-y-px active:not-disabled:scale-[0.985]";

/** A disabled control must not look pressable or claim the pointer. */
export const DISABLEABLE = "disabled:cursor-not-allowed disabled:opacity-40";

/** The transition every control shares, on the design system's fast snap. */
export const CONTROL_TRANSITION =
  "transition-[background,color,box-shadow,border-color,transform] duration-[var(--dur-fast)] ease-[var(--ease-out)]";
