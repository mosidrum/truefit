// Static copy for the tailoring dashboard, ported from the product mockup.
// Kept separate from the component so Dashboard.tsx stays focused on markup
// and behaviour (mirrors lib/landingData.ts).

export type DiffLine = {
  num: string;
  before: string;
  after: string;
  source: string;
  match: string;
};

export type RequirementStatus = "ok" | "part" | "no";

export type Requirement = {
  label: string;
  status: RequirementStatus;
};

export type TailoringSession = {
  id: string;
  title: string;
  company: string;
  score: number;
  status: string;
  changed: string;
  postUrl: string;
  summary: string;
  gapTitle: string;
  gapBody: string;
  letter: [string, string];
  diffs: DiffLine[];
  bars: [string, number][];
  keywords: string[];
  cvLines: string[];
  reqs: Requirement[];
};

export const SCORE_RING_CIRCUMFERENCE = 145;

export const TAILORING_SESSIONS: TailoringSession[] = [
  {
    id: "northwind",
    title: "Senior Frontend Engineer",
    company: "Northwind",
    score: 94,
    status: "ATS-ready",
    changed: "3 of 14 lines · every line traced to your record",
    postUrl: "Parsed from northwind.com/careers/senior-frontend",
    summary:
      "Frontend engineer with seven years shipping design systems and commerce interfaces at scale. Led a checkout rebuild that lifted conversion 18%.",
    gapTitle: "No Kubernetes experience on record.",
    gapBody:
      "Closest evidence: you ran Docker-based CI at Acme. TrueFit will not claim more than that — add detail if you have it.",
    letter: [
      "Dear hiring team — I spent the last two years rebuilding Acme's checkout with a six-person team, taking conversion up 18% while cutting our component count by a third. Northwind's posting asks for someone who can hold a design system and a revenue surface at the same time; that is the job I have been doing.",
      "I would bring the same habit of measuring what shipped, and of mentoring the people who ship it — two of my juniors were promoted last year.",
    ],
    diffs: [
      {
        num: "03",
        before:
          "Responsible for managing the design team and improving the product.",
        after:
          "Led a 6-person design team through a checkout rebuild that lifted conversion 18% in two quarters.",
        source: "Acme, 2021 — bullet 3",
        match: "team leadership, commerce",
      },
      {
        num: "07",
        before: "Worked on the design system and various internal tools.",
        after:
          "Owned a 90-component design system adopted by four product teams, halving handoff time.",
        source: "Acme, 2022 — bullet 1",
        match: "design systems",
      },
      {
        num: "11",
        before: "Helped junior designers with their work when needed.",
        after: "Mentored three junior engineers; two promoted within a year.",
        source: "Referee note — bullet 5",
        match: "mentoring",
      },
    ],
    bars: [
      ["Must-have requirements", 92],
      ["Nice-to-haves", 78],
      ["Keyword coverage", 96],
    ],
    keywords: [
      "design systems",
      "checkout",
      "TypeScript",
      "accessibility",
      "mentoring",
      "performance budgets",
    ],
    cvLines: [
      "Led a 6-person design team through a checkout rebuild that lifted conversion 18% in two quarters.",
      "Owned a 90-component design system adopted by four product teams, halving handoff time.",
      "Cut first-contentful-paint 1.4s by moving the storefront to streamed rendering.",
      "Mentored three junior engineers; two promoted within a year.",
      "Ran accessibility remediation to WCAG 2.2 AA across 40 templates.",
    ],
    reqs: [
      { label: "5+ years building production React", status: "ok" },
      { label: "Design system ownership", status: "ok" },
      { label: "Commerce or checkout surfaces", status: "ok" },
      { label: "Mentoring and hiring input", status: "part" },
      { label: "Kubernetes in production", status: "no" },
    ],
  },
  {
    id: "velora",
    title: "Product Designer — Remote",
    company: "Velora",
    score: 88,
    status: "ATS-ready",
    changed: "5 of 14 lines · reframed from engineering to design outcomes",
    postUrl: "Parsed from velora.io/jobs/product-designer-remote",
    summary:
      "Designer-engineer with seven years owning end-to-end product surfaces — research through shipped interface — most recently a commerce checkout.",
    gapTitle: "No dedicated user-research portfolio on record.",
    gapBody:
      "Closest evidence: you ran usability sessions before the checkout rebuild. Add participant counts and it becomes a real claim.",
    letter: [
      "Dear Velora team — I design and build the same surface, which is why the checkout I rebuilt at Acme moved conversion 18% rather than just looking better. Your posting asks for a designer comfortable in the codebase; that has been my whole practice.",
      "I work remote-first and document as I go — the 90-component system I owned is still the reference four teams design against.",
    ],
    diffs: [
      {
        num: "01",
        before: "Senior Frontend Engineer with a focus on UI work.",
        after:
          "Product designer who ships: owns research, interface and the front-end code behind it.",
        source: "Headline — rewritten",
        match: "end-to-end product design",
      },
      {
        num: "04",
        before: "Built the checkout rebuild with the design team.",
        after:
          "Designed and shipped the Acme checkout rebuild end to end — flows, prototypes, production UI — lifting conversion 18%.",
        source: "Acme, 2021 — bullet 3",
        match: "product ownership, commerce",
      },
      {
        num: "09",
        before: "Worked on the design system and various internal tools.",
        after:
          "Defined a 90-component design system with tokens and usage docs, adopted by four product teams.",
        source: "Acme, 2022 — bullet 1",
        match: "design systems, documentation",
      },
    ],
    bars: [
      ["Must-have requirements", 86],
      ["Nice-to-haves", 74],
      ["Keyword coverage", 91],
    ],
    keywords: [
      "end-to-end design",
      "design tokens",
      "prototyping",
      "Figma",
      "remote collaboration",
    ],
    cvLines: [
      "Designed and shipped the Acme checkout rebuild end to end, lifting conversion 18%.",
      "Defined a 90-component design system with tokens and usage docs, adopted by four teams.",
      "Ran fortnightly usability sessions that reshaped the payment step before build.",
      "Partnered with two PMs on quarterly roadmap framing.",
    ],
    reqs: [
      { label: "Portfolio of shipped product work", status: "ok" },
      { label: "Design systems and tokens", status: "ok" },
      { label: "Comfort in code", status: "ok" },
      { label: "Qualitative research practice", status: "part" },
      { label: "Brand or marketing design", status: "no" },
    ],
  },
  {
    id: "kestrel",
    title: "Backend Engineer",
    company: "Kestrel Labs",
    score: 71,
    status: "Stretch role",
    changed: "7 of 14 lines · plus two gaps TrueFit will not paper over",
    postUrl: "Parsed from kestrellabs.dev/roles/backend-engineer",
    summary:
      "Full-stack leaning frontend engineer with production Node and API design experience, moving toward backend-heavy work.",
    gapTitle: "No Go or distributed-systems experience on record.",
    gapBody:
      "Your record covers Node, Postgres and queue work. Kestrel asks for Go at scale — TrueFit flags this rather than implying it.",
    letter: [
      "Dear Kestrel team — I am applying as a frontend engineer who has spent three years on the services behind the interface: the checkout APIs, the queue that settles payments, the Postgres schema under both.",
      "I am direct about the gap: I have not written Go in production. Everything else in the posting I have shipped and can talk through line by line.",
    ],
    diffs: [
      {
        num: "02",
        before: "Senior Frontend Engineer, Acme Commerce.",
        after:
          "Senior engineer, Acme Commerce — front end plus the checkout services and payment queue behind it.",
        source: "Headline — rewritten",
        match: "backend ownership",
      },
      {
        num: "06",
        before: "Built the customer dashboard used by most of the client base.",
        after:
          "Designed the Node/Postgres API powering the customer dashboard, serving 4M requests a day.",
        source: "Brightpath, 2020 — bullet 2",
        match: "API design, scale",
      },
    ],
    bars: [
      ["Must-have requirements", 64],
      ["Nice-to-haves", 58],
      ["Keyword coverage", 79],
    ],
    keywords: ["Node", "Postgres", "API design", "queues", "observability"],
    cvLines: [
      "Designed the Node/Postgres API powering the customer dashboard, serving 4M requests a day.",
      "Built the payment settlement queue behind Acme checkout, with retries and dead-letter handling.",
      "Instrumented traces across the checkout path, cutting mean debug time from hours to minutes.",
    ],
    reqs: [
      { label: "Production API design", status: "ok" },
      { label: "Relational data modelling", status: "ok" },
      { label: "Queues and async work", status: "part" },
      { label: "Go at scale", status: "no" },
      { label: "Kubernetes in production", status: "no" },
    ],
  },
  {
    id: "alderlight",
    title: "React Developer",
    company: "Alderlight",
    score: 90,
    status: "ATS-ready",
    changed: "2 of 14 lines · your record already matched this one",
    postUrl: "Parsed from alderlight.com/careers/react-developer",
    summary:
      "React specialist with seven years in production apps — performance, accessibility and component architecture.",
    gapTitle: "No React Native work on record.",
    gapBody:
      "Listed as a nice-to-have. Your record has no mobile shipping evidence, so TrueFit leaves it out entirely.",
    letter: [
      "Dear Alderlight — seven years of production React, most recently a checkout rebuild that lifted conversion 18% and a 90-component library four teams build against.",
      "Performance is the part I enjoy most: streamed rendering took 1.4s off our first contentful paint last year.",
    ],
    diffs: [
      {
        num: "05",
        before: "Improved site performance across the storefront.",
        after:
          "Cut first-contentful-paint 1.4s by moving the storefront to streamed React rendering.",
        source: "Acme, 2023 — bullet 4",
        match: "React performance",
      },
      {
        num: "10",
        before: "Made the interface accessible.",
        after: "Took 40 templates to WCAG 2.2 AA with automated checks in CI.",
        source: "Brightpath, 2020 — bullet 5",
        match: "accessibility",
      },
    ],
    bars: [
      ["Must-have requirements", 95],
      ["Nice-to-haves", 70],
      ["Keyword coverage", 94],
    ],
    keywords: [
      "React",
      "TypeScript",
      "streamed rendering",
      "accessibility",
      "component architecture",
    ],
    cvLines: [
      "Cut first-contentful-paint 1.4s by moving the storefront to streamed React rendering.",
      "Owned a 90-component React library adopted by four product teams.",
      "Took 40 templates to WCAG 2.2 AA with automated checks in CI.",
      "Led the TypeScript migration of a 240k-line codebase.",
    ],
    reqs: [
      { label: "Deep production React", status: "ok" },
      { label: "TypeScript", status: "ok" },
      { label: "Performance work", status: "ok" },
      { label: "Testing discipline", status: "part" },
      { label: "React Native", status: "no" },
    ],
  },
  {
    id: "monic",
    title: "Design Engineer",
    company: "Monic",
    score: 82,
    status: "ATS-ready",
    changed: "4 of 14 lines · weighted toward craft and prototyping",
    postUrl: "Parsed from monic.studio/jobs/design-engineer",
    summary:
      "Design engineer working between Figma and production — systems, motion and the details that survive handoff.",
    gapTitle: "No motion or animation work quantified.",
    gapBody:
      "You mention interaction polish but no shipped motion system. Add one example and this rises about 7 points.",
    letter: [
      "Dear Monic — I sit where design and engineering meet: I drew the 90-component system at Acme and then shipped it, which is why it is still in use four teams later.",
      "Craft at the pixel level is the part I will not delegate — and I bring the performance budget along with it.",
    ],
    diffs: [
      {
        num: "03",
        before:
          "Responsible for managing the design team and improving the product.",
        after:
          "Drew and shipped the Acme component system, then held its craft bar through a checkout rebuild worth 18% conversion.",
        source: "Acme, 2021 — bullet 3",
        match: "design engineering",
      },
      {
        num: "08",
        before: "Worked closely with designers on handoff.",
        after:
          "Replaced handoff with shared tokens in code, cutting design-to-production drift to near zero.",
        source: "Acme, 2022 — bullet 2",
        match: "tokens, collaboration",
      },
    ],
    bars: [
      ["Must-have requirements", 84],
      ["Nice-to-haves", 72],
      ["Keyword coverage", 88],
    ],
    keywords: ["design engineering", "tokens", "Figma", "CSS craft", "prototyping"],
    cvLines: [
      "Drew and shipped the Acme component system, adopted by four product teams.",
      "Replaced handoff with shared tokens in code, cutting design-to-production drift to near zero.",
      "Prototyped the checkout flow in production code before committing to the rebuild.",
    ],
    reqs: [
      { label: "Figma to production fluency", status: "ok" },
      { label: "Design systems and tokens", status: "ok" },
      { label: "CSS craft", status: "ok" },
      { label: "Motion design", status: "part" },
      { label: "3D or WebGL", status: "no" },
    ],
  },
];
