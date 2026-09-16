// Static copy for the marketing landing page. Kept separate from the
// component so Landing.tsx stays focused on markup and behaviour.

export const CTA_LABEL = "Start free trial";

export const ROLE_LABEL = "Senior Product Designer · Northwind";

export const NAV_LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#proof", label: "Results" },
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
];

export const LOGOS = [
  "Northwind",
  "Velora",
  "Kestrel Labs",
  "Alderlight",
  "Brightpath",
  "Monic",
  "Halyard",
];

export const PAIN_POINTS = [
  "One CV sent to 80 roles reads generic to all 80.",
  "75% of CVs are screened by software before a human.",
  "Rewriting by hand costs 40 minutes per application.",
];

export const STATS = [
  { value: "218k", label: "Candidates", note: "tailored a CV this year" },
  { value: "3.1×", label: "More interviews", note: "vs. one generic CV" },
  { value: "94%", label: "ATS pass rate", note: "across 40k parsed exports" },
  { value: "11s", label: "Per tailor", note: "link in, CV out" },
];

export const STEPS = [
  {
    num: "01",
    icon: "⤒",
    title: "You upload. We read it.",
    body: "One PDF, DOCX or LinkedIn export becomes a structured record of your roles, outcomes and numbers.",
  },
  {
    num: "02",
    icon: "◎",
    title: "You paste. We match.",
    body: "TrueFit reads the posting like a hiring manager and scores you requirement by requirement.",
  },
  {
    num: "03",
    icon: "✎",
    title: "We rewrite. You check.",
    body: "A side-by-side diff shows every change and the evidence behind it. Edit or accept in a click.",
  },
  {
    num: "04",
    icon: "↗",
    title: "Export. Ready to send.",
    body: "Parse-tested PDF and DOCX, a matching cover letter, and a saved version per application.",
  },
];

export const DIFFS = [
  {
    num: "03",
    before: "Responsible for managing the design team and improving the product.",
    after: "Led a 6-person design team through a checkout rebuild that lifted conversion 18% in two quarters.",
    source: "Acme, 2021 — bullet 3",
    match: "team leadership, commerce",
  },
  {
    num: "07",
    before: "Worked on the design system and various internal tools.",
    after: "Owned a 90-component design system adopted by four product teams, cutting handoff time in half.",
    source: "Acme, 2022 — bullet 1",
    match: "design systems",
  },
  {
    num: "11",
    before: "Helped junior designers with their work when needed.",
    after: "Mentored three junior designers; two promoted within a year.",
    source: "Referee note — bullet 5",
    match: "mentoring",
  },
];

export const FEATURES = [
  {
    num: "01",
    tag: "Requirement-level scoring",
    title: "A match score that explains itself",
    body: "Line by line against the posting: where you are strong, where you are thin, where you are genuinely unqualified — read it before you spend an evening applying.",
  },
  {
    num: "02",
    tag: "Auto-versioning",
    title: "One version per application",
    body: "Every tailored CV is filed against its role and company, with a cover letter drafted from the same evidence and kept in step.",
  },
  {
    num: "03",
    tag: "PDF + DOCX",
    title: "Exports that survive the parser",
    body: "Single column, real text layers, no tables or icon fonts to trip machine reading. What you see is what the screen reads.",
  },
  {
    num: "04",
    tag: "Honest gaps",
    title: "Coaching where you fall short",
    body: "When a requirement is missing, TrueFit says so plainly and offers the closest honest equivalent from your own history.",
  },
];

export const QUOTES = [
  {
    text: "Eleven applications, six first-round calls. I had been sending the same CV for a year and blaming the market.",
    name: "Ama Osei",
    role: "Data analyst → Senior analyst, fintech",
    result: "6 first rounds",
  },
  {
    text: "The diff view is what sold me. I could see it was still my work, just finally pointed at the job I wanted.",
    name: "Marcus Hale",
    role: "Ops lead, 14 years experience",
    result: "Offer in 5 weeks",
  },
  {
    text: "As a career switcher I needed translation, not invention. It did exactly that and nothing more.",
    name: "Priya Raman",
    role: "Teacher → L&D manager",
    result: "Switched sector",
  },
];

export const PLANS = [
  {
    name: "Starter",
    price: "Free",
    per: "forever",
    blurb: "For one or two roles you really want.",
    cta: "Tailor three CVs",
    items: ["3 tailored CVs", "Match score and diff view", "PDF export"],
  },
  {
    name: "Pro",
    price: "$14",
    per: "/ month",
    blurb: "For an active search.",
    cta: CTA_LABEL,
    items: [
      "Unlimited tailoring",
      "Cover letters from the same evidence",
      "PDF + DOCX, parse-tested",
      "Version per application",
      "Gap coaching",
    ],
  },
  {
    name: "Teams",
    price: "$9",
    per: "/ seat",
    blurb: "For coaches and career services.",
    cta: "Book a walkthrough",
    items: [
      "Everything in Pro",
      "Shared candidate workspace",
      "Outcome reporting",
      "SSO and data residency",
    ],
  },
];

export const FAQS = [
  {
    q: "Does it make things up?",
    a: "No. Every tailored line is derived from something already in your CV, and anything TrueFit cannot substantiate is surfaced as a question for you rather than written as fact.",
  },
  {
    q: "Will recruiters know it was AI-assisted?",
    a: "It reads like you on a good day. TrueFit matches your existing register and sentence length instead of imposing one house voice — and you approve every line before export.",
  },
  {
    q: "What about applicant tracking systems?",
    a: "Exports are single-column, parse-tested PDF and DOCX with real text layers, checked against the parsers used by the major ATS vendors.",
  },
  {
    q: "How long does one tailored CV take?",
    a: "About eleven seconds to draft, a couple of minutes to review. The diff view means you read only what changed, not the whole document again.",
  },
  {
    q: "Can I keep my own formatting?",
    a: "Yes. Bring your template and TrueFit writes into it, or use one of ours if your current layout breaks machine reading.",
  },
  {
    q: "Is my CV used to train models?",
    a: "Never. Your documents are encrypted, scoped to your account, and deletable in one click — and we do not train on customer data.",
  },
];

export const TAILORED_KEYWORDS = ["design systems", "checkout", "mentoring"];

/** Indices of the "Tailored" preview lines that get a highlighted keyword chip. */
export const HOT_LINE_INDICES = new Set([0, 2, 5]);

export const PREVIEW_LINE_COUNT = 7;
