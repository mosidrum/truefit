"use client";

import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./Landing.module.scss";
import {
  CTA_LABEL,
  DIFFS,
  FAQS,
  FEATURES,
  HOT_LINE_INDICES,
  LOGOS,
  NAV_LINKS,
  PAIN_POINTS,
  PLANS,
  PREVIEW_LINE_COUNT,
  QUOTES,
  ROLE_LABEL,
  STATS,
  STEPS,
  TAILORED_KEYWORDS,
} from "@/lib/landingData";

/** Marketing CTAs open Clerk sign-up so first-time visitors can create an account. */
function beginSignUp() {
  window.location.assign("/sign-up");
}

const RING_CIRCUMFERENCE = 113;

/** Fades each attached element in on scroll, mirroring the source design's
 * IntersectionObserver reveal.
 *
 * The observer itself lives in an effect (not lazy state) because dev-mode
 * Strict Mode mounts effects, cleans them up, then mounts them again; an
 * observer built once via `useState` would get disconnected by that first
 * cleanup and never observe again. The effect re-observes every element
 * already registered by a ref, so the replayed mount recovers correctly. */
function useReveal() {
  const elements = useRef<Set<HTMLElement>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries, io) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          const delay = Number(el.dataset.revealDelay ?? 0);
          window.setTimeout(() => {
            el.style.opacity = "1";
            el.style.transform = "none";
          }, delay);
          io.unobserve(el);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8%" }
    );
    observerRef.current = observer;
    for (const el of elements.current) observer.observe(el);
    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, []);

  const attach = useMemo(
    () => (el: HTMLElement | null) => {
      if (!el) return;
      if (el.dataset.revealInit !== "1") {
        el.dataset.revealInit = "1";
        el.style.opacity = "0";
        el.style.transform = "translateY(26px)";
        el.style.transition =
          "opacity .85s cubic-bezier(.2,.7,.2,1), transform .85s cubic-bezier(.2,.7,.2,1)";
      }
      elements.current.add(el);
      observerRef.current?.observe(el);
    },
    []
  );

  // `index` is the caller's position within a mapped list, used only to
  // stagger simultaneous reveals the same way the source design does.
  return function reveal(baseDelay = 0, index = 0) {
    const stagger = Math.min(240, (index % 4) * 70);
    return { ref: attach, "data-reveal-delay": baseDelay + stagger };
  };
}

export default function Landing() {
  return (
    <div className={styles.page}>
      <div className={styles.heroGlow} />
      <SiteHeader />
      <main>
        <Hero />
        <LogoMarquee />
        <ProblemSection />
        <ProofStats />
        <HowItWorks />
        <FeaturesDiff />
        <FeatureIndex />
        <Testimonials />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}

function SiteHeader() {
  return (
    <header className={styles.header}>
      <nav className={styles.nav}>
        <a href="#top" className={styles.brand}>
          <span className={styles.brandMark}>T</span>
          <span className={styles.brandName}>truefit</span>
        </a>
        <div className={styles.navLinks}>
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className={styles.navLink}>
              {link.label}
            </a>
          ))}
        </div>
        <div className={styles.navActions}>
          <Show when="signed-out">
            <SignInButton mode="modal" forceRedirectUrl="/">
              <button
                type="button"
                className={`${styles.pill} ${styles.pillOutline}`}
              >
                Log in
              </button>
            </SignInButton>
            <SignUpButton mode="modal" forceRedirectUrl="/">
              <button
                type="button"
                className={`${styles.pill} ${styles.pillAccent}`}
              >
                {CTA_LABEL}
              </button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </div>
      </nav>
    </header>
  );
}

