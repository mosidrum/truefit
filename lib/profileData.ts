// App-level constants for the career-record profile page — not per-user
// data (that's aggregated from uploaded CVs in lib/profile.ts). Kept
// separate from the component so it stays focused on markup and behaviour
// (mirrors lib/landingData.ts).

export type Tone = {
  label: string;
  note: string;
};

export const COMPLETION_RING_CIRCUMFERENCE = 164;

export const TONES: Tone[] = [
  {
    label: "Plain",
    note: "Short sentences, no adjectives that cannot be measured. Good for engineering and public sector.",
  },
  {
    label: "Confident",
    note: "Leads with outcomes and ownership while keeping your own sentence length. The default for most roles.",
  },
  {
    label: "Formal",
    note: "Third-person-adjacent phrasing and full titles. Suited to legal, finance and academia.",
  },
];

export const DEFAULT_TONE_INDEX = 1;
