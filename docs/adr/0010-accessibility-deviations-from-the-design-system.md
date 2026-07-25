# Accessibility deviations from the shipped design system

The design system in `mockups-and-design-system/` is treated as authoritative
except in four places, all of which are accessibility fixes. Recorded here
because a future reader comparing our implementation against the shipped tokens
will find discrepancies and may "correct" them back.

**`--ink-3` is raised from `#1C6531` (~3.0:1 on `--void`) to `#2A8642`
(~4.6:1).** This token colours _untyped glyphs on the typing surface_ —
the text a player is actively reading under time pressure. It fails WCAG AA for
normal text, and while it scrapes past the large-text exemption at the `lg` size
(24px), the mobile Run screen specifies `md` (19px), where it plainly fails. The
rest of the palette is genuinely high-contrast; `--ink-1` is ~16:1 and
`--rain-green` ~15:1. This is the only token that needed moving.

**Keyboard input uses a visually hidden, genuinely focused `<input>`,** with
`TypingField` as a purely presentational layer above it. The mockup's
`CodeScreen` captures input via `tabIndex={0}` and `onKeyDown` on a `<div>`,
which **does not raise the on-screen keyboard on iOS or Android** — so mobile
typing, which the mockups explicitly design for, would not work at all. The
hidden-input pattern also gives correct IME and dead-key handling, detectable
paste events (required by ADR-0004), and a real form control for screen readers.

**`DigitalRain` respects `prefers-reduced-motion`,** defaulting its Settings
toggle off when the operating system requests reduced motion. The effect animates
continuously behind every screen and intensifies with WPM, which is difficult for
anyone with vestibular sensitivity.

**Wrong glyphs carry a non-colour indicator** in addition to the red flash.
Correct-versus-wrong signalled by green-versus-red alone fails WCAG 1.4.1, and
red/green is the most common form of colour blindness. The design already
gestures at the fix by rendering a mistyped space as `␣`.

Full WCAG 2.2 AA conformance was considered and rejected as disproportionate: a
timed speed-typing test cannot be made meaningfully usable without sight and fine
motor control. The line taken is that nothing should be _needlessly_ inaccessible.