function Hero() {
  const reveal = useReveal();

  return (
    <section id="top" className={styles.hero}>
      <div>
        <div {...reveal()} className={styles.badge}>
          <span className={styles.badgeIcon}>✦</span>
          Reads the job post. Rewrites your CV.
        </div>
        <h1 {...reveal(60)} className={styles.h1}>
          Every application
          <br />
          deserves its own CV.
        </h1>
        <p {...reveal(120)} className={styles.lede}>
          Paste a job link. TrueFit rewrites your experience in the language
          that role hires for — evidence intact, keywords earned, formatting
          that machines and humans both read.
        </p>
        <div {...reveal(180)} className={styles.heroActions}>
          <button
            type="button"
            onClick={beginSignUp}
            className={`${styles.pill} ${styles.pillAccent} ${styles.ctaPrimary}`}
          >
            {CTA_LABEL} <span>→</span>
          </button>
          <a
            href="#how"
            className={`${styles.pill} ${styles.pillOutline} ${styles.ctaSecondary}`}
          >
            See it tailor a CV
          </a>
        </div>
        <div {...reveal(240)} className={styles.socialProof}>
          <div className={styles.avatarStack}>
            <span className={`${styles.avatar} ${styles.avatar1}`} />
            <span className={`${styles.avatar} ${styles.avatar2}`} />
            <span className={`${styles.avatar} ${styles.avatar3}`} />
            <span className={`${styles.avatar} ${styles.avatar4}`} />
          </div>
          <div className={styles.socialProofText}>
            <strong>218,000 candidates</strong>
            <br />
            tailored a CV with TrueFit this year
          </div>
        </div>
      </div>

      <div {...reveal(140)} className={styles.stageWrap}>
        <HeroStage />
      </div>
    </section>
  );
}

/** Owns the tailoring-preview tween (match score + highlighted lines) in its
 * own component so the ~25fps interval only re-renders this small subtree,
 * not the whole marketing page. */
