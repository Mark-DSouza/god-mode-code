import type { ReactNode } from "react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  ChallengeCard,
  Countdown,
  Dialog,
  DigitalRain,
  EmptyState,
  IconButton,
  Input,
  Kbd,
  ProgressBar,
  ResultPanel,
  RunChart,
  Select,
  Stat,
  Switch,
  Table,
  Tabs,
  TypingField,
  Wordmark,
} from "../design-system/index.ts";
import type { SpecimenName } from "./names.ts";

export interface Specimen {
  /** Width of the photographed box, in CSS pixels. */
  width: number;
  node: ReactNode;
}

/**
 * The seed the rain specimen is drawn with.
 *
 * A literal rather than the build's `VITE_RAIN_SEED`, so this page renders the
 * same still whoever opens it and whatever it was built for. The number itself
 * means nothing beyond "not zero, and never changed again" — changing it
 * invalidates the baseline for no gain.
 */
const RAIN_SPECIMEN_SEED = 20_231;

/**
 * The design system's specimen cards, rebuilt against our components.
 *
 * Each entry renders the states the shipped card renders, in the order it
 * renders them, so a baseline here can be held up against
 * `mockups-and-design-system/design_system/**\/*.card.html` by eye and be a
 * like-for-like comparison. Where our product uses a state the card does not
 * show — the calm `Badge`, the unselected `ChallengeCard`, the small
 * left-aligned `Stat` the Run screen reads out — that state is added rather
 * than left uncovered, because those are the compositions a screen is built out
 * of and the ones that have drifted before (ADR-0012).
 *
 * Keyed by `SpecimenName`, so a name with nothing to render does not compile.
 * The reverse — something rendered under no name — is impossible for the same
 * reason.
 */
