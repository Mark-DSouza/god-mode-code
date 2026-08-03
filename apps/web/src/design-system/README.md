# The design system, reimplemented

The shipped design system in `mockups-and-design-system/design_system/` is
authoritative for **tokens** — colour, type, spacing, effects. Those are
consumed directly and never forked; see `packages/design-tokens`.

Its **components** are a different matter. They are reimplemented here against
their published `.d.ts` contracts rather than imported.

## Why not import them

Every shipped component builds a single inline `style` object:

```jsx
// components/core/Button.jsx
const s = { ...base, ...sizes[size], ...v.rest, ...(hover ? v.hover : null), ...style };
return (
  <button style={s} {...rest}>
    {children}
  </button>
);
```

Three consequences, in descending order of how much they matter:

1. **`className` cannot win.** Inline styles beat every selector short of
   `!important`. A caller who passes `className="bg-error"` gets the green
   button anyway. Since this application styles with utility classes over the
   token layer, that makes the components unusable as written.
2. **Hover and press are React state.** `onMouseEnter`/`onMouseLeave` set state
   and re-render. A keyboard user never triggers either, so there is no
   `:focus-visible` treatment at all — and the mouse path re-renders the tree on
   pointer movement.
3. **No accessible semantics.** `IconButton` has no `aria-label` wiring,
   `ProgressBar` no `role="progressbar"`, `Tabs` no roving `tabIndex`, `Dialog`
   no focus trap.

The reimplementations keep the prop contracts exactly, so the `.d.ts` files stay
the specification and the UI kit in `ui_kits/god_mode_code/` stays a valid
reference for how screens compose.

## What is here, and what is not

Implemented — the primitives every screen sits on:

| Group      | Components                                                                                                |
| ---------- | --------------------------------------------------------------------------------------------------------- |
| `effects`  | `DigitalRain`                                                                                             |
| `brand`    | `Wordmark`                                                                                                |
| `core`     | `Badge` `Button` `Card` `Dialog` `IconButton` `Input` `Kbd` `ProgressBar` `Select` `Stat` `Switch` `Tabs` |
| `typing`   | `ChallengeCard` `Countdown` `ResultPanel` `TypingField`                                                   |
| `data`     | `Avatar` `RunChart` `Table`                                                                               |
| `feedback` | `EmptyState`                                                                                              |

Deliberately **not** implemented yet — each is domain furniture for a screen
that does not exist, and lands with the ticket that introduces it:

| Group        | Components                | Lands with                 |
| ------------ | ------------------------- | -------------------------- |
| `typing`     | `CodeStub`                | Solve Run                  |
| `navigation` | `Breadcrumb` `SettingRow` | Settings                   |
| `feedback`   | `FaultState`              | the screens that need them |

Building them now would mean guessing at the states they need before any screen
exists to need them.

`Table` was on that list until per-Challenge Leaderboards arrived, which is what
the list is for. It is the one component here built as a real `<table>` rather
than as the shipped component's grid of `<div>`s: a ranking is tabular data by
construction — the same fields about a different person on every row — and the
element that says so is the one that gives a screen reader the row and column
association for free.

## Accessibility deviations

ADR-0010 records four, numbered below in the order that document lists them:

| #   | Deviation                                    | Where it lives                                                         |
| --- | -------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | `--ink-3` raised to meet 4.5:1 on the void   | `packages/design-tokens/src/deviations.css`                            |
| 2   | visually hidden, genuinely focused `<input>` | `src/run/RunScreen.tsx`; `TypingField` is the presentational layer     |
| 3   | reduced motion honoured                      | `deviations.css` for ambient chrome; `DigitalRain` for its own default |
| 4   | non-colour indicator on wrong glyphs         | `typing/Glyph.tsx` — wavy underline, and `␣` for a mistyped space      |

Deviation 3 is the one that lives partly here: `DigitalRain` defaults off under
`prefers-reduced-motion` while still honouring an explicit choice to turn it back
on, because the system preference sets the default and does not overrule someone
who went to Settings and asked for rain.

2 and 4 are both component-level and both belong to the typing surface. 2 is
deliberately split: the focused `<input>` belongs to the application's Run
screen, not to the design system, because a presentational component that owns
focus cannot be composed twice on a page.