function HeroStage() {
  const [tailored, setTailored] = useState(false);
  const [score, setScore] = useState(58);

  useEffect(() => {
    const flip = window.setInterval(() => setTailored((v) => !v), 4200);
    return () => window.clearInterval(flip);
  }, []);

  useEffect(() => {
    const tween = window.setInterval(() => {
      const target = tailored ? 96 : 58;
      setScore((current) => {
        if (Math.abs(current - target) <= 0.5) return current;
        return current + (target - current) * 0.14;
      });
    }, 40);
    return () => window.clearInterval(tween);
  }, [tailored]);

  const rounded = Math.round(score);
  const ringOffset = RING_CIRCUMFERENCE - (RING_CIRCUMFERENCE * score) / 100;

  return (
    <>
      <div className={styles.stageGlow} />
      <div className={styles.stageCard}>
        <div className={styles.stageSweep} />
        <div className={styles.stageHeader}>
          <div className={styles.stageHeaderLabel}>Tailoring for</div>
          <div className={styles.roleTag}>{ROLE_LABEL}</div>
        </div>

        <div className={styles.stageColumns}>
          <div className={`${styles.stageCol} ${styles.stageColOriginal}`}>
            <div className={styles.stageColLabel}>Your CV</div>
            {Array.from({ length: PREVIEW_LINE_COUNT }).map((_, i) => (
              <div key={i} className={styles.stageBar} />
            ))}
          </div>

          <div className={`${styles.stageCol} ${styles.stageColTuned}`}>
            <div className={styles.stageColLabel}>Tailored</div>
            {Array.from({ length: PREVIEW_LINE_COUNT }).map((_, i) => (
              <div key={i} className={styles.stageLineRow}>
                <div className={styles.stageLineBar} />
                {tailored && HOT_LINE_INDICES.has(i) && (
                  <div className={styles.stageLineHot} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.stageFooter}>
          <svg viewBox="0 0 44 44" className={styles.ring}>
            <circle cx="22" cy="22" r="18" className={styles.ringTrack} />
            <circle
              cx="22"
              cy="22"
              r="18"
              className={styles.ringProgress}
              strokeDashoffset={ringOffset}
            />
          </svg>
          <div className={styles.matchText}>
            <div className={styles.matchScore}>{rounded}% match</div>
            <div className={styles.matchSub}>
              against the posted requirements
            </div>
          </div>
          <div className={styles.keywordChips}>
            {tailored ? (
              TAILORED_KEYWORDS.map((word) => (
                <span key={word} className={styles.keywordChip}>
                  {word}
                </span>
              ))
            ) : (
              <span className={styles.keywordChip}>scanning posting…</span>
            )}
          </div>
        </div>
      </div>

      <div className={styles.floatInvites}>
        <div className={styles.floatInvitesLabel}>Interview invites</div>
        <div className={styles.floatInvitesValue}>
          3.1×{" "}
          <span className={styles.floatInvitesDelta}>
            ▲ vs. one generic CV
          </span>
        </div>
      </div>
      <div className={styles.floatTiming}>
        <span className={styles.dot}>●</span> Rewritten in 11 seconds
      </div>
    </>
  );
}

function LogoMarquee() {
  const reveal = useReveal();
  const loop = [...LOGOS, ...LOGOS];

  return (
    <section className={styles.marquee}>
      <div {...reveal()} className={`${styles.sectionLabel} ${styles.marqueeLabel}`}>
        Candidates hired at
      </div>
      <div {...reveal(120)} className={styles.marqueeTrackWrap}>
        <div className={styles.marqueeTrack}>
          {loop.map((logo, i) => (
            <span key={i}>{logo}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProblemSection() {
  const reveal = useReveal();

  return (
    <section id="problem" className={styles.problem}>
      <div className={styles.problemInner}>
        <svg
          viewBox="0 0 1180 600"
          preserveAspectRatio="none"
          className={styles.problemLines}
        >
          <path
            d="M150 210 C 260 150, 320 130, 372 96"
            fill="none"
            stroke="#2f3a34"
            strokeWidth="1.4"
          />
          <path
            d="M1010 190 C 1070 260, 1088 320, 1118 392"
            fill="none"
            stroke="#2f3a34"
            strokeWidth="1.4"
          />
          <path
            d="M700 540 C 790 520, 850 552, 918 596"
            fill="none"
            stroke="#2f3a34"
            strokeWidth="1.4"
          />
          <path d="M596 500 L 596 592" fill="none" stroke="#2f3a34" strokeWidth="1.4" />
          <path
            d="M120 330 C 300 300, 880 300, 1060 330"
            fill="none"
            stroke="#5ce276"
            strokeOpacity="0.35"
            strokeWidth="1.2"
            strokeDasharray="6 10"
            className={styles.dashedPath}
          />
        </svg>

        <h2 {...reveal()} className={styles.problemHeading}>
          The way we apply today is chaotic.
        </h2>

        <div {...reveal(120)} className={styles.problemGrid}>
          {PAIN_POINTS.map((point) => (
            <div key={point} className={styles.problemPoint}>
              {point}
            </div>
          ))}
        </div>

        <div className={`${styles.floatCard} ${styles.floatCardApplied}`}>
          <div className={styles.floatCardLabel}>APPLIED</div>
          <div className={styles.floatCardValue}>80 roles</div>
          <span className={styles.floatCardBadge}>99+</span>
        </div>

        <div className={`${styles.floatCard} ${styles.floatCardReplies}`}>
          <div className={styles.floatCardRepliesLabel}>Replies</div>
          <div className={styles.floatCardRepliesValue}>3</div>
        </div>

        <div className={`${styles.floatChip} ${styles.floatChipFile}`}>
          CV_final_v7_USE_THIS.pdf
        </div>

        <div className={`${styles.floatChip} ${styles.floatChipRejected}`}>
          Rejected · no reason given
        </div>

        <div className={styles.problemResolve}>TrueFit removes all of this</div>
      </div>
    </section>
  );
}

function ProofStats() {
  const reveal = useReveal();

  return (
    <section id="proof" className={styles.proof}>
      <div className={styles.proofGlow} />
      <div className={styles.proofGrid}>
        {STATS.map((stat, i) => (
          <div key={stat.label} {...reveal(0, i)}>
            <div className={styles.statValue}>{stat.value}</div>
            <div className={styles.statLabel}>{stat.label}</div>
            <div className={styles.statNote}>{stat.note}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const reveal = useReveal();

  return (
    <section id="how" className={styles.how}>
      <div {...reveal()} className={styles.howHeader}>
        <h2 className={styles.howTitle}>How it works?</h2>
        <div className={styles.howSubtitle}>Let’s break it down.</div>
      </div>

      <div className={styles.howBody}>
        <svg
          viewBox="0 0 1000 620"
          preserveAspectRatio="none"
          className={styles.howLines}
        >
          <path
            d="M430 150 L 570 150"
            fill="none"
            stroke="#5ce276"
            strokeOpacity="0.45"
            strokeWidth="2"
            strokeDasharray="7 9"
          />
          <path
            d="M580 300 C 500 330, 460 340, 400 400"
            fill="none"
            stroke="#5ce276"
            strokeOpacity="0.45"
            strokeWidth="2"
            strokeDasharray="7 9"
          />
          <path
            d="M430 470 L 570 470"
            fill="none"
            stroke="#5ce276"
            strokeOpacity="0.45"
            strokeWidth="2"
            strokeDasharray="7 9"
          />
        </svg>

        <div className={styles.stepGrid}>
          {STEPS.map((step, i) => (
            <div key={step.num} {...reveal(0, i)} className={styles.stepCard}>
              <span className={styles.stepPin} />
              <div className={styles.stepCardBody}>
                <div className={styles.stepCardTop}>
                  <span className={styles.stepCardNum}>{step.num}</span>
                  <span className={styles.stepCardIcon}>{step.icon}</span>
                </div>
                <div className={styles.stepCardTitle}>{step.title}</div>
                <div className={styles.stepCardText}>{step.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div {...reveal()} className={styles.howFooter}>
        Got a role in mind? <a href="#pricing">Let’s tailor for it →</a>
      </div>
    </section>
  );
}

function FeaturesDiff() {
  const reveal = useReveal();

  return (
    <section id="features" className={styles.features}>
      <div {...reveal()} className={styles.featuresHead}>
        <h2 className={styles.featuresTitle}>
          The diff <span>is</span> the product.
        </h2>
        <p className={styles.featuresLede}>
          Nothing is invented. Every rewritten line is traced to a line you
          already wrote — shown struck through, with its source on the
          record.
        </p>
      </div>

      <div {...reveal()} className={styles.diffMeta}>
        <span>Tailoring against</span>
        <span className={styles.diffMetaRole}>{ROLE_LABEL}</span>
        <span className={styles.diffMetaCount}>3 of 14 lines changed</span>
      </div>

      <div>
        {DIFFS.map((diff, i) => (
          <div
            key={diff.num}
            {...reveal(0, i)}
            className={`${styles.diffRow} ${styles.dividerRow}`}
          >
            <div className={styles.diffNum}>{diff.num}</div>
            <div className={styles.diffContent}>
              <div className={styles.diffBefore}>{diff.before}</div>
              <div className={styles.diffAfterRow}>
                <span className={styles.diffBar} />
                <div>
                  <div className={styles.diffAfter}>{diff.after}</div>
                  <div className={styles.diffFootnote}>
                    <span>Source · {diff.source}</span>
                    <span className={styles.diffMatch}>
                      Matches · {diff.match}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div {...reveal()} className={`${styles.diffFooter} ${styles.dividerRow}`}>
        <span>
          Unsupported claims are never written — they come back to you as a
          question.
        </span>
        <a href="#cta">See your own diff →</a>
      </div>
    </section>
  );
}

function FeatureIndex() {
  const reveal = useReveal();

  return (
    <section className={styles.featureIndex}>
      <div className={`${styles.sectionLabel} ${styles.featureIndexLabel}`}>
        What you get — index
      </div>
      <div>
        {FEATURES.map((feature, i) => (
          <div
            key={feature.num}
            {...reveal(0, i)}
            className={`${styles.indexRow} ${styles.dividerRow}`}
          >
            <div className={styles.indexNum}>{feature.num}</div>
            <div>
              <div className={styles.indexTitle}>{feature.title}</div>
              <div className={styles.indexTag}>{feature.tag}</div>
            </div>
            <div className={styles.indexBody}>{feature.body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Testimonials() {
  const reveal = useReveal();
  const [active, setActive] = useState(0);

  useEffect(() => {
    const rotate = window.setInterval(
      () => setActive((i) => (i + 1) % QUOTES.length),
      7000
    );
    return () => window.clearInterval(rotate);
  }, []);

  const quote = QUOTES[active];

  return (
    <section className={styles.testimonials}>
      <div className={styles.testimonialsGlow} />
      <div className={styles.testimonialsGrid}>
        <div {...reveal()}>
          <div className={`${styles.sectionLabel} ${styles.tabsLabel}`}>
            Outcomes, on the record
          </div>
          <div>
            {QUOTES.map((t, i) => (
              <button
                key={t.name}
                type="button"
                onClick={() => setActive(i)}
                className={styles.tab}
                style={{ opacity: active === i ? 1 : 0.45 }}
              >
                <span
                  className={`${styles.tabRail} ${
                    active === i ? styles.tabRailActive : ""
                  }`}
                />
                <span className={styles.tabName}>
                  {t.name}
                  <span className={styles.tabRole}>{t.role}</span>
                </span>
                <span className={styles.tabResult}>{t.result}</span>
              </button>
            ))}
          </div>
        </div>

        <div {...reveal(100)} className={styles.quoteCol}>
          <blockquote className={styles.quoteText}>
            <span className={styles.quoteMark}>“</span>
            {quote.text}
            <span className={styles.quoteMark}>”</span>
          </blockquote>
          <div className={styles.quoteBy}>
            <span className={styles.quoteAvatar} />
            <div className={styles.quoteByText}>
              <strong>{quote.name}</strong>
              <span className={styles.quoteByRole}>
                {quote.role} · {quote.result}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const reveal = useReveal();

  return (
    <section id="pricing" className={styles.pricing}>
      <div {...reveal()} className={styles.pricingHead}>
        <div className={`${styles.sectionLabel} ${styles.pricingLabel}`}>
          Pricing
        </div>
        <h2 className={styles.pricingTitle}>
          One good hire pays for a decade of this.
        </h2>
      </div>
      <div className={styles.plansGrid}>
        {PLANS.map((plan, i) => (
          <div key={plan.name} {...reveal(0, i)} className={styles.plan}>
            <div>
              <div className={styles.planName}>{plan.name}</div>
              <div className={styles.planPriceRow}>
                <span className={styles.planPrice}>{plan.price}</span>
                <span className={styles.planPer}>{plan.per}</span>
              </div>
              <div className={styles.planBlurb}>{plan.blurb}</div>
            </div>
            <div className={styles.planItems}>
              {plan.items.map((item) => (
                <div key={item} className={styles.planItem}>
                  <span className={styles.planCheck}>✓</span>
                  {item}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={beginSignUp}
              className={`${styles.pill} ${styles.pillAccent} ${styles.planCta}`}
            >
              {plan.cta}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function Faq() {
  const reveal = useReveal();
  const [open, setOpen] = useState(-1);

  return (
    <section id="faq" className={styles.faq}>
      <h2 {...reveal()} className={styles.faqTitle}>
        FAQ
      </h2>
      <div className={styles.faqList}>
        {FAQS.map((faq, i) => {
          const isOpen = open === i;
          return (
            <div
              key={faq.q}
              {...reveal(0, i)}
              className={`${styles.faqItem} ${i % 2 ? styles.faqItemRight : ""}`}
            >
              <div className={styles.faqCard}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  className={styles.faqQuestion}
                >
                  <span className={styles.faqQuestionText}>{faq.q}</span>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    className={`${styles.faqChevron} ${
                      isOpen ? styles.faqChevronOpen : ""
                    }`}
                  >
                    <path d="M5 9l7 7 7-7" />
                  </svg>
                </button>
                {isOpen && <p className={styles.faqAnswer}>{faq.a}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function FinalCta() {
  const reveal = useReveal();

  return (
    <section id="cta" className={styles.cta}>
      <div {...reveal()} className={styles.ctaCard}>
        <div>
          <h2 className={styles.ctaTitle}>
            Join 218,000+ candidates tailoring with TrueFit.
          </h2>
          <p className={styles.ctaLede}>
            Three tailored CVs free. No card, no watermark, no lock-in on
            your own words.
          </p>
        </div>

        <div className={styles.ctaMock}>
          <div className={styles.ctaMockLayer1} />
          <div className={styles.ctaMockLayer2} />
          <div className={styles.ctaPanel}>
            <p className={styles.ctaPanelText}>
              Drop your email and we’ll set up your CV record — then every
              job link you paste comes back as a CV written for that role, in
              your own words.
            </p>
            <div className={styles.ctaForm}>
              <input
                type="email"
                placeholder="Enter your email"
                className={styles.ctaInput}
              />
              <button
                type="button"
                onClick={beginSignUp}
                className={styles.ctaSubmit}
              >
                {CTA_LABEL}
              </button>
            </div>
            <div className={styles.ctaPrivacy}>
              We care about your data — read our{" "}
              <a href="#faq">privacy policy</a>.
            </div>
          </div>
        </div>

        <div className={styles.ctaBadge}>
          ATS-tested exports by
          <span className={styles.ctaBadgeBrand}>
            <span className={styles.ctaBadgeMark}>T</span>truefit
          </span>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerRow}>
        <span className={styles.footerBrand}>
          <span className={styles.footerBrandMark}>T</span>
          truefit
        </span>
        <span>Privacy</span>
        <span>Security</span>
        <span>Careers</span>
        <span>© 2026 TrueFit Labs</span>
      </div>
    </footer>
  );
}
