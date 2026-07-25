// Sample challenge content for the GOD_MODE_CODE UI kit.
const GMC = window.GODMODECODEDesignSystem_ca0aa4;

const CHALLENGES = {
  quotes: {
    id: "quotes", glyph: "❝❞", title: "Quotes", meta: "240 passages",
    description: "Motivational one-liners to warm up your fingers.",
    passages: [
      "Do or do not. There is no try.",
      "The only way out is through, so keep your hands moving.",
      "Discipline is choosing between what you want now and what you want most.",
    ],
  },
  code: {
    id: "code", glyph: "{ }", title: "Code", meta: "88 blocks",
    description: "Short blocks pulled from real open-source repos.",
    passages: [
      "const sum = arr.reduce((a, b) => a + b, 0);",
      "for (let i = 0; i < n; i++) { grid[i] = new Array(n).fill(0); }",
      "export function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }",
    ],
  },
  prose: {
    id: "prose", glyph: "¶", title: "Prose", meta: "60 passages",
    description: "Profound paragraphs from the canon of literature.",
    passages: [
      "It was the best of times, it was the worst of times, it was the age of wisdom.",
      "All happy families are alike; each unhappy family is unhappy in its own way.",
      "Call me Ishmael. Some years ago, having little money in my purse, I went to sea.",
    ],
  },
};

const LEADERBOARD = [
  { rank: 1, user: "neo_anderson", wpm: 148, acc: 99.2 },
  { rank: 2, user: "trinity", wpm: 141, acc: 98.7 },
  { rank: 3, user: "morpheus", wpm: 133, acc: 99.9 },
  { rank: 4, user: "cypher", wpm: 128, acc: 94.1 },
  { rank: 5, user: "you", wpm: 112, acc: 98.4 },
];

Object.assign(window, { GMC, CHALLENGES, LEADERBOARD });
