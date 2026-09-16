// Static copy for the career-record profile page, ported from the product
// mockup. Kept separate from the component so page.tsx stays focused on
// markup and behaviour (mirrors lib/landingData.ts and lib/dashboardData.ts).

export type RoleFlag = "complete" | "needs-numbers";

export type RoleBullet = {
  text: string;
  usedIn: string;
};

export type Role = {
  title: string;
  company: string;
  dates: string;
  flag: RoleFlag;
  bullets: RoleBullet[];
};

export type Skill = {
  label: string;
  evidenceCount: number;
};

export type Tone = {
  label: string;
  note: string;
};

export type ProfileDocument = {
  name: string;
  meta: string;
};

export const COMPLETION_RING_CIRCUMFERENCE = 164;

export const PROFILE_IDENTITY = {
  name: "Ama Osei",
  headline: "Senior Frontend Engineer · London · 7 years",
  tags: ["Open to offers", "Hybrid · UK"],
};

export const PROFILE_COMPLETION = 86;

export const PROFILE_GAP_NOTE =
  "Two roles are missing outcome numbers. Adding them raises your average match by about 6 points.";

export const ROLES: Role[] = [
  {
    title: "Senior Frontend Engineer",
    company: "Acme Commerce",
    dates: "2021 — present",
    flag: "complete",
    bullets: [
      {
        text: "Led a 6-person design team through a checkout rebuild that lifted conversion 18% in two quarters.",
        usedIn: "used in 12 tailors",
      },
      {
        text: "Owned a 90-component design system adopted by four product teams, halving handoff time.",
        usedIn: "used in 9 tailors",
      },
      {
        text: "Cut first-contentful-paint 1.4s by moving the storefront to streamed rendering.",
        usedIn: "used in 6 tailors",
      },
    ],
  },
  {
    title: "Frontend Engineer",
    company: "Brightpath",
    dates: "2019 — 2021",
    flag: "needs-numbers",
    bullets: [
      {
        text: "Built the customer dashboard used by most of the client base — add a user count to strengthen this.",
        usedIn: "used in 3 tailors",
      },
      {
        text: "Ran accessibility remediation to WCAG 2.2 AA across 40 templates.",
        usedIn: "used in 5 tailors",
      },
    ],
  },
  {
    title: "Junior Developer",
    company: "Halyard Studio",
    dates: "2017 — 2019",
    flag: "needs-numbers",
    bullets: [
      {
        text: "Shipped marketing sites for agency clients — add scale or traffic figures.",
        usedIn: "used in 1 tailor",
      },
    ],
  },
];

export const SKILLS: Skill[] = [
  { label: "React", evidenceCount: 7 },
  { label: "TypeScript", evidenceCount: 6 },
  { label: "Design systems", evidenceCount: 5 },
  { label: "Accessibility", evidenceCount: 4 },
  { label: "Performance", evidenceCount: 3 },
  { label: "Mentoring", evidenceCount: 3 },
  { label: "Commerce", evidenceCount: 4 },
  { label: "Docker", evidenceCount: 1 },
];

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

export const DOCUMENTS: ProfileDocument[] = [
  { name: "Master CV — 2026.pdf", meta: "Source of record · updated 3 days ago" },
  { name: "Northwind · Senior Frontend.pdf", meta: "Tailored export · 94% match" },
  { name: "Velora · Product Designer.docx", meta: "Tailored export · 88% match" },
];