export const SPECIMENS: Record<SpecimenName, Specimen> = {
  wordmark: {
    width: 700,
    node: (
      <div className="flex flex-col items-start gap-6">
        <Wordmark size={28} glow="lg" />
        <Wordmark size={18} />
        <Wordmark size={14} mark={false} color="var(--ink-2)" glow="none" />
      </div>
    ),
  },

  "button-variants": {
    width: 700,
    node: (
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary">Start Run</Button>
        <Button variant="secondary">Change Discipline</Button>
        <Button variant="ghost">Skip</Button>
        <Button variant="danger">Abort</Button>
        <Button variant="primary" disabled>
          Disabled
        </Button>
      </div>
    ),
  },

  "button-sizes": {
    width: 700,
    node: (
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="lg">Large</Button>
        <Button size="lg" block>
          Block
        </Button>
      </div>
    ),
  },

  "icon-button": {
    width: 700,
    node: (
      <div className="flex flex-wrap items-center gap-3">
        <IconButton label="Restart">
          <span aria-hidden="true">↺</span>
        </IconButton>
        <IconButton variant="outline" label="Settings">
          <span aria-hidden="true">⚙</span>
        </IconButton>
        {/* The Run screen's abandon control, which is the only IconButton the
            product ships today. */}
        <IconButton label="Abandon this Challenge" variant="outline">
          <span aria-hidden="true">✕</span>
        </IconButton>
        <IconButton label="Small" size="sm">
          <span aria-hidden="true">↺</span>
        </IconButton>
        <IconButton label="Large" size="lg">
          <span aria-hidden="true">↺</span>
        </IconButton>
        <IconButton label="Disabled" disabled>
          <span aria-hidden="true">↺</span>
        </IconButton>
      </div>
    ),
  },

  switch: {
    width: 700,
    node: (
      <div className="flex flex-col items-start gap-4">
        <Switch checked label="Digital rain" />
        <Switch checked={false} label="Digital rain" />
        <Switch checked disabled label="Locked on" />
      </div>
    ),
  },

  // The card fills this with EASY/NIGHTMARE, which is the mockup's own
  // invention — there is no such scale. The states under test are "a value is
  // selected" and "disabled", and they are the same states whatever the options
  // say, so this uses the Seniority bands the domain actually has (CONTEXT.md).
  select: {
    width: 700,
    node: (
      <div className="flex flex-wrap items-center gap-3">
        <Select
          label="Seniority"
          value="PRINCIPAL"
          options={[
            { value: "JUNIOR", label: "JUNIOR" },
            { value: "SENIOR", label: "SENIOR" },
            { value: "PRINCIPAL", label: "PRINCIPAL" },
          ]}
        />
        <Select
          label="Seniority, unavailable"
          disabled
          value="JUNIOR"
          options={[{ value: "JUNIOR", label: "JUNIOR" }]}
        />
      </div>
    ),
  },

  kbd: {
    width: 700,
    node: (
      <span className="font-code text-sm text-ink-2">
        Press <Kbd>⏎</Kbd> <Kbd wide>Space</Kbd>
      </span>
    ),
  },

  // The left-hand cell of surfaces.card.html, composed exactly as published.
  surfaces: {
    width: 420,
    node: (
      <Card glow scanlines>
        <div className="mb-4 flex flex-wrap gap-2">
          <Badge tone="green" dot>
            Online
          </Badge>
          <Badge tone="warning">New Best</Badge>
          <Badge tone="error" solid>
            Failed
          </Badge>
          <Badge tone="info">Cyan</Badge>
        </div>
        <ProgressBar value={68} showLabel label="Progress through the Passage" />
        <div className="mt-4">
          <Input prefix=">" placeholder="enter callsign" />
        </div>
      </Card>
    ),
  },

  // `glow` is the selected state, not a decoration — the walking skeleton put
  // it on a status panel and nothing caught it. Rendering all four surfaces
  // side by side is what makes that confusion visible.
  card: {
    width: 700,
    node: (
      <div className="grid grid-cols-2 gap-4">
        <Card>Resting</Card>
        <Card glow>Glow — the selected state</Card>
        <Card scanlines>Scanlines</Card>
        <Card interactive>Interactive</Card>
      </div>
    ),
  },

  badge: {
    width: 700,
    node: (
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="green" dot>
          Online
        </Badge>
        <Badge tone="neutral" dot>
          Checking
        </Badge>
        <Badge tone="error" dot>
          Unreachable
        </Badge>
        <Badge tone="warning">New Best</Badge>
        <Badge tone="error" solid>
          Failed
        </Badge>
        <Badge tone="info">Cyan</Badge>
      </div>
    ),
  },

  "progress-bar": {
    width: 520,
    node: (
      <div className="flex flex-col gap-4">
        <ProgressBar value={68} showLabel label="Green" />
        <ProgressBar value={42} tone="warning" showLabel label="Warning" />
        <ProgressBar value={17} tone="error" showLabel label="Error" />
        <ProgressBar value={90} tone="info" label="Info, unlabelled" />
      </div>
    ),
  },

  input: {
    width: 420,
    node: (
      <div className="flex flex-col gap-4">
        <Input prefix=">" placeholder="enter callsign" />
        <Input placeholder="no prefix" />
        <Input invalid defaultValue="taken" />
        <Input disabled defaultValue="locked" />
      </div>
    ),
  },

  // VT323 is a numeral face and every use in the design is a number. The
  // walking skeleton put a status word and a version string through it.
  stat: {
    width: 700,
    node: (
      <div className="flex flex-col gap-8">
        <div className="flex justify-around">
          <Stat value={112} unit="wpm" label="Speed" size="md" />
          <Stat value="98.4" unit="%" label="Accuracy" size="md" accent="warning" />
        </div>
        {/* The Run screen's readout row. */}
        <div className="flex gap-10">
          <Stat value={112} unit="wpm" label="Speed" size="sm" align="left" />
          <Stat value="98.4" unit="%" label="Accuracy" size="sm" align="left" accent="green" />
          <Stat value={21} unit="s" label="Time" size="sm" align="left" accent="white" />
        </div>
        <div className="flex justify-around">
          <Stat value={148} unit="wpm" label="Peak" size="lg" />
          <Stat value={3} label="Errors" size="lg" accent="error" />
        </div>
      </div>
    ),
  },

  dialog: {
    width: 700,
    node: (
      <Dialog
        open
        title="Reset Progress?"
        footer={
          <>
            <Button variant="ghost">Cancel</Button>
            <Button variant="danger">Wipe</Button>
          </>
        }
      >
        This clears every recorded Run.
      </Dialog>
    ),
  },

  tabs: {
    width: 700,
    node: (
      <Tabs
        label="Discipline"
        value="code"
        items={[
          { id: "quotes", label: "Quotes" },
          { id: "code", label: "Code" },
          { id: "prose", label: "Prose" },
        ]}
      />
    ),
  },

  avatar: {
    width: 700,
    node: (
      <div className="flex items-center gap-4">
        <Avatar initials="YU" size={40} />
        {/* Deliberately no `size`. The card's middle tile is the default, and a
            specimen that passed one would be the only place the default is not
            under test — which is where a changed default would hide. */}
        <Avatar initials="NE" />
        <Avatar initials="TR" size={22} glow={false} />
        {/* The header renders this before the Handle arrives. */}
        <Avatar initials="" size={28} glow={false} />
      </div>
    ),
  },

  table: {
    width: 700,
    node: (
      <Table
        // The card's own columns and rows, so this can be held up against it
        // side by side. The gap between 3 and 5 is the card's too, and
        // it is the state the component exists for: the row that is yours,
        // pinned in from below the visible top.
        columns={[
          { key: "position", label: "#", width: "48px", align: "center" },
          { key: "user", label: "User" },
          { key: "wpm", label: "WPM", width: "90px", align: "right" },
          {
            key: "acc",
            label: "Acc",
            width: "80px",
            align: "right",
            muted: true,
            render: (value) => `${String(value)}%`,
          },
        ]}
        rows={[
          { position: 1, user: "neo_anderson", wpm: 148, acc: 99.2 },
          { position: 2, user: "trinity", wpm: 141, acc: 98.7 },
          { position: 3, user: "morpheus", wpm: 133, acc: 99.9 },
          { position: 5, user: "you", wpm: 112, acc: 98.4 },
        ]}
        getRowKey={(row) => row.position}
        getHighlight={(row) => row.user === "you"}
        label="Leaderboard specimen"
      />
    ),
  },

  "run-chart": {
    width: 700,
    node: (
      <RunChart
        values={[96, 104, 88, 118, 110, 126, 121, 133, 119, 140, 131, 148, 129, 136]}
        label="Last 14 runs · WPM"
        peakLabel="peak 148"
        // The card's own series and captions, so this can be held up against it
        // side by side. `emphasis` is left off deliberately: the shipped
        // component lights the tallest bar, and this is the specimen of that.
        aria-label="Fourteen recent runs by WPM, from 88 to 148."
      />
    ),
  },

  "empty-state": {
    width: 700,
    node: (
      <EmptyState
        title="No runs logged yet"
        description="Complete a run and the rain starts keeping score."
      >
        <Button size="lg">Start Your First Run</Button>
      </EmptyState>
    ),
  },

  "digital-rain": {
    width: 900,
    node: (
      <div className="relative h-[360px] overflow-hidden">
        <DigitalRain
          intensity={0.85}
          speed={1.4}
          enabled
          seed={RAIN_SPECIMEN_SEED}
          className="absolute inset-0"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display text-3xl tracking-widest text-rain-shine [text-shadow:var(--glow-lg)]">
            GOD_MODE_CODE
          </span>
        </div>
      </div>
    ),
  },

  "typing-field": {
    width: 780,
    node: (
      <Card scanlines>
        <TypingField
          text="There is no spoon. Only the keys, and how fast you find them."
          typed="There is no spoon. Only the kys"
        />
      </Card>
    ),
  },

  // The card's copy reads "Short blocks from real repos", which is the model
  // ADR-0004 supersedes: the Code Discipline is Patterns, solved rather than
  // transcribed. A baseline is reviewed by eye and then trusted, so committing
  // the mockup's wording would quietly reinstate a decision that was reversed.
  // The states — selected and not — are the card's; the words are the domain's.
  "challenge-card": {
    width: 560,
    node: (
      <div className="grid grid-cols-2 gap-4">
        <ChallengeCard
          glyph="{ }"
          title="Code"
          description="Algorithmic Patterns, solved rather than transcribed."
          meta="88 Patterns"
          selected
        />
        <ChallengeCard
          glyph="❝❞"
          title="Quotes"
          description="Short attributed lines to warm up your fingers."
        />
      </div>
    ),
  },

  "result-panel": {
    width: 620,
    node: <ResultPanel wpm={112} accuracy={98.4} time={21} errors={3} isBest />,
  },

  countdown: {
    width: 780,
    node: (
      <Card padding="var(--space-6)" className="min-h-[260px]">
        <Countdown
          count={3}
          tag="Code · Principal"
          preview="export function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }"
        />
      </Card>
    ),
  },
};
